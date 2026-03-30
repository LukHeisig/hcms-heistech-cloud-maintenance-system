import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch last 10 records with all fields
    const records = await base44.entities.SensorData.list("-created_date", 10);
    
    console.log("[debugSensorData] Total records fetched:", records.length);
    
    const summary = records.map(r => ({
      id: r.id,
      sensor_id: r.sensor_id,
      report_type: r.report_type,
      has_raw: r.has_raw,
      rms_z_g: r.rms_z_g,
      peak_z_g: r.peak_z_g,
      vel_rms_x_mm_s: r.vel_rms_x_mm_s,
      vel_rms_y_mm_s: r.vel_rms_y_mm_s,
      vel_rms_z_mm_s: r.vel_rms_z_mm_s,
      env_rms_z: r.env_rms_z,
      created_date: r.created_date,
    }));
    
    console.log("[debugSensorData] Summary:", JSON.stringify(summary, null, 2));
    
    return Response.json({ 
      ok: true, 
      total: records.length,
      summary 
    });
  } catch (error) {
    console.error("debugSensorData error:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});