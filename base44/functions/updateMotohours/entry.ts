import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { isServiceCaller } from '../../shared/access.ts';

const DAY = 86400;
const FIELDS = ['timestamp_unix', 'vel_rms_x_mm_s', 'vel_rms_y_mm_s', 'vel_rms_z_mm_s'];
const median = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : 0; };
const vel = (p) => Math.max(p.vel_rms_x_mm_s || 0, p.vel_rms_y_mm_s || 0, p.vel_rms_z_mm_s || 0);

async function loadPoints(db, sid, afterTs) {
  const out = [];
  let cursorTs = afterTs;
  while (true) {
    const page = await db.SensorTrendPoint.filter({ sensor_id: sid, timestamp_unix: { $gt: cursorTs } }, 'timestamp_unix', 2000, 0, FIELDS);
    out.push(...page);
    if (page.length < 2000) break;
    cursorTs = page[page.length - 1].timestamp_unix;
  }
  return out;
}

async function processMachine(db, m, recompute) {
  const fromTs = m.motohours_from ? Math.floor(Date.parse(m.motohours_from) / 1000) : 0;
  const lastTs = recompute ? fromTs : Math.max(fromTs, m.motohours_last_ts || 0);
  const thr = m.motohours_threshold_mm_s ?? 0.3;
  if (recompute) await db.MachineRunDay.deleteMany({ machine_id: m.id });

  const asg = await db.VibrationSensorAssignment.filter({ machine_id: m.id }, null, 100);
  const sensorIds = [...new Set(asg.map((a) => a.sensor_id).filter(Boolean))];
  const segments = [];
  let maxTs = lastTs;
  let running = m.motohours_running ?? null;
  let newestTs = 0;

  // Sloučená časová osa všech snímačů: každé měření určuje stav od předchozího měření
  // libovolného snímače (max. interval vlastního snímače) — přesnější kolem rozběhu/zastavení
  const timeline = [];
  let prevAny = null;
  for (const sid of sensorIds) {
    const prev = await db.SensorTrendPoint.filter({ sensor_id: sid, timestamp_unix: { $lte: lastTs } }, '-timestamp_unix', 20, 0, ['timestamp_unix']);
    const pts = await loadPoints(db, sid, lastTs);
    if (prev.length) prevAny = Math.max(prevAny ?? 0, prev[0].timestamp_unix);
    if (!pts.length) continue;
    const all = [...prev.reverse(), ...pts].map((p) => p.timestamp_unix);
    const gaps = all.slice(1).map((t, i) => t - all[i]).filter((g) => g > 60);
    const interval = median(gaps) || 600;
    for (const p of pts) timeline.push({ ts: p.timestamp_unix, run: vel(p) > thr, interval });
  }
  timeline.sort((a, b) => a.ts - b.ts);
  for (const p of timeline) {
    const gap = prevAny != null ? p.ts - prevAny : p.interval;
    const dur = Math.min(gap > 0 ? gap : 0, p.interval);
    if (p.run && dur > 0) segments.push([p.ts - dur, p.ts]);
    prevAny = p.ts;
    if (p.ts > maxTs) maxTs = p.ts;
    if (p.ts >= newestTs) { newestTs = p.ts; running = p.run; }
  }

  // Sjednocení úseků (více snímačů = jeden chod) a rozdělení po dnech
  segments.sort((a, b) => a[0] - b[0]);
  const merged = [];
  for (const s of segments) {
    const top = merged[merged.length - 1];
    if (top && s[0] <= top[1]) top[1] = Math.max(top[1], s[1]); else merged.push([...s]);
  }
  const days = {};
  for (let [a, b] of merged) {
    a = Math.max(a, lastTs);
    while (a < b) {
      const end = Math.min(b, (Math.floor(a / DAY) + 1) * DAY);
      const key = new Date(a * 1000).toISOString().slice(0, 10);
      days[key] = (days[key] || 0) + (end - a) / 3600;
      a = end;
    }
  }

  const dates = Object.keys(days);
  let added = 0;
  if (dates.length) {
    const existing = await db.MachineRunDay.filter({ machine_id: m.id, date: { $in: dates } }, null, 1000);
    const byDate = Object.fromEntries(existing.map((e) => [e.date, e]));
    const toUpdate = [], toCreate = [];
    for (const d of dates) {
      added += days[d];
      if (byDate[d]) toUpdate.push({ id: byDate[d].id, hours: (byDate[d].hours || 0) + days[d] });
      else toCreate.push({ machine_id: m.id, date: d, hours: days[d] });
    }
    if (toUpdate.length) await db.MachineRunDay.bulkUpdate(toUpdate);
    if (toCreate.length) await db.MachineRunDay.bulkCreate(toCreate);
  }

  const accumulated = (recompute ? 0 : (m.motohours_accumulated || 0)) + added;
  await db.Machine.update(m.id, { motohours_accumulated: accumulated, motohours_last_ts: maxTs, motohours_running: running });
  return { machine_id: m.id, added_hours: added, accumulated };
}

// Payload: { machine_id?, recompute? } — bez machine_id zpracuje všechny stroje se zapnutými motohodinami
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    const allowed = isServiceCaller(user) || ['superAdmin', 'admin', 'manager'].includes(user?.user_type) || user?.role === 'admin';
    if (!allowed) return Response.json({ error: 'Forbidden' }, { status: 403 });
    const db = base44.asServiceRole.entities;
    const { machine_id, recompute = false } = await req.json().catch(() => ({}));
    const machines = machine_id
      ? await db.Machine.filter({ id: machine_id, motohours_enabled: true }, null, 1)
      : await db.Machine.filter({ motohours_enabled: true }, null, 1000);
    const results = [];
    // Stroje zpracujeme po skupinách paralelně, aby úloha nepřekročila časový limit
    for (let i = 0; i < machines.length; i += 4) {
      results.push(...await Promise.all(machines.slice(i, i + 4).map((m) =>
        processMachine(db, m, recompute).catch((e) => {
          console.error(`Machine ${m.id} failed:`, e.message);
          return { machine_id: m.id, error: e.message };
        }))));
    }
    // Neúspěch jednoho stroje nezastaví úlohu; doběhne v příštím běhu
    return Response.json({ results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}