import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Backfill SensorTrendPoint from existing SensorData records.
// Uses created_date (server receive time) as timestamp — NOT sensor's timestamp_unix (often corrupted).
// Call with { start_offset: 0 } and increment by ~200 each batch.

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { start_offset = 0, batch_size = 200 } = await req.json();

    // Fetch batch of SensorData records with FFT data (these have RMS metrics)
    const records = await base44.asServiceRole.entities.SensorData.filter(
      { has_fft: true },
      "created_date",
      batch_size,
      start_offset
    );

    let created = 0;
    let skipped = 0;

    for (const r of records) {
      // Skip records without valid RMS values
      if (!r.vel_rms_x_mm_s && !r.vel_rms_y_mm_s && !r.vel_rms_z_mm_s) {
        skipped++;
        continue;
      }
      // Use created_date (server time) converted to unix seconds
      const ts = Math.floor(new Date(r.created_date).getTime() / 1000);

      await base44.asServiceRole.entities.SensorTrendPoint.create({
        sensor_id: r.sensor_id,
        sensor_data_id: r.id,
        timestamp_unix: ts,
        vel_rms_x_mm_s: r.vel_rms_x_mm_s ?? null,
        vel_rms_y_mm_s: r.vel_rms_y_mm_s ?? null,
        vel_rms_z_mm_s: r.vel_rms_z_mm_s ?? null,
        rms_z_g: r.rms_z_g ?? null,
        env_rms_z: r.env_rms_z ?? null,
        temperature: r.temperature ?? null,
      });
      created++;

      if ((start_offset + created + skipped) % 20 === 0) {
        console.log(`Processed ${start_offset + created + skipped} records, created=${created}, skipped=${skipped}`);
      }
    }

    return Response.json({
      ok: true,
      start_offset,
      fetched: records.length,
      created,
      skipped,
      next_offset: start_offset + records.length,
      done: records.length < batch_size,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});