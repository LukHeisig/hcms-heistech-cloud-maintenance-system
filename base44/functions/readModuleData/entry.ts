import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { allowedCompanyIds, isSuperAdmin } from '../../shared/access.ts';

// Jediná brána pro data modulu Vibrodiagnostika.
// Přímé čtení těchto entit je v RLS povoleno jen superAdminovi; ostatní jdou přes tuto funkci,
// která ověří zapnutý modul podniku a omezí data na stroje/senzory podniků uživatele.

// entita → pole, podle kterého se omezuje rozsah (sensor / machine / unit)
const ENTITIES = {
  AissensSensor: { key: 'sensor_id', scope: 'sensors' },
  SensorData: { key: 'sensor_id', scope: 'sensors' },
  SensorFFTData: { key: 'sensor_id', scope: 'sensors' },
  SensorTrendPoint: { key: 'sensor_id', scope: 'sensors' },
  MqttMessage: { key: 'sensor_id', scope: 'sensors' },
  VibrationAlert: { key: 'machine_id', scope: 'machines' },
  VibrationSensorAssignment: { key: 'machine_id', scope: 'machines' },
  VseUnit: { key: 'machine_id', scope: 'machines' },
  VseReading: { key: 'unit_id', scope: 'units' },
};

// Povolené zápisy přes bránu: entita → operace → role
const MANAGERS = ['admin', 'manager'];
const WRITES = {
  VibrationAlert: { update: ['admin', 'manager', 'technician'] },
  VibrationSensorAssignment: { create: MANAGERS, update: MANAGERS },
};

async function loadScope(db, user) {
  const allowed = allowedCompanyIds(user);
  if (!allowed.length) return { machines: [], sensors: [], units: [] };
  const companies = await db.Company.filter({ id: { $in: allowed } }, null, 1000);
  const companyIds = companies.filter((c) => c.enable_vibration === true).map((c) => c.id);
  if (!companyIds.length) return { machines: [], sensors: [], units: [] };
  const lines = await db.Line.filter({ company_id: { $in: companyIds } }, null, 5000);
  const machines = lines.length
    ? (await db.Machine.filter({ line_id: { $in: lines.map((l) => l.id) } }, null, 10000)).map((m) => m.id)
    : [];
  if (!machines.length) return { machines, sensors: [], units: [] };
  const [assignments, sensorRecs, unitRecs] = await Promise.all([
    db.VibrationSensorAssignment.filter({ machine_id: { $in: machines } }, null, 5000),
    db.AissensSensor.filter({ machine_id: { $in: machines } }, null, 5000),
    db.VseUnit.filter({ machine_id: { $in: machines } }, null, 1000),
  ]);
  const sensors = [...new Set([...assignments, ...sensorRecs].map((r) => r.sensor_id).filter(Boolean))];
  return { machines, sensors, units: unitRecs.map((u) => u.unit_id).filter(Boolean) };
}

// Zúží dotaz na povolené hodnoty klíče
function scopeQuery(query, key, allowedValues) {
  const q = { ...(query || {}) };
  const cur = q[key];
  if (typeof cur === 'string') {
    q[key] = allowedValues.includes(cur) ? cur : { $in: [] };
  } else if (cur && Array.isArray(cur.$in)) {
    q[key] = { $in: cur.$in.filter((v) => allowedValues.includes(v)) };
  } else {
    q[key] = { $in: allowedValues };
  }
  return q;
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { entity, op = 'filter', query, sort, limit, id, data } = await req.json();
    const def = ENTITIES[entity];
    if (!def) return Response.json({ error: 'Unknown entity' }, { status: 400 });
    const db = base44.asServiceRole.entities;
    const superAdmin = isSuperAdmin(user);

    if (op === 'filter') {
      const max = Math.min(Number(limit) || 100, 1000);
      if (superAdmin) return Response.json({ items: await db[entity].filter(query || {}, sort || null, max) });
      const scope = await loadScope(db, user);
      const allowedValues = scope[def.scope];
      if (!allowedValues.length) return Response.json({ items: [] });
      const items = await db[entity].filter(scopeQuery(query, def.key, allowedValues), sort || null, max);
      return Response.json({ items });
    }

    if (op === 'create' || op === 'update') {
      const roles = WRITES[entity]?.[op];
      if (!superAdmin && !roles?.includes(user.user_type)) {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }
      if (!superAdmin) {
        const scope = await loadScope(db, user);
        const allowedValues = scope[def.scope];
        if (op === 'update') {
          const existing = (await db[entity].filter({ id }, null, 1))[0];
          if (!existing || !allowedValues.includes(existing[def.key])) {
            return Response.json({ error: 'Forbidden' }, { status: 403 });
          }
        }
        if (data?.[def.key] !== undefined && !allowedValues.includes(data[def.key])) {
          return Response.json({ error: 'Forbidden' }, { status: 403 });
        }
      }
      const record = op === 'create' ? await db[entity].create(data) : await db[entity].update(id, data);
      return Response.json({ record });
    }

    return Response.json({ error: 'Unknown op' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}