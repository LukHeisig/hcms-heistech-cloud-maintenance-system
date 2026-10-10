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

// Krátká cache rozsahu na uživatele (šetří 4+ dotazy na každé volání)
const SCOPE_TTL = 60000;
const scopeCache = new Map();
async function loadScope(db, user) {
  const hit = scopeCache.get(user.id);
  if (hit && Date.now() - hit.at < SCOPE_TTL) return hit.scope;
  const scope = await computeScope(db, user);
  scopeCache.set(user.id, { scope, at: Date.now() });
  return scope;
}

// Odstraní těžká raw pole (surové vzorky) – pro přehledy nejsou potřeba
const HEAVY = ['raw_x_json', 'raw_y_json', 'raw_z_json'];
const lighten = (items) => items.map((r) => { const o = { ...r }; HEAVY.forEach((k) => delete o[k]); return o; });

async function computeScope(db, user) {
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

    const { entity, op = 'filter', query, sort, limit, id, data, light, keys } = await req.json();
    const def = ENTITIES[entity];
    if (!def) return Response.json({ error: 'Unknown entity' }, { status: 400 });
    const db = base44.asServiceRole.entities;
    const superAdmin = isSuperAdmin(user);

    if (op === 'filter') {
      const max = Math.min(Number(limit) || 100, 1000);
      const out = (items) => Response.json({ items: light ? lighten(items) : items });
      if (superAdmin) return out(await db[entity].filter(query || {}, sort || null, max));
      const scope = await loadScope(db, user);
      const allowedValues = scope[def.scope];
      if (!allowedValues.length) return Response.json({ items: [] });
      return out(await db[entity].filter(scopeQuery(query, def.key, allowedValues), sort || null, max));
    }

    // Poslední záznam pro každý klíč (např. senzor) v jednom volání
    if (op === 'latest') {
      let list = [...new Set(keys || [])];
      if (!superAdmin) {
        const allowedValues = (await loadScope(db, user))[def.scope];
        list = list.filter((k) => allowedValues.includes(k));
      }
      const map = {};
      await Promise.all(list.map(async (k) => {
        const recs = await db[entity].filter({ ...(query || {}), [def.key]: k }, sort || '-created_date', 1);
        if (recs[0]) map[k] = lighten(recs)[0];
      }));
      return Response.json({ map });
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