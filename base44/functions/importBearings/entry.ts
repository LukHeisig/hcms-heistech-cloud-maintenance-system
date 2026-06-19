import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import * as XLSX from 'npm:xlsx@0.18.5';

// Řádek 0 = prázdný titulek, řádek 1 = hlavička, data od řádku 2.
// Mapování sloupců (0-based indexy v listu "Frekvence"):
// 1: Označení, 2: Typ/Číslo, 3: Výrobce, 4: Z(Nb), 5: Bd, 6: Pd, 7: α,
// 8: FTF, 9: BSF, 10: BPFO, 11: BPFI
const toNum = (v) => (v === null || v === undefined || v === '' || isNaN(Number(v))) ? null : Number(v);

async function loadRows(fileUrl) {
  const res = await fetch(fileUrl);
  const buf = new Uint8Array(await res.arrayBuffer());
  const wb = XLSX.read(buf, { type: 'array' });
  const ws = wb.Sheets['Frekvence'] || wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
}

function mapRow(r) {
  if (!r) return null;
  const designation = r[1] != null ? String(r[1]).trim() : '';
  if (!designation) return null;
  return {
    designation,
    type_number: r[2] != null ? String(r[2]).trim() : null,
    manufacturer: r[3] != null ? String(r[3]).trim() : null,
    nb: toNum(r[4]),
    bd: toNum(r[5]),
    pd: toNum(r[6]),
    contact_angle_deg: toNum(r[7]) || 0,
    ftf_coef: toNum(r[8]),
    bsf_coef: toNum(r[9]),
    bpfo_coef: toNum(r[10]),
    bpfi_coef: toNum(r[11]),
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const action = body.action;

    if (action === 'peek') {
      const rows = await loadRows(body.fileUrl);
      return Response.json({
        total: rows.length - 2,
        header: rows[1],
        mapped: [mapRow(rows[2]), mapRow(rows[3]), mapRow(rows[Math.floor(rows.length / 2)])],
      });
    }

    if (action === 'reset') {
      const assignments = await base44.asServiceRole.entities.VibrationSensorAssignment.list(null, 100000);
      let cleared = 0;
      for (const a of assignments) {
        if (a.bearing_id) {
          await base44.asServiceRole.entities.VibrationSensorAssignment.update(a.id, { bearing_id: null });
          cleared++;
        }
      }
      let deleted = 0;
      while (true) {
        const batch = await base44.asServiceRole.entities.BearingType.list(null, 200);
        if (!batch.length) break;
        for (const b of batch) {
          await base44.asServiceRole.entities.BearingType.delete(b.id);
          deleted++;
        }
      }
      return Response.json({ ok: true, cleared, deleted });
    }

    if (action === 'import') {
      const offset = body.offset || 0;
      const limit = body.limit || 2500;
      const rows = await loadRows(body.fileUrl);
      const dataRows = rows.slice(2);
      const total = dataRows.length;
      const slice = dataRows.slice(offset, offset + limit);
      const records = [];
      for (const r of slice) {
        const m = mapRow(r);
        if (m) records.push(m);
      }
      let created = 0;
      for (let i = 0; i < records.length; i += 500) {
        await base44.asServiceRole.entities.BearingType.bulkCreate(records.slice(i, i + 500));
        created += Math.min(500, records.length - i);
      }
      const nextOffset = offset + limit;
      return Response.json({ ok: true, total, created, nextOffset, done: nextOffset >= total });
    }

    return Response.json({ error: 'unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
});