import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { secrets } from 'base44:runtime';

// Webhook pro OPC UA bridge (ifm VSE jednotky).
// Autentizace: hlavička "Authorization: Bearer <OPC_UA_WEBHOOK_TOKEN>".
// Payload (JSON):
// {
//   "unit_id": "VSE-01",                 // povinné
//   "unit_name": "Čerpadlo P1",          // volitelné
//   "endpoint": "opc.tcp://10.0.0.5:4840", // volitelné
//   "timestamp": "2026-09-18T05:30:00Z", // volitelné
//   "values": [ { "node_id": "ns=2;s=...", "name": "v-RMS Ch1", "value": 1.23, "unit": "mm/s" } ]
//   // nebo "values": { "v_rms_ch1": 1.23, "temp": 41.5 }
// }

function normalizeValues(values) {
  if (Array.isArray(values)) {
    return values.map((v) => ({
      node_id: v.node_id ?? v.nodeId ?? null,
      name: v.name ?? v.node_id ?? v.nodeId ?? 'value',
      value: v.value,
      unit: v.unit ?? null,
      timestamp: v.timestamp ?? null,
      status: v.status ?? null,
    }));
  }
  if (values && typeof values === 'object') {
    return Object.entries(values).map(([name, value]) => ({ node_id: null, name, value, unit: null }));
  }
  return null;
}

export default async function (req) {
  try {
    if (req.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }

    const base44 = createClientFromRequest(req);

    const expected = secrets.get('OPC_UA_WEBHOOK_TOKEN');
    const authHeader = req.headers.get('Authorization') || '';
    const tokenOk = expected && authHeader === `Bearer ${expected}`;

    let userOk = false;
    if (!tokenOk) {
      const user = await base44.auth.me().catch(() => null);
      userOk = !!user && user.user_type === 'superAdmin';
    }
    if (!tokenOk && !userOk) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let payload;
    try {
      payload = await req.json();
    } catch (_e) {
      return Response.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const unitId = payload.unit_id || payload.unitId || payload.device_id;
    if (!unitId) {
      return Response.json({ error: 'Missing unit_id' }, { status: 400 });
    }

    const values = normalizeValues(payload.values);
    if (!values || values.length === 0) {
      return Response.json({ error: 'Missing or empty values' }, { status: 400 });
    }

    const ts = payload.timestamp ? new Date(payload.timestamp) : new Date();
    const recordedAt = isNaN(ts.getTime()) ? new Date().toISOString() : ts.toISOString();
    const valuesJson = JSON.stringify(values);

    const db = base44.asServiceRole.entities;

    const reading = await db.VseReading.create({
      unit_id: unitId,
      recorded_at: recordedAt,
      values_json: valuesJson,
      values_count: values.length,
      raw_json: JSON.stringify(payload),
    });

    const existing = await db.VseUnit.filter({ unit_id: unitId }, null, 1);
    const unitUpdate = {
      last_seen: recordedAt,
      last_values_json: valuesJson,
    };
    if (payload.endpoint) unitUpdate.endpoint = payload.endpoint;

    let unitRecordId;
    if (existing.length > 0) {
      const u = existing[0];
      unitRecordId = u.id;
      await db.VseUnit.update(u.id, {
        ...unitUpdate,
        messages_total: (u.messages_total || 0) + 1,
        ...(u.name ? {} : payload.unit_name ? { name: payload.unit_name } : {}),
      });
    } else {
      const created = await db.VseUnit.create({
        unit_id: unitId,
        name: payload.unit_name || unitId,
        ...unitUpdate,
        messages_total: 1,
        is_active: true,
      });
      unitRecordId = created.id;
    }

    return Response.json({
      status: 'success',
      unit_id: unitId,
      unit_record_id: unitRecordId,
      reading_id: reading.id,
      values_count: values.length,
      recorded_at: recordedAt,
    });
  } catch (error) {
    console.error('[opcUaWebhook] error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}