import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Vymaže hodnoty temperature=28.0 ze SensorData (jsou to neplatné hodnoty kdy tempRaw=0)
// Spusťte nejdříve s dry_run=true, pak s dry_run=false
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const dry_run = body.dry_run !== false; // defaultně dry_run=true pro bezpečnost

    // Načteme jeden batch a zpracujeme — funkce se musí spustit vícekrát pro kompletní cleanup
    const records = await base44.asServiceRole.entities.SensorData.list("-created_date", 500);
    const toClean = records.filter(r => r.temperature === 28.0);

    console.log(`[cleanupFakeTemperature] Loaded ${records.length} records, ${toClean.length} with temp=28.0, dry_run=${dry_run}`);

    let updated = 0;
    if (!dry_run) {
      for (const r of toClean) {
        await base44.asServiceRole.entities.SensorData.update(r.id, { temperature: null });
        updated++;
      }
    }

    return Response.json({
      ok: true,
      dry_run,
      batch_size: records.length,
      found_in_batch: toClean.length,
      updated,
      message: dry_run
        ? `V tomto batchi nalezeno ${toClean.length} záznamů s temperature=28.0. Spusťte s dry_run=false pro skutečné vymazání.`
        : `Vymazáno temperature u ${updated} záznamů v tomto batchi. Spusťte znovu pro další batch.`
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});