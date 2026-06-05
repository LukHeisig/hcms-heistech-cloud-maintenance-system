import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { sensorDataId, velStandard, accStandard, tempStandard, machineName, measurementPoint } = body;

    if (!sensorDataId) return Response.json({ error: 'Missing sensorDataId' }, { status: 400 });

    // Načteme fftLowCutHz z MqttSettings (stejné jako webhook)
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

    // Helper: výpočet RMS ze spektra v daném frekvenčním pásmu
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
    // acc_z_json je uložen v m/s² — převedeme na g dělením 9.80665
    const rmsAccZ_ms2 = calcRMS(accZ, fftLowCutHz, 6000);
    const rmsAccZ = rmsAccZ_ms2 != null ? rmsAccZ_ms2 / 9.80665 : null;
    const rmsEnvZ = calcRMS(envZ, fftLowCutHz, 1000);

    // =====================================================================
    // DETEKCE PROVOZNÍCH OTÁČEK (1X) z FFT rychlosti
    // Hledáme dominant peak v pásmu 10–80 Hz (600–4800 RPM)
    // Použijeme průměr spekter X, Y, Z pro větší robustnost
    // =====================================================================
    const findOperatingSpeed = (spectra, minF = 10, maxF = 80) => {
      const validSpectra = spectra.filter(s => s && s.length > 0);
      if (validSpectra.length === 0) return null;

      const minBin = Math.floor(minF / freqRes);
      const maxBin = Math.min(Math.floor(maxF / freqRes), validSpectra[0].length - 1);

      let maxAmp = -1;
      let rpmBin = -1;

      for (let i = minBin; i <= maxBin; i++) {
        // Průměrná amplituda ze všech dostupných spekter (X+Y+Z)
        const avgAmp = validSpectra.reduce((sum, s) => sum + (s[i] || 0), 0) / validSpectra.length;
        if (avgAmp > maxAmp) {
          maxAmp = avgAmp;
          rpmBin = i;
        }
      }

      if (rpmBin < 0) return null;
      const freq = +(rpmBin * freqRes).toFixed(2);
      const rpm = Math.round(freq * 60);
      return { freq, rpm, amp: +maxAmp.toFixed(4) };
    };

    const operatingSpeed = findOperatingSpeed([velX, velY, velZ]);

    // =====================================================================
    // TOP PEAKS - pro každou doménu zvlášť
    // =====================================================================
    const findTopPeaks = (spectrum, n = 6, minBin = 1, maxBin = null) => {
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

    // Rychlostní spektra — nízkofrekvenční doména (10–1000 Hz, zaměřeno na 1X, 2X, 3X)
    const peaksVelX = findTopPeaks(velX, 6, Math.floor(2 / freqRes));
    const peaksVelY = findTopPeaks(velY, 6, Math.floor(2 / freqRes));
    const peaksVelZ = findTopPeaks(velZ, 6, Math.floor(2 / freqRes));

    // Zrychlení — vysokofrekvenční doména (zaměření na 500–6000 Hz)
    const peaksAccZ_highFreq = findTopPeaks(accZ, 6, Math.floor(500 / freqRes));
    // A zároveň celkové peaky pro kontext
    const peaksAccZ_all = findTopPeaks(accZ, 6, Math.floor(2 / freqRes));

    // Obálka — ložisková doména (celé spektrum, hledáme interharmonické)
    const peaksEnvZ = findTopPeaks(envZ, 8, Math.floor(2 / freqRes));

    // =====================================================================
    // ANALÝZA HARMONICKÝCH — pro každý peak v obálce určíme, zda je
    // celočíselným násobkem otáček (1X, 2X, 3X...) nebo interharmonický
    // =====================================================================
    const classifyEnvPeak = (peakFreq, rpm1x) => {
      if (!rpm1x || rpm1x <= 0) return "neznámý";
      const ratio = peakFreq / rpm1x;
      const nearestInt = Math.round(ratio);
      const deviation = Math.abs(ratio - nearestInt);
      if (deviation < 0.1 && nearestInt > 0) return `${nearestInt}X RPM`;
      return `interharmonický (${ratio.toFixed(2)}X) — možný ložiskový defekt`;
    };

    const envPeaksClassified = operatingSpeed
      ? peaksEnvZ.map(p => ({
          ...p,
          classification: classifyEnvPeak(p.freq, operatingSpeed.freq)
        }))
      : peaksEnvZ.map(p => ({ ...p, classification: "RPM neznámé" }));

    // =====================================================================
    // STATUS METRIK — co je překročeno?
    // =====================================================================
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

    const exceededLimits = [
      velXZone && velXZone !== "A" ? `RMS Rychlost X: ${rmsVelX?.toFixed(3)} mm/s (pásmo ${velXZone})` : null,
      velYZone && velYZone !== "A" ? `RMS Rychlost Y: ${rmsVelY?.toFixed(3)} mm/s (pásmo ${velYZone})` : null,
      velZZone && velZZone !== "A" ? `RMS Rychlost Z: ${rmsVelZ?.toFixed(3)} mm/s (pásmo ${velZZone})` : null,
      accZZone && accZZone !== "A" ? `RMS Zrychlení Z: ${rmsAccZ?.toFixed(3)} g (pásmo ${accZZone})` : null,
    ].filter(Boolean);

    const formatLimits = (std, type) => {
      if (!std) return "Norma nenastavena";
      if (type === 'vel') return `A/B: ${std.limit_ab} mm/s, B/C: ${std.limit_bc} mm/s, C/D: ${std.limit_cd} mm/s`;
      if (type === 'acc') return `A/B: ${std.acc_limit_ab} g, B/C: ${std.acc_limit_bc} g, C/D: ${std.acc_limit_cd} g`;
      if (type === 'temp') return `A/B: ${std.temp_limit_ab} °C, B/C: ${std.temp_limit_bc} °C, C/D: ${std.temp_limit_cd} °C`;
      return "Neznámá norma";
    };

    // =====================================================================
    // TŘÍDOMÉNOVÝ DIAGNOSTICKÝ PROMPT
    // =====================================================================
    const prompt = `Jsi expert na vibrační diagnostiku rotačních strojů (ISO 10816/20816). Proveď strukturovanou analýzu a napiš zprávu v češtině.

DŮLEŽITÉ UPOZORNĚNÍ: Toto zařízení používá VÝHRADNĚ VALIVÁ LOŽISKA. Veškeré závěry ohledně ložisek musí zohledňovat tento typ — valivá ložiska mají specifické charakteristiky selhání (poškození dráhy, valivých elementů, klece) a projevují se interharmonickými frekvencemi v obálkovém spektru.

STROJ: ${machineName || "Neznámý stroj"}
MĚŘICÍ MÍSTO: ${measurementPoint || "Neznámé"}
DATUM MĚŘENÍ: ${sd.timestamp_unix ? new Date(sd.timestamp_unix * 1000).toLocaleString("cs-CZ") : "Neznámé"}

╔══════════════════════════════════════════════════════════════
║ DETEKOVANÉ PROVOZNÍ PARAMETRY
╚══════════════════════════════════════════════════════════════
${operatingSpeed
  ? `Otáčková frekvence (1X): ${operatingSpeed.freq} Hz = ${operatingSpeed.rpm} RPM (amplituda: ${operatingSpeed.amp} mm/s)
DŮLEŽITÉ: Všechny harmonické frekvence (2X=${(operatingSpeed.freq*2).toFixed(1)} Hz, 3X=${(operatingSpeed.freq*3).toFixed(1)} Hz, 4X=${(operatingSpeed.freq*4).toFixed(1)} Hz) interpretuj s ohledem na tuto otáčkovou frekvenci.`
  : `Otáčková frekvence: Nelze detekovat (spektrum mimo pásmo 10–80 Hz nebo žádná data)`}

╔══════════════════════════════════════════════════════════════
║ STAV METRIK — PŘEKROČENÉ LIMITY
╚══════════════════════════════════════════════════════════════
${exceededLimits.length > 0
  ? exceededLimits.join('\n')
  : "Žádné limity nepřekročeny — všechny hodnoty v pásmu A"}

RMS souhrn (pro referenci):
  Rychlost X: ${rmsVelX?.toFixed(3) ?? "N/A"} mm/s [${velXZone ?? "bez normy"}] (limity: ${formatLimits(velStandard, 'vel')})
  Rychlost Y: ${rmsVelY?.toFixed(3) ?? "N/A"} mm/s [${velYZone ?? "bez normy"}]
  Rychlost Z: ${rmsVelZ?.toFixed(3) ?? "N/A"} mm/s [${velZZone ?? "bez normy"}]
  Zrychlení Z: ${rmsAccZ?.toFixed(3) ?? "N/A"} g [${accZZone ?? "bez normy"}] (limity: ${formatLimits(accStandard, 'acc')})
  Obálka Z: ${rmsEnvZ?.toFixed(3) ?? "N/A"} g (bez normy — slouží k relativnímu hodnocení)
  Teplota: ${sd.temperature ? sd.temperature + " °C" : "N/A"}

╔══════════════════════════════════════════════════════════════
║ BLOK 1: SPEKTRUM RYCHLOSTI — MECHANICKÁ INTEGRITA ROTORU
║ Hledej: 1X (nevývaha), 2X (nesouosost), 3X+ (uvolnění, vůle)
╚══════════════════════════════════════════════════════════════
Dominantní peaky (mm/s):
  Osa X: ${peaksVelX.map(p => `${p.freq} Hz → ${p.amp}`).join(' | ') || "žádné"}
  Osa Y: ${peaksVelY.map(p => `${p.freq} Hz → ${p.amp}`).join(' | ') || "žádné"}
  Osa Z: ${peaksVelZ.map(p => `${p.freq} Hz → ${p.amp}`).join(' | ') || "žádné"}

╔══════════════════════════════════════════════════════════════
║ BLOK 2: SPEKTRUM ZRYCHLENÍ Z — STAV VALIVÝCH LOŽISEK (VYSOKÉ FREQ.)
║ Hledej: modulace 2–3 kHz (počínající defekt valivého ložiska), šum 2–5 kHz (nedostatečné mazání)
╚══════════════════════════════════════════════════════════════
Peaky 500–6000 Hz (g): ${peaksAccZ_highFreq.map(p => `${p.freq} Hz → ${p.amp}`).join(' | ') || "žádné výrazné"}
Celkové peaky (g):     ${peaksAccZ_all.map(p => `${p.freq} Hz → ${p.amp}`).join(' | ') || "žádné"}
RMS 2–6000 Hz: ${rmsAccZ?.toFixed(3) ?? "N/A"} g

╔══════════════════════════════════════════════════════════════
║ BLOK 3: OBÁLKA ZRYCHLENÍ Z — DEFEKTY VALIVÝCH LOŽISEK
║ Celočíselné násobky RPM = uvolnění/vůle. Interharmonické = poškozené dráhy/valivé elementy/klec ložiska.
╚══════════════════════════════════════════════════════════════
Klasifikované peaky (g):
${envPeaksClassified.map(p => `  ${p.freq} Hz → ${p.amp} g [${p.classification}]`).join('\n') || "  Žádné výrazné peaky"}

╔══════════════════════════════════════════════════════════════
║ ÚKOL: DVOUÚROVŇOVÝ ZÁVĚR (jednoduchý + odborný)
╚══════════════════════════════════════════════════════════════
Výstup musí být na dvou úrovních:

ÚROVEŇ 1 (pro techniky bez diagnostické praxe):
- simple_summary: Jednou větou česky co se děje a jak vážné to je. Jasně, srozumitelně, bez odborného žargonu. Příklad: "Ložisko je v pořádku, vibrace jsou nízké." nebo "Valivé ložisko vykazuje první známky opotřebení, doporučujeme zvýšit frekvenci kontrol."
- simple_recommendations: 1–3 konkrétní kroky co má technik udělat. Stručně, akčně. Např: "Zkontrolujte mazání.", "Naplánujte výměnu ložiska do 3 měsíců."

ÚROVEŇ 2 (pro odborníky, zobrazí se po rozbalení):
- Analýza každého bloku zvlášť (rychlost, zrychlení, obálka) s konkrétními zjištěními
- Identifikace harmonických/interharmonických frekvencí v kontextu valivých ložisek
- Detailní technické doporučení s prioritami

Buď konkrétní. Pokud data nejsou dostatečná pro jednoznačný závěr, uveď to.`;

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
              finding: { type: "string", description: "Odborné zjištění ze spektra rychlosti (1X/2X/3X, nevývaha, nesouosost)" },
            }
          },
          domain_acceleration: {
            type: "object",
            properties: {
              status: { type: "string", enum: ["OK", "Pozor", "Alarm", "Kritický", "Nedostatečná data"] },
              finding: { type: "string", description: "Odborné zjištění ze spektra zrychlení (2–5 kHz, stav valivého ložiska)" },
            }
          },
          domain_envelope: {
            type: "object",
            properties: {
              status: { type: "string", enum: ["OK", "Pozor", "Alarm", "Kritický", "Nedostatečná data"] },
              finding: { type: "string", description: "Odborné zjištění z obálky (harmonické/interharmonické, typ defektu valivého ložiska)" },
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
            },
            description: "Odborná zjištění pro diagnostiky"
          },
          next_inspection_recommendation: { type: "string", description: "Kdy provést příští měření" }
        },
        required: ["overall_status", "simple_summary", "simple_recommendations"]
      }
    });

    return Response.json({
      ok: true,
      analysis: result,
      operatingSpeed,
      metrics: { rmsVelX, rmsVelY, rmsVelZ, rmsAccZ, rmsEnvZ },
      peaks: {
        velX: peaksVelX, velY: peaksVelY, velZ: peaksVelZ,
        accZ_highFreq: peaksAccZ_highFreq, accZ_all: peaksAccZ_all,
        envZ: envPeaksClassified
      }
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});