import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

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
// threshold = 1% průměrné hodnoty / krok
function slopeToDirection(slope, values) {
  const avg = values.reduce((a, b) => a + b, 0) / values.length || 1;
  const threshold = avg * 0.01; // 1% průměru
  if (slope > threshold) return "up";
  if (slope < -threshold) return "down";
  return "stable";
}

// Vrátí trendová data — z SensorData (malé záznamy, žádná spektra)
// report_type=1 jsou FFT záznamy s vel_rms hodnotami
// Payload: { sensor_id, days, limit, is_temperature, trend_only }
//   trend_only=true → vrátí pouze směry trendu (posledních 10 vzorků), bez plných dat
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { sensor_id, days, limit = 500, is_temperature = false, trend_only = false } = await req.json();
    if (!sensor_id) return Response.json({ error: 'sensor_id required' }, { status: 400 });

    const cutoffSec = days != null ? (Date.now() / 1000) - (days * 86400) : null;

    const validTs = (ts) => {
      if (!ts) return null;
      const now = Date.now() / 1000;
      if (ts > now + 86400 || ts < 0) return null;
      return ts;
    };

    const formatTs = (timestamp_unix, created_date) => {
      const ts = validTs(timestamp_unix);
      const date = ts ? new Date(ts * 1000) : new Date(created_date);
      return date.toLocaleString("cs-CZ", {
        day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
        timeZone: "Europe/Prague"
      }).replace(",", "");
    };

    const getRecordTime = (r) => {
      const ts = validTs(r.timestamp_unix);
      return ts ?? (new Date(r.created_date).getTime() / 1000);
    };

    // SensorData záznamy jsou malé (bez spekter) — filtrujeme na report_type=1 (FFT)
    // report_type=0 jsou Raw záznamy — ty mají vel_rms spočítané ze surových dat
    const allRecords = await base44.asServiceRole.entities.SensorData.filter(
      { sensor_id },
      "-created_date",
      limit
    );
    
    // SDK compound filter může být nespolehlivý — filtrujeme v kódu
    // report_type 0=Raw (má vel_rms), 1=FFT (má vel_rms), has_fft=true
    const records = allRecords.filter(r => 
      r.sensor_id === sensor_id && (r.report_type === 0 || r.report_type === 1 || r.has_fft)
    );



    const filtered = records
      .filter(r => cutoffSec == null || getRecordTime(r) >= cutoffSec)
      .reverse();

    // trend_only: vrátí pouze směr trendu z posledních 10 vzorků (levné volání)
    if (trend_only) {
      const last10 = filtered.slice(-10);

      if (is_temperature) {
        const temps = last10.map(r => r.temperature).filter(v => v != null && v !== 28.0);
        return Response.json({
          trends: { temperature: temps.length >= 2 ? slopeToDirection(linearRegressionSlope(temps), temps) : "stable" }
        });
      }

      const extract = (key) => last10.map(r => r[key]).filter(v => v != null);
      const trend = (key) => {
        const vals = extract(key);
        return vals.length >= 2 ? slopeToDirection(linearRegressionSlope(vals), vals) : "stable";
      };

      return Response.json({
        trends: {
          vel_rms_x_mm_s: trend("vel_rms_x_mm_s"),
          vel_rms_y_mm_s: trend("vel_rms_y_mm_s"),
          vel_rms_z_mm_s: trend("vel_rms_z_mm_s"),
          oa_acc_z: trend("oa_acc_z"),
          env_rms_z: trend("env_rms_z"),
          temperature: trend("temperature"),
        }
      });
    }

    if (is_temperature) {
      return Response.json({
        data: filtered
          .filter(r => r.temperature != null && r.temperature !== 28.0)
          .map(r => ({
            ts: formatTs(r.timestamp_unix, r.created_date),
            sensor_data_id: r.id,
            temperature: r.temperature,
          }))
      });
    }

    const data = filtered
      .map(r => ({
        ts: formatTs(r.timestamp_unix, r.created_date),
        sensor_data_id: r.id,
        vel_rms_x_mm_s: r.vel_rms_x_mm_s ?? null,
        vel_rms_y_mm_s: r.vel_rms_y_mm_s ?? null,
        vel_rms_z_mm_s: r.vel_rms_z_mm_s ?? null,
        oa_acc_z: r.oa_acc_z ?? null,
        env_rms_z: r.env_rms_z ?? null,
      }))
      .filter(r =>
        r.vel_rms_x_mm_s != null || r.vel_rms_y_mm_s != null || r.vel_rms_z_mm_s != null ||
        r.oa_acc_z != null || r.env_rms_z != null
      );

    return Response.json({ data });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});