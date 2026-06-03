import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Lineární regrese — vrátí sklon (slope) přímky pro pole hodnot
function linearRegressionSlope(values) {
  const n = values.length;
  if (n < 2) return 0;
  const meanX = (n - 1) / 2;
  const meanY = values.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - meanX) * (values[i] - meanY);
    den += (i - meanX) ** 2;
  }
  return den === 0 ? 0 : num / den;
}

// Převede sklon na směr trendu
function slopeToDirection(slope, values, thresholdPct = 20) {
  const avg = values.reduce((a, b) => a + b, 0) / values.length || 1;
  const threshold = avg * (thresholdPct / 100);
  if (slope > threshold) return "up";
  if (slope < -threshold) return "down";
  return "stable";
}

// RMS ze spektrálních dat ve frekvenčním rozsahu — stejná logika jako VibrationCardMQTT
function calcRMS(amps, freqRes, minF, maxF) {
  if (!amps || !amps.length) return null;
  let sumSq = 0;
  for (let i = 0; i < amps.length; i++) {
    const f = i * freqRes;
    if (f >= minF && f <= maxF && f > 0) sumSq += amps[i] * amps[i];
  }
  return Math.sqrt(sumSq / 2);
}

function formatTs(created_date) {
  const date = new Date(created_date);
  return date.toLocaleString("cs-CZ", {
    day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
    timeZone: "Europe/Prague"
  }).replace(",", "");
}

// Payload: { sensor_id, days, limit, is_temperature, trend_only }
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { sensor_id, days, limit = 500, is_temperature = false, trend_only = false } = await req.json();
    if (!sensor_id) return Response.json({ error: 'sensor_id required' }, { status: 400 });

    // Načteme práh trendu z nastavení (default 20%)
    let thresholdPct = 20;
    try {
      const mqttSettings = await base44.asServiceRole.entities.MqttSettings.list(null, 1);
      if (mqttSettings[0]?.trend_threshold_percent != null) {
        thresholdPct = mqttSettings[0].trend_threshold_percent;
      }
    } catch (_) { /* použijeme default */ }

    const cutoffSec = days != null ? (Date.now() / 1000) - (days * 86400) : null;

    // === TEPLOTA — čteme přímo ze SensorData ===
    if (is_temperature) {
      const allRecords = await base44.asServiceRole.entities.SensorData.filter(
        { sensor_id },
        "-created_date",
        limit
      );
      const records = allRecords
        .filter(r => r.sensor_id === sensor_id)
        .filter(r => cutoffSec == null || new Date(r.created_date).getTime() / 1000 >= cutoffSec)
        .reverse();

      if (trend_only) {
        const last10 = records.slice(-10);
        const temps = last10.map(r => r.temperature).filter(v => v != null && v !== 28.0);
        return Response.json({
          trends: { temperature: temps.length >= 2 ? slopeToDirection(linearRegressionSlope(temps), temps, thresholdPct) : "stable" }
        });
      }

      return Response.json({
        data: records
          .filter(r => r.temperature != null && r.temperature !== 28.0)
          .map(r => ({
            ts: formatTs(r.created_date),
            sensor_data_id: r.id,
            temperature: r.temperature,
          }))
      });
    }

    // === VIBRACE — načítáme SensorData se has_fft=true a přepočítáváme ze spekter ===
    // (stejná logika jako VibrationCardMQTT / latestSensorData)
    const allRecords = await base44.asServiceRole.entities.SensorData.filter(
      { sensor_id, has_fft: true },
      "-created_date",
      limit
    );

    const records = allRecords
      .filter(r => r.sensor_id === sensor_id)
      .filter(r => cutoffSec == null || new Date(r.created_date).getTime() / 1000 >= cutoffSec)
      .reverse();

    // Pro každý SensorData záznam načti FFT a přepočítej RMS
    const computed = await Promise.all(records.map(async (r) => {
      try {
        const fftRecs = await base44.asServiceRole.entities.SensorFFTData.filter({ sensor_data_id: r.id });
        const fft = fftRecs[0];
        if (!fft) {
          // Fallback: použij uložené hodnoty pokud nejsou FFT data
          return {
            ts: formatTs(r.created_date),
            sensor_data_id: r.id,
            vel_rms_x_mm_s: r.vel_rms_x_mm_s ?? null,
            vel_rms_y_mm_s: r.vel_rms_y_mm_s ?? null,
            vel_rms_z_mm_s: r.vel_rms_z_mm_s ?? null,
            oa_acc_z: r.oa_acc_z ?? null,
            env_rms_z: r.env_rms_z ?? null,
          };
        }
        const freqRes = fft.frequency_resolution || 3.259;
        const velX = fft.vel_x_json ? JSON.parse(fft.vel_x_json) : [];
        const velY = fft.vel_y_json ? JSON.parse(fft.vel_y_json) : [];
        const velZ = fft.vel_z_json ? JSON.parse(fft.vel_z_json) : [];
        const accZ = fft.acc_z_json ? JSON.parse(fft.acc_z_json) : [];
        const envZ = fft.env_z_json ? JSON.parse(fft.env_z_json) : [];

        return {
          ts: formatTs(r.created_date),
          sensor_data_id: r.id,
          vel_rms_x_mm_s: calcRMS(velX, freqRes, 2, 1000),
          vel_rms_y_mm_s: calcRMS(velY, freqRes, 2, 1000),
          vel_rms_z_mm_s: calcRMS(velZ, freqRes, 2, 1000),
          oa_acc_z: calcRMS(accZ, freqRes, 2, 6000),
          env_rms_z: calcRMS(envZ, freqRes, 2, 1000),
        };
      } catch (_) {
        return null;
      }
    }));

    const data = computed.filter(r =>
      r != null && (
        r.vel_rms_x_mm_s != null || r.vel_rms_y_mm_s != null || r.vel_rms_z_mm_s != null ||
        r.oa_acc_z != null || r.env_rms_z != null
      )
    );

    if (trend_only) {
      const last10 = data.slice(-10);
      const extract = (key) => last10.map(r => r[key]).filter(v => v != null);
      const trend = (key) => {
        const vals = extract(key);
        return vals.length >= 2 ? slopeToDirection(linearRegressionSlope(vals), vals, thresholdPct) : "stable";
      };
      return Response.json({
        trends: {
          vel_rms_x_mm_s: trend("vel_rms_x_mm_s"),
          vel_rms_y_mm_s: trend("vel_rms_y_mm_s"),
          vel_rms_z_mm_s: trend("vel_rms_z_mm_s"),
          oa_acc_z: trend("oa_acc_z"),
          env_rms_z: trend("env_rms_z"),
          temperature: "stable",
        }
      });
    }

    return Response.json({ data });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});