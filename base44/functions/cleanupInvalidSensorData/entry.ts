import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Smaže SensorData záznamy s has_raw=true ale příliš malým počtem vzorků,
// a jejich přidružené SensorFFTData záznamy.

const MIN_VALID_SAMPLES = 1000;

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (user?.role !== 'admin') {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  let deletedSensorData = 0;
  let deletedFFT = 0;
  let checked = 0;
  // Načti až 50 záznamů s has_raw=true najednou (menší dávka kvůli memory limitu)
  const records = await base44.asServiceRole.entities.SensorData.filter(
    { has_raw: true },
    "created_date",
    50
  );
  checked = records.length;
  for (const rec of records) {
    const numSamples = rec.num_samples ?? 0;
    if (numSamples < MIN_VALID_SAMPLES && numSamples > 0) {
      const fftRecs = await base44.asServiceRole.entities.SensorFFTData.filter(
        { sensor_data_id: rec.id }
      );
      for (const fft of fftRecs) {
        await base44.asServiceRole.entities.SensorFFTData.delete(fft.id);
        deletedFFT++;
      }
      await base44.asServiceRole.entities.SensorData.delete(rec.id);
      deletedSensorData++;
      console.log(`Deleted SensorData ${rec.id} (sensor=${rec.sensor_id}, samples=${numSamples})`);
    }
  }

  return Response.json({
    ok: true,
    checked,
    deletedSensorData,
    deletedFFT,
    minValidSamples: MIN_VALID_SAMPLES,
  });
});