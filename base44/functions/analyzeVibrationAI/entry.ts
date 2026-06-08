import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { sensorDataId, velStandard, accStandard, tempStandard, machineName, measurementPoint, bearing } = body;

    if (!sensorDataId) return Response.json({ error: 'Missing sensorDataId' }, { status: 400 });

    // Načteme fftLowCutHz z MqttSettings
    let fftLowCutHz = 2;
    try {
      const mqttSettings = await base44.asServiceRole.entities.MqttSettings.list(null, 1);
      if (mqttSettings[0]?.fft_low_cut_hz != null) fftLowCutHz = mqttSettings[0].fft_low_cut_hz;
    } catch (_) {}

    // Načteme SensorData
    const sensorRecords = await base44.asServiceRole.entities.SensorData.filter({ id: sensorDataId });
    const sd = sensorRecords[0];
    if (!sd) return Response.json({ error: 'SensorData not found' }, { status: 404 });

    // Načteme FFT data
    const fftRecords = await base44.asServiceRole.entities.SensorFFTData.filter({ sensor_data_id: sensorDataId });
    const fft = fftRecords[0];
    if (!fft) return Response.json({ error: 'FFT data not found' }, { status: 404 });

    const freqRes = fft.frequency_resolution || 3.259;

    // Parse spektra
    const velX = fft.vel_x_json ? JSON.parse(fft.vel_x_json) : [];
    const velY = fft.vel_y_json ? JSON.parse(fft.vel_y_json) : [];
    const velZ = fft.vel_z_json ? JSON.parse(fft.vel_z_json) : [];
    const accZ = fft.acc_z_json ? JSON.parse(fft.acc_z_json) : [];
    const envZ = fft.env_z_json ? JSON.parse(fft.env_z_json) : [];

    // Helper: RMS ze spektra
    const calcRMS = (arr, minF, maxF) => {
      if (!arr || !arr.length) return null;
      let sumSq = 0;
      for (let i = 0; i < arr.length; i++) {
        const f = i * freqRes;
        if (f >= minF && f <= maxF && f > 0) sumSq += arr[i] * arr[i];
      }
      return Math.sqrt(sumSq / 2);
    };

    const rmsVelX = calcRMS(velX, fftLowCutHz, 1000);
    const rmsVelY = calcRMS(velY, fftLowCutHz, 1000);
    const rmsVelZ = calcRMS(velZ, fftLowCutHz, 1000);
    const rmsAccZ_ms2 = calcRMS(accZ, fftLowCutHz, 6000);
    const rmsAccZ = rmsAccZ_ms2 != null ? rmsAccZ_ms2 / 9.80665 : null;
    const rmsEnvZ = calcRMS(envZ, fftLowCutHz, 1000);

    // Helper: pásmo A/B/C/D
    const getLimitZone = (value, std, type) => {
      if (value == null || !std) return null;
      let a, b, c;
      if (type === 'vel') { a = std.limit_ab; b = std.limit_bc; c = std.limit_cd; }
      else if (type === 'acc') { a = std.acc_limit_ab; b = std.acc_limit_bc; c = std.acc_limit_cd; }
      else return null;
      if (!a) return null;
      if (value < a) return "A";
      if (value < b) return "B";
      if (value < c) return "C";
      return "D";
    };

    const velXZone = getLimitZone(rmsVelX, velStandard, 'vel');
    const velYZone = getLimitZone(rmsVelY, velStandard, 'vel');
    const velZZone = getLimitZone(rmsVelZ, velStandard, 'vel');
    const accZZone = getLimitZone(rmsAccZ, accStandard, 'acc');
    const envZZone = getLimitZone(rmsEnvZ, accStandard, 'acc');

    // =====================================================================
    // DEFEKTNÍ FREKVENCE LOŽISKA (BPFO, BPFI, BSF, FTF)
    // Vypočítáme jako násobky otáčkové frekvence — aplikujeme po detekci 1X
    // =====================================================================
    const calcBearingDefectFreqs = (b, rpm1x_hz) => {
      if (!b?.nb || !b?.bd || !b?.pd || !rpm1x_hz) return null;
      const ratio = (b.bd / b.pd) * Math.cos((b.contact_angle_deg || 0) * Math.PI / 180);
      return {
        bpfo: +(0.5 * b.nb * rpm1x_hz * (1 - ratio)).toFixed(3),
        bpfi: +(0.5 * b.nb * rpm1x_hz * (1 + ratio)).toFixed(3),
        bsf:  +(0.5 * (b.pd / b.bd) * rpm1x_hz * (1 - ratio * ratio)).toFixed(3),
        ftf:  +(0.5 * rpm1x_hz * (1 - ratio)).toFixed(3),
        designation: b.designation,
        manufacturer: b.manufacturer || null,
      };
    };

    // Určíme, které domény mají překročené limity (pásmo B nebo horší)
    const velExceeded = [velXZone, velYZone, velZZone].some(z => z && z !== "A");
    const accExceeded = accZZone && accZZone !== "A";
    const envExceeded = envZZone && envZZone !== "A";

    // Top peaky — pouze pro překročené domény
    const findTopPeaks = (spectrum, n = 5, minBin = 1, maxBin = null) => {
      if (!spectrum || spectrum.length < 3) return [];
      const limit = maxBin ? Math.min(maxBin, spectrum.length - 1) : spectrum.length - 1;
      const candidates = [];
      for (let i = minBin + 1; i < limit; i++) {
        if (spectrum[i] > spectrum[i - 1] && spectrum[i] > spectrum[i + 1]) {
          candidates.push({ freq: +(i * freqRes).toFixed(1), amp: +spectrum[i].toFixed(4) });
        }
      }
      return candidates.sort((a, b) => b.amp - a.amp).slice(0, n);
    };

    // Otáčková frekvence (1X) — hledáme pouze pokud je potřeba pro klasifikaci
    let operatingSpeed = null;
    if (velExceeded || envExceeded) {
      const spectra = [velX, velY, velZ].filter(s => s && s.length > 0);
      if (spectra.length > 0) {
        const minBin = Math.floor(10 / freqRes);
        const maxBin = Math.min(Math.floor(80 / freqRes), spectra[0].length - 1);
        let maxAmp = -1, rpmBin = -1;
        for (let i = minBin; i <= maxBin; i++) {
          const avgAmp = spectra.reduce((s, sp) => s + (sp[i] || 0), 0) / spectra.length;
          if (avgAmp > maxAmp) { maxAmp = avgAmp; rpmBin = i; }
        }
        if (rpmBin >= 0) {
          const freq = +(rpmBin * freqRes).toFixed(2);
          operatingSpeed = { freq, rpm: Math.round(freq * 60), amp: +maxAmp.toFixed(4) };
        }
      }
    }

    // Sestavíme sekce promptu — jen pro překročené domény
    const sections = [];

    if (velExceeded) {
      const peaksX = findTopPeaks(velX, 5, Math.floor(fftLowCutHz / freqRes));
      const peaksY = findTopPeaks(velY, 5, Math.floor(fftLowCutHz / freqRes));
      const peaksZ = findTopPeaks(velZ, 5, Math.floor(fftLowCutHz / freqRes));
      sections.push(`RYCHLOST (překročen limit):
  X: ${rmsVelX?.toFixed(3)} mm/s [pásmo ${velXZone}] — peaky: ${peaksX.map(p => `${p.freq}Hz/${p.amp}`).join(', ') || 'žádné'}
  Y: ${rmsVelY?.toFixed(3)} mm/s [pásmo ${velYZone}] — peaky: ${peaksY.map(p => `${p.freq}Hz/${p.amp}`).join(', ') || 'žádné'}
  Z: ${rmsVelZ?.toFixed(3)} mm/s [pásmo ${velZZone}] — peaky: ${peaksZ.map(p => `${p.freq}Hz/${p.amp}`).join(', ') || 'žádné'}
  Limity normy: A/B=${velStandard?.limit_ab} B/C=${velStandard?.limit_bc} C/D=${velStandard?.limit_cd} mm/s`);
    }

    if (accExceeded) {
      const peaksAcc = findTopPeaks(accZ, 5, Math.floor(500 / freqRes));
      sections.push(`ZRYCHLENÍ Z (překročen limit):
  RMS: ${rmsAccZ?.toFixed(3)} g [pásmo ${accZZone}]
  Peaky 500–6000 Hz: ${peaksAcc.map(p => `${p.freq}Hz/${p.amp}`).join(', ') || 'žádné'}
  Limity normy: A/B=${accStandard?.acc_limit_ab} B/C=${accStandard?.acc_limit_bc} C/D=${accStandard?.acc_limit_cd} g`);
    }

    if (envExceeded) {
      const peaksEnv = findTopPeaks(envZ, 6, Math.floor(fftLowCutHz / freqRes));
      const bearingFreqs = operatingSpeed ? calcBearingDefectFreqs(bearing, operatingSpeed.freq) : null;
      const TOLERANCE_HZ = freqRes * 1.5; // toleranční pásmo ±1.5 bins

      const classifiedEnv = peaksEnv.map(p => {
        const labels = [];

        // Klasifikace podle defektních frekvencí ložiska (pokud je ložisko zadáno)
        if (bearingFreqs) {
          const checks = [
            { name: "BPFO", freq: bearingFreqs.bpfo },
            { name: "BPFI", freq: bearingFreqs.bpfi },
            { name: "BSF",  freq: bearingFreqs.bsf },
            { name: "FTF",  freq: bearingFreqs.ftf },
          ];
          for (const { name, freq } of checks) {
            // Zkontroluj základní frekvenci i harmonické (1×, 2×, 3×)
            for (let harmonic = 1; harmonic <= 3; harmonic++) {
              if (Math.abs(p.freq - freq * harmonic) <= TOLERANCE_HZ) {
                labels.push(harmonic === 1 ? name : `${harmonic}×${name}`);
                break;
              }
            }
          }
        }

        // Klasifikace dle RPM harmonik (pokud jsou otáčky known)
        if (operatingSpeed && labels.length === 0) {
          const ratio = p.freq / operatingSpeed.freq;
          const nearestInt = Math.round(ratio);
          const dev = Math.abs(ratio - nearestInt);
          if (dev < 0.1 && nearestInt > 0) labels.push(`${nearestInt}X RPM`);
        }

        const cls = labels.length > 0 ? labels.join('+') : 'neidentifikováno';
        return `${p.freq}Hz/${p.amp}g [${cls}]`;
      });

      let bearingInfo = '';
      if (bearingFreqs) {
        bearingInfo = `\n  Ložisko: ${bearingFreqs.designation}${bearingFreqs.manufacturer ? ` (${bearingFreqs.manufacturer})` : ''}
  Defektní frekvence: BPFO=${bearingFreqs.bpfo}Hz, BPFI=${bearingFreqs.bpfi}Hz, BSF=${bearingFreqs.bsf}Hz, FTF=${bearingFreqs.ftf}Hz`;
      }

      sections.push(`OBÁLKA Z (překročen limit):
  RMS: ${rmsEnvZ?.toFixed(3)} g [pásmo ${envZZone}]
  Peaky: ${classifiedEnv.join(', ') || 'žádné'}
  Otáčky: ${operatingSpeed ? `${operatingSpeed.freq} Hz = ${operatingSpeed.rpm} RPM` : 'neznámé'}${bearingInfo}
  Limity normy: A/B=${accStandard?.acc_limit_ab} B/C=${accStandard?.acc_limit_bc} C/D=${accStandard?.acc_limit_cd} g`);
    }

    // Pokud není nic překročeno, předáme jen RMS souhrn
    if (sections.length === 0) {
      sections.push(`VŠECHNY HODNOTY V PÁSMU A (žádné překročení limitů):
  Vel X: ${rmsVelX?.toFixed(3) ?? 'N/A'} mm/s, Vel Y: ${rmsVelY?.toFixed(3) ?? 'N/A'} mm/s, Vel Z: ${rmsVelZ?.toFixed(3) ?? 'N/A'} mm/s
  Acc Z: ${rmsAccZ?.toFixed(3) ?? 'N/A'} g, Obálka Z: ${rmsEnvZ?.toFixed(3) ?? 'N/A'} g
  Teplota: ${sd.temperature ?? 'N/A'} °C`);
    }

    const prompt = `Jsi expert na vibrační diagnostiku valivých ložisek. Stroj: ${machineName || "Neznámý"}, místo: ${measurementPoint || "Neznámé"}.

DŮLEŽITÉ: Jedná se o online kontinuální monitorování s automatickým měřením přibližně každé 3 hodiny. Data jsou tedy průběžně sbírána bez zásahu technika. Doporučení ke zvýšení frekvence měření nebo monitorování NEJSOU relevantní — systém již měří automaticky v optimálním intervalu.

${sections.join('\n\n')}

Napiš stručnou diagnostickou zprávu v češtině: celkový stav, co pravděpodobně způsobuje anomálii, co má technik udělat. Buď konkrétní a stručný. Nenavrhuj zvýšení frekvence měření.`;

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      model: "claude_sonnet_4_6",
      response_json_schema: {
        type: "object",
        properties: {
          overall_status: { type: "string", enum: ["OK", "Pozor", "Alarm", "Kritický"] },
          simple_summary: { type: "string", description: "Jednoduchý závěr pro technika (1-2 věty, bez žargonu)" },
          simple_recommendations: {
            type: "array",
            items: { type: "string" },
            description: "1–3 konkrétní akční kroky pro technika"
          },
          domain_velocity: {
            type: "object",
            properties: {
              status: { type: "string", enum: ["OK", "Pozor", "Alarm", "Kritický", "Nedostatečná data"] },
              finding: { type: "string" },
            }
          },
          domain_acceleration: {
            type: "object",
            properties: {
              status: { type: "string", enum: ["OK", "Pozor", "Alarm", "Kritický", "Nedostatečná data"] },
              finding: { type: "string" },
            }
          },
          domain_envelope: {
            type: "object",
            properties: {
              status: { type: "string", enum: ["OK", "Pozor", "Alarm", "Kritický", "Nedostatečná data"] },
              finding: { type: "string" },
            }
          },
          detailed_findings: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                detail: { type: "string" },
                severity: { type: "string", enum: ["info", "warning", "alarm", "critical"] },
              }
            }
          },
          next_inspection_recommendation: { type: "string" }
        },
        required: ["overall_status", "simple_summary", "simple_recommendations"]
      }
    });

    return Response.json({
      ok: true,
      analysis: result,
      operatingSpeed,
      metrics: { rmsVelX, rmsVelY, rmsVelZ, rmsAccZ, rmsEnvZ },
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});