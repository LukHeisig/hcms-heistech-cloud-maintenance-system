import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { canAccessSensor } from '../../shared/access.ts';
import { computeUnbalance } from '../../shared/unbalance.ts';
import { predictUnbalance } from '../../shared/unbalanceTrend.ts';

// Vrátí aktuální míru nevývahy pro všechna ložiska (přiřazené snímače) stroje
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { machineId, sensorId, days } = await req.json();
    if (!machineId) return Response.json({ error: 'Missing machineId' }, { status: 400 });

    const db = base44.asServiceRole.entities;
    const machine = (await db.Machine.filter({ id: machineId }, null, 1))[0];
    if (!machine) return Response.json({ error: 'Machine not found' }, { status: 404 });
    if (!machine.unbalance_enabled) return Response.json({ enabled: false, items: [] });

    const assignments = (await db.VibrationSensorAssignment.filter({ machine_id: machineId }, null, 100))
      .filter((a) => a.sensor_id);
    if (!assignments.length) return Response.json({ enabled: true, items: [] });
    if (!(await canAccessSensor(base44, user, assignments[0].sensor_id))) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const threshold = machine.unbalance_threshold_mm_s || 2.8;
    const runThr = machine.motohours_threshold_mm_s ?? 0.3;

    // Trend jednoho snímače + predikce (7–90 dní)
    if (sensorId) {
      if (!assignments.some((a) => a.sensor_id === sensorId)) return Response.json({ error: 'Forbidden' }, { status: 403 });
      const d = Math.min(90, Math.max(7, Number(days) || 30));
      let from = Math.floor(Date.now() / 1000) - d * 86400;
      if (machine.vibration_history_from) from = Math.max(from, Math.floor(new Date(machine.vibration_history_from).getTime() / 1000));
      const ffts = await db.SensorFFTData.filter({ sensor_id: sensorId, timestamp_unix: { $gte: from } }, '-timestamp_unix', 400);
      ffts.reverse();
      const points = ffts.map((f) => computeUnbalance(f, threshold, runThr)).filter((r) => r && r.running)
        .map((r) => ({ t: r.timestamp_unix, amp: r.amp, percent: r.percent }));
      return Response.json({ threshold, days: d, points, prediction: predictUnbalance(points) });
    }

    const items = [];
    for (const a of assignments) {
      const fft = (await db.SensorFFTData.filter({ sensor_id: a.sensor_id }, '-timestamp_unix', 1))[0];
      const r = fft ? computeUnbalance(fft, threshold, runThr) : null;
      items.push({ sensor_id: a.sensor_id, schema_row_index: a.schema_row_index, ...(r || {}), has_data: !!r });
    }
    return Response.json({ enabled: true, threshold, items });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}