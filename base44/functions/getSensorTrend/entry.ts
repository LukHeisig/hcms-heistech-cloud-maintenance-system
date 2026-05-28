import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Vrátí agregovaná trendová data pro senzor — jen číselné hodnoty, bez JSON spekter
// Payload: { sensor_id, days, limit, is_temperature }
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { sensor_id, days, limit = 2000, is_temperature = false } = await req.json();
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
      if (ts) {
        return new Date(ts * 1000).toLocaleString("cs-CZ", {
          day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
          timeZone: "Europe/Prague"
        }).replace(",", "");
      }
      return new Date(created_date).toLocaleString("cs-CZ", {
        day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
        timeZone: "Europe/Prague"
      }).replace(",", "");
    };

    const getRecordTime = (r) => {
      const ts = validTs(r.timestamp_unix);
      return ts ?? (new Date(r.created_date).getTime() / 1000);
    };

    if (is_temperature) {
      const records = await base44.asServiceRole.entities.SensorData.filter(
        { sensor_id },
        "-created_date",
        limit
      );
      const filtered = records
        .filter(r => r.temperature != null)
        .filter(r => cutoffSec == null || getRecordTime(r) >= cutoffSec)
        .reverse()
        .map(r => ({
          ts: formatTs(r.timestamp_unix, r.created_date),
          sensor_data_id: r.id,
          temperature: r.temperature,
        }));
      return Response.json({ data: filtered });
    }

    // FFT trend — načteme jen OA hodnoty z SensorFFTData (bez JSON spekter — ta jsou velká)
    // Uděláme to přes SensorData kde has_fft=true, a OA hodnoty jsou tam uloženy přímo
    const records = await base44.asServiceRole.entities.SensorData.filter(
      { sensor_id, has_fft: true },
      "-created_date",
      limit
    );

    const filtered = records
      .filter(r => cutoffSec == null || getRecordTime(r) >= cutoffSec)
      .reverse()
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

    return Response.json({ data: filtered });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});