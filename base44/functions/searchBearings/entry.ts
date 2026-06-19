import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { q } = await req.json();
    if (!q || String(q).trim().length < 1) return Response.json({ results: [] });

    const term = String(q).trim();
    const esc = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    let results = [];
    try {
      results = await base44.asServiceRole.entities.BearingType.filter(
        { designation: { $regex: esc, $options: 'i' } }, null, 60
      );
    } catch (e) {
      results = [];
    }

    // Doplnit hledáním podle výrobce, pokud je málo výsledků
    if (results.length < 60) {
      try {
        const byMfr = await base44.asServiceRole.entities.BearingType.filter(
          { manufacturer: { $regex: esc, $options: 'i' } }, null, 60
        );
        const seen = new Set(results.map(r => r.id));
        for (const r of byMfr) {
          if (!seen.has(r.id)) { results.push(r); seen.add(r.id); }
          if (results.length >= 60) break;
        }
      } catch (e) { /* ignore */ }
    }

    return Response.json({ results, count: results.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});