import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// AI analýza FFT spekter a celkových hodnot vibračního senzoru
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { sensorDataId, velStandard, accStandard, tempStandard, machineName, measurementPoint } = body;

    if (!sensorDataId) return Response.json({ error: 'Missing sensorDataId' }, { status: 400 });

    // Načteme SensorData
    const sensorRecords = await base44.asServiceRole.entities.SensorData.filter({ id: sensorDataId });
    const sd = sensorRecords[0];
    if (!sd) return Response.json({ error: 'SensorData not found' }, { status: 404 });

    // Načteme FFT data
    const fftRecords = await base44.asServiceRole.entities.SensorFFTData.filter({ sensor_data_id: sensorDataId });
    const fft = fftRecords[0];
    if (!fft) return Response.json({ error: 'FFT data not found' }, { status: 404 });

    const freqRes = fft.frequency_resolution || 3.259;

    // Helper: výpočet RMS ze spektra
    const calcRMS = (arr, minF, maxF) => {
      if (!arr || !arr.length) return null;
      let sumSq = 0;
      for (let i = 0; i < arr.length; i++) {
        const f = i * freqRes;
        if (f >= minF && f <= maxF && f > 0) sumSq += arr[i] * arr[i];
      }
      return Math.sqrt(sumSq / 2);
    };

    // Parse spektra
    const velX = fft.vel_x_json ? JSON.parse(fft.vel_x_json) : [];
    const velY = fft.vel_y_json ? JSON.parse(fft.vel_y_json) : [];
    const velZ = fft.vel_z_json ? JSON.parse(fft.vel_z_json) : [];
    const accZ = fft.acc_z_json ? JSON.parse(fft.acc_z_json) : [];
    const envZ = fft.env_z_json ? JSON.parse(fft.env_z_json) : [];

    const rmsVelX = calcRMS(velX, 2, 1000);
    const rmsVelY = calcRMS(velY, 2, 1000);
    const rmsVelZ = calcRMS(velZ, 2, 1000);
    const rmsAccZ = calcRMS(accZ, 2, 6000);
    const rmsEnvZ = calcRMS(envZ, 2, 1000);

    // Najdi dominantní frekvence v každém spektru (top 5 peaků)
    const findTopPeaks = (spectrum, n = 5, minBin = 1) => {
      if (!spectrum || spectrum.length < 3) return [];
      const candidates = [];
      for (let i = minBin + 1; i < spectrum.length - 1; i++) {
        if (spectrum[i] > spectrum[i - 1] && spectrum[i] > spectrum[i + 1]) {
          candidates.push({ freq: +(i * freqRes).toFixed(1), amp: +spectrum[i].toFixed(4) });
        }
      }
      return candidates.sort((a, b) => b.amp - a.amp).slice(0, n);
    };

    const peaksVelX = findTopPeaks(velX);
    const peaksVelY = findTopPeaks(velY);
    const peaksVelZ = findTopPeaks(velZ);
    const peaksAccZ = findTopPeaks(accZ);
    const peaksEnvZ = findTopPeaks(envZ);

    // Definuj pásma limitů pro AI
    const formatLimits = (std, type) => {
      if (!std) return "Norma nenastavena";
      if (type === 'vel') return `A/B: ${std.limit_ab} mm/s, B/C: ${std.limit_bc} mm/s, C/D: ${std.limit_cd} mm/s`;
      if (type === 'acc') return `A/B: ${std.acc_limit_ab} g, B/C: ${std.acc_limit_bc} g, C/D: ${std.acc_limit_cd} g`;
      if (type === 'temp') return `A/B: ${std.temp_limit_ab} °C, B/C: ${std.temp_limit_bc} °C, C/D: ${std.temp_limit_cd} °C`;
      return "Neznámá norma";
    };

    const getLimitZone = (value, std, type) => {
      if (!value || !std) return "Neznámé";
      let a, b, c;
      if (type === 'vel') { a = std.limit_ab; b = std.limit_bc; c = std.limit_cd; }
      else if (type === 'acc') { a = std.acc_limit_ab; b = std.acc_limit_bc; c = std.acc_limit_cd; }
      else return "Neznámé";
      if (!a) return "Neznámé";
      if (value < a) return "A (OK)";
      if (value < b) return "B (Pozor)";
      if (value < c) return "C (Alarm)";
      return "D (Kritické)";
    };

    const prompt = `Jsi expert na vibrační diagnostiku strojů. Proveď odbornou analýzu následujících vibračních dat a napiš zprávu v češtině.

STROJ: ${machineName || "Neznámý stroj"}
MĚŘICÍ MÍSTO: ${measurementPoint || "Neznámé"}
DATUM MĚŘENÍ: ${sd.timestamp_unix ? new Date((sd.timestamp_unix + 3600) * 1000).toLocaleString("cs-CZ") : "Neznámé"}

=== CELKOVÉ RMS HODNOTY ===
Rychlost vibrací (2-1000 Hz):
  - Osa X: ${rmsVelX?.toFixed(3) ?? "N/A"} mm/s → pásmo ${getLimitZone(rmsVelX, velStandard, 'vel')} (limity: ${formatLimits(velStandard, 'vel')})
  - Osa Y: ${rmsVelY?.toFixed(3) ?? "N/A"} mm/s → pásmo ${getLimitZone(rmsVelY, velStandard, 'vel')}
  - Osa Z: ${rmsVelZ?.toFixed(3) ?? "N/A"} mm/s → pásmo ${getLimitZone(rmsVelZ, velStandard, 'vel')}
Zrychlení RMS Z (2-6000 Hz): ${rmsAccZ?.toFixed(3) ?? "N/A"} g → pásmo ${getLimitZone(rmsAccZ, accStandard, 'acc')} (limity: ${formatLimits(accStandard, 'acc')})
Obálka RMS Z (2-1000 Hz): ${rmsEnvZ?.toFixed(3) ?? "N/A"} g

Teplota senzoru: ${sd.temperature ? sd.temperature + " °C" : "N/A"}

=== DOMINANTNÍ FREKVENCE ===
Spektrum rychlosti X (top 5 peaků):
${peaksVelX.map(p => `  ${p.freq} Hz: ${p.amp} mm/s`).join('\n') || "  Žádné výrazné peaky"}

Spektrum rychlosti Y (top 5 peaků):
${peaksVelY.map(p => `  ${p.freq} Hz: ${p.amp} mm/s`).join('\n') || "  Žádné výrazné peaky"}

Spektrum rychlosti Z (top 5 peaků):
${peaksVelZ.map(p => `  ${p.freq} Hz: ${p.amp} mm/s`).join('\n') || "  Žádné výrazné peaky"}

Spektrum zrychlení Z (top 5 peaků):
${peaksAccZ.map(p => `  ${p.freq} Hz: ${p.amp} g`).join('\n') || "  Žádné výrazné peaky"}

Spektrum obálky Z (top 5 peaků - ložiskové frekvence):
${peaksEnvZ.map(p => `  ${p.freq} Hz: ${p.amp} g`).join('\n') || "  Žádné výrazné peaky"}

=== ÚKOL ===
Proveď odbornou analýzu těchto vibračních dat. Zaměř se na:
1. Celkové hodnocení stavu stroje dle pásem normy
2. Identifikaci možných příčin dominantních frekvencí (nevývaha, nesouosost, ložiskové závady, rezonance, záběrové frekvence ozubení atd.)
3. Doporučení konkrétních kroků pro obsluhu/údržbu
4. Predikci trendu pokud jsou hodnoty blízko limitů

Odpověz strukturovaně, stručně a prakticky. Vyhni se zbytečnému opakování čísel.`;

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      model: "claude_sonnet_4_6",
      response_json_schema: {
        type: "object",
        properties: {
          overall_status: { type: "string", enum: ["OK", "Pozor", "Alarm", "Kritický"] },
          overall_summary: { type: "string", description: "Stručné celkové hodnocení (2-3 věty)" },
          findings: { 
            type: "array",
            items: { type: "object", properties: { title: { type: "string" }, detail: { type: "string" }, severity: { type: "string", enum: ["info", "warning", "alarm", "critical"] } } }
          },
          recommendations: { 
            type: "array", 
            items: { type: "string" },
            description: "Konkrétní doporučená opatření"
          },
          frequency_analysis: { type: "string", description: "Interpretace dominantních frekvencí — možné zdroje" },
          next_inspection_recommendation: { type: "string", description: "Doporučení termínu příštího měření" }
        },
        required: ["overall_status", "overall_summary", "findings", "recommendations"]
      }
    });

    return Response.json({
      ok: true,
      analysis: result,
      metrics: { rmsVelX, rmsVelY, rmsVelZ, rmsAccZ, rmsEnvZ },
      peaks: { velX: peaksVelX, velY: peaksVelY, velZ: peaksVelZ, accZ: peaksAccZ, envZ: peaksEnvZ }
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});