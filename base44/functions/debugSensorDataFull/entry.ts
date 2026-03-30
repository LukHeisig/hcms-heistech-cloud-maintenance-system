import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch last record with has_raw=true
    const records = await base44.entities.SensorData.filter({ has_raw: true }, "-created_date", 1);
    
    if (records.length === 0) {
      return Response.json({ error: 'No raw data found' }, { status: 404 });
    }
    
    const record = records[0];
    console.log("[debugSensorDataFull] Record ID:", record.id);
    console.log("[debugSensorDataFull] has_raw:", record.has_raw);
    console.log("[debugSensorDataFull] raw_x_json present:", !!record.raw_x_json);
    console.log("[debugSensorDataFull] raw_y_json present:", !!record.raw_y_json);
    console.log("[debugSensorDataFull] raw_z_json present:", !!record.raw_z_json);
    console.log("[debugSensorDataFull] raw_x_json length:", record.raw_x_json ? record.raw_x_json.length : 0);
    console.log("[debugSensorDataFull] Metrics:", {
      rms_z_g: record.rms_z_g,
      peak_z_g: record.peak_z_g,
      vel_rms_z_mm_s: record.vel_rms_z_mm_s,
      env_rms_z: record.env_rms_z,
    });
    
    // Try to parse raw data
    if (record.raw_x_json) {
      try {
        const parsed = JSON.parse(record.raw_x_json);
        console.log("[debugSensorDataFull] raw_x parsed, length:", parsed.length);
      } catch (e) {
        console.error("[debugSensorDataFull] Failed to parse raw_x:", e.message);
      }
    }
    
    return Response.json({ 
      ok: true, 
      record_id: record.id,
      has_metrics: !!(record.rms_z_g || record.vel_rms_z_mm_s || record.env_rms_z),
      has_raw_arrays: !!(record.raw_x_json && record.raw_y_json && record.raw_z_json),
    });
  } catch (error) {
    console.error("debugSensorDataFull error:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});