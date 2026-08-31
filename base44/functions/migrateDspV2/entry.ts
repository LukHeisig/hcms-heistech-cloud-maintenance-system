import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// Jednorázová migrace historických dat na DSP v2.
// Přepočet konstantami: zrychlení ×8.87, rychlost/obálka ×0.905.
// Volat opakovaně, dokud done=false.

const K_ACC = 8.87;
const K_VEL = 0.905;
const r3 = (v: number | null, k: number) => (v != null ? Math.round(v * k * 1000) / 1000 : null);

export default async function (req: Request) {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (user?.user_type !== 'superAdmin') {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const db = base44.asServiceRole.entities;
  const started = Date.now();
  let trendMigrated = 0;
  let sensorDataMigrated = 0;
  let fftMigrated = 0;
  let done = false;

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  let throttles = 0;

  while (Date.now() - started < 80000) {
   try {
    const trend = await db.SensorTrendPoint.filter({ dsp_version: null }, null, 500);
    if (trend.length > 0) {
      await db.SensorTrendPoint.bulkUpdate(trend.map((p: any) => ({
        id: p.id,
        dsp_version: 2,
        rms_z_g: r3(p.rms_z_g, K_ACC),
        vel_rms_x_mm_s: r3(p.vel_rms_x_mm_s, K_VEL),
        vel_rms_y_mm_s: r3(p.vel_rms_y_mm_s, K_VEL),
        vel_rms_z_mm_s: r3(p.vel_rms_z_mm_s, K_VEL),
        env_rms_z: r3(p.env_rms_z, K_VEL),
      })));
      trendMigrated += trend.length;
      continue;
    }

    const sd = await db.SensorData.filter({ dsp_version: null }, null, 300);
    if (sd.length > 0) {
      const validTs = (t: any) => typeof t === 'number' && t > 1500000000 && t < 4000000000;
      await db.SensorData.bulkUpdate(sd.map((p: any) => ({
        id: p.id,
        dsp_version: 2,
        recorded_at: p.recorded_at || (validTs(p.timestamp_unix) ? new Date(p.timestamp_unix * 1000).toISOString() : p.created_date),
        rms_z_g: r3(p.rms_z_g, K_ACC),
        oa_acc_z: r3(p.oa_acc_z, K_ACC),
        vel_rms_x_mm_s: r3(p.vel_rms_x_mm_s, K_VEL),
        vel_rms_y_mm_s: r3(p.vel_rms_y_mm_s, K_VEL),
        vel_rms_z_mm_s: r3(p.vel_rms_z_mm_s, K_VEL),
        env_rms_z: r3(p.env_rms_z, K_VEL),
      })));
      sensorDataMigrated += sd.length;
      continue;
    }

    const fft = await db.SensorFFTData.filter({ dsp_version: null }, null, 300);
    if (fft.length > 0) {
      await db.SensorFFTData.bulkUpdate(fft.map((p: any) => ({
        id: p.id,
        dsp_version: 2,
        oa_x: r3(p.oa_x, K_VEL),
        oa_y: r3(p.oa_y, K_VEL),
        oa_z: r3(p.oa_z, K_VEL),
        oa_acc_z: r3(p.oa_acc_z, K_ACC),
      })));
      fftMigrated += fft.length;
      continue;
    }

    done = true;
    break;
   } catch (e) {
    // typicky 429 (limit objemu čtení) — počkat a zkusit znovu
    throttles++;
    console.log(`[Migrace] throttle #${throttles}: ${e.message}`);
    if (throttles > 12) break;
    await sleep(10000);
   }
  }

  return Response.json({ ok: true, done, throttles, trendMigrated, sensorDataMigrated, fftMigrated });
}