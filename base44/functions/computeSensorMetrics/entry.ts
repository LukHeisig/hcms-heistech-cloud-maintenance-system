import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

function calcRMS(arr) {
  if (!arr || arr.length === 0) return null;
  const sum = arr.reduce((s, v) => s + v * v, 0);
  return Math.sqrt(sum / arr.length);
}

function calcAveragedRMS_Peak(rawArray, numSegments = 10) {
  if (!rawArray || rawArray.length === 0) return { rms: null, peak: null };
  
  // Adjust num segments if array is too small
  const actualSegments = Math.max(1, Math.min(numSegments, rawArray.length));
  const segmentSize = Math.floor(rawArray.length / actualSegments);
  if (segmentSize < 1) {
    // If array is very small, just return whole array stats
    return {
      rms: calcRMS(rawArray),
      peak: Math.max(...rawArray.map(Math.abs))
    };
  }
  
  const rmsValues = [];
  const peakValues = [];
  
  for (let i = 0; i < actualSegments; i++) {
    const start = i * segmentSize;
    const end = i === actualSegments - 1 ? rawArray.length : (i + 1) * segmentSize;
    const segment = rawArray.slice(start, end);
    
    const rms = calcRMS(segment);
    if (rms !== null) rmsValues.push(rms);
    
    const peak = Math.max(...segment.map(Math.abs));
    peakValues.push(peak);
  }
  
  const avgRms = rmsValues.length > 0 ? rmsValues.reduce((a, b) => a + b) / rmsValues.length : null;
  const avgPeak = peakValues.length > 0 ? peakValues.reduce((a, b) => a + b) / peakValues.length : null;
  
  return { rms: avgRms, peak: avgPeak };
}

function accelerationToVelocity(accelArray, fs = 26700) {
  if (!accelArray || accelArray.length < 2) return null;
  const dt = 1 / fs;
  const velocity = [0];
  for (let i = 1; i < accelArray.length; i++) {
    const avgAccel = (accelArray[i - 1] + accelArray[i]) / 2;
    velocity.push(velocity[i - 1] + avgAccel * dt);
  }
  return velocity;
}

function applyBandpassFilter(signal, fs = 26700) {
  const Fc_high = 10;
  const Rc_high = 1 / (2 * Math.PI * Fc_high);
  const alpha_high = Rc_high / (Rc_high + 1 / fs);
  
  let highPassed = [];
  let prevOut = 0;
  let prevIn = signal[0];
  for (let i = 0; i < signal.length; i++) {
    const out = alpha_high * (prevOut + signal[i] - prevIn);
    highPassed.push(out);
    prevOut = out;
    prevIn = signal[i];
  }
  
  const Fc_low = 1000;
  const Rc_low = 1 / (2 * Math.PI * Fc_low);
  const alpha_low = Rc_low / (Rc_low + 1 / fs);
  
  let lowPassed = [];
  prevOut = 0;
  prevIn = highPassed[0];
  for (let i = 0; i < highPassed.length; i++) {
    const out = alpha_low * (prevOut + highPassed[i] - prevIn);
    lowPassed.push(out);
    prevOut = out;
    prevIn = highPassed[i];
  }
  
  return lowPassed;
}

function calcAveragedVelocityRMS(velocityArray, numSegments = 10, isAlreadyInMmS = false) {
  if (!velocityArray || velocityArray.length === 0) return null;
  
  // Adjust segments for small arrays
  const actualSegments = Math.max(1, Math.min(numSegments, velocityArray.length));
  const segmentSize = Math.floor(velocityArray.length / actualSegments);
  if (segmentSize < 1) {
    // For very small arrays, just return RMS of whole array
    let rms = calcRMS(velocityArray);
    if (rms !== null && !isAlreadyInMmS) {
      rms = rms * 1000;
    }
    return rms;
  }
  
  const rmsValues = [];
  for (let i = 0; i < actualSegments; i++) {
    const start = i * segmentSize;
    const end = i === actualSegments - 1 ? velocityArray.length : (i + 1) * segmentSize;
    const segment = velocityArray.slice(start, end);
    
    let rms = calcRMS(segment);
    if (rms !== null) {
      if (!isAlreadyInMmS) {
        rms = rms * 1000;
      }
      rmsValues.push(rms);
    }
  }
  
  return rmsValues.length > 0 ? rmsValues.reduce((a, b) => a + b) / rmsValues.length : null;
}

function applyHighPassFilter(samples) {
  if (!samples || samples.length < 2) return samples;
  const Fs = 26700;
  const Fc = 10;
  const Dt = 1 / Fs;
  const RC = 1 / (2 * Math.PI * Fc);
  const alpha = RC / (RC + Dt);
  
  const filtered = [];
  let prevOutput = 0;
  let prevInput = samples[0];
  
  for (let i = 0; i < samples.length; i++) {
    const output = alpha * (prevOutput + samples[i] - prevInput);
    filtered.push(output);
    prevOutput = output;
    prevInput = samples[i];
  }
  
  return filtered;
}

function applyBandpass_0_5_6kHz(signal, fs = 26700) {
  if (!signal || signal.length < 2) return signal;
  
  const Fc_hp = 0.5;
  const Rc_hp = 1 / (2 * Math.PI * Fc_hp);
  const alpha_hp = Rc_hp / (Rc_hp + 1 / fs);
  
  let highPassed = [];
  let prevOut = 0;
  let prevIn = signal[0];
  for (let i = 0; i < signal.length; i++) {
    const out = alpha_hp * (prevOut + signal[i] - prevIn);
    highPassed.push(out);
    prevOut = out;
    prevIn = signal[i];
  }
  
  const Fc_lp = 6000;
  const Rc_lp = 1 / (2 * Math.PI * Fc_lp);
  const alpha_lp = Rc_lp / (Rc_lp + 1 / fs);
  
  let lowPassed = [];
  prevOut = 0;
  prevIn = highPassed[0];
  for (let i = 0; i < highPassed.length; i++) {
    const out = alpha_lp * (prevOut + highPassed[i] - prevIn);
    lowPassed.push(out);
    prevOut = out;
    prevIn = highPassed[i];
  }
  
  return lowPassed;
}

function getEnvelopeRMS_10_1000Hz(signal, fs = 26700) {
  if (!signal || signal.length < 2) return null;
  
  try {
    const filtered = applyBandpass_0_5_6kHz(signal, fs);
    
    const envelope = [];
    const winSize = Math.min(Math.floor(fs / 100), filtered.length);
    if (winSize < 1) return null;
    
    for (let i = 0; i < filtered.length; i++) {
      let sumSq = 0;
      let count = 0;
      for (let j = Math.max(0, i - winSize / 2); j < Math.min(filtered.length, i + winSize / 2); j++) {
        sumSq += filtered[j] * filtered[j];
        count++;
      }
      if (count > 0) envelope.push(Math.sqrt(sumSq / count));
    }
    
    if (envelope.length === 0) return null;
    
    const mean = envelope.reduce((a, b) => a + b) / envelope.length;
    const demeaned = envelope.map(v => v - mean);
    
    const N = demeaned.length;
    if (N < 2) return null;
    
    const windowed = [];
    for (let i = 0; i < N; i++) {
      const hann = 0.5 * (1 - Math.cos(2 * Math.PI * i / (N - 1)));
      windowed.push(demeaned[i] * hann);
    }
    
    const freqResolution = fs / N;
    const bin10Hz = Math.ceil(10 / freqResolution);
    const bin1000Hz = Math.floor(1000 / freqResolution);
    
    if (bin10Hz >= bin1000Hz) return null;
    
    let powerSum = 0;
    let binCount = 0;
    const segmentLen = Math.min(1024, N);
    const numSegments = Math.ceil(N / segmentLen);
    
    for (let seg = 0; seg < numSegments; seg++) {
      const start = seg * segmentLen;
      const end = Math.min(start + segmentLen, N);
      const segment = windowed.slice(start, end);
      
      for (let f = bin10Hz; f <= Math.min(bin1000Hz, Math.floor(segment.length / 2)); f++) {
        let real = 0, imag = 0;
        for (let i = 0; i < segment.length; i++) {
          const angle = -2 * Math.PI * f * i / segmentLen;
          real += segment[i] * Math.cos(angle);
          imag += segment[i] * Math.sin(angle);
        }
        const mag = Math.sqrt(real * real + imag * imag);
        powerSum += mag * mag;
        binCount++;
      }
    }
    
    if (binCount === 0) return null;
    const envelopeRMS = Math.sqrt(powerSum / binCount);
    return isFinite(envelopeRMS) ? Math.round(envelopeRMS * 100000) / 100000 : null;
  } catch (e) {
    console.error("Envelope RMS error:", e.message);
    return null;
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const body = await req.json();
    
    // Entity automation payload: { event: {...}, data: {...}, payload_too_large: bool }
    let data;
    if (body.payload_too_large) {
      // Raw data exceeded 200KB limit — fetch entity manually
      const entityId = body.event?.entity_id;
      if (!entityId) {
        return Response.json({ error: 'Missing entity_id in payload_too_large scenario' }, { status: 400 });
      }
      const records = await base44.asServiceRole.entities.SensorData.filter({ id: entityId });
      data = records[0];
    } else {
      data = body.data || body;
    }
    
    if (!data || !data.id) {
      return Response.json({ error: 'Missing data.id' }, { status: 400 });
    }

    const sensorDataId = data.id;
    const G_FACTOR = 9.81;
    
    // If has_raw is set but raw arrays are missing (automation may truncate large fields), fetch from DB
    if (data.has_raw && !data.raw_z_json) {
      const records = await base44.asServiceRole.entities.SensorData.filter({ id: sensorDataId });
      if (records[0]) data = records[0];
    }
    
    // Parse raw data from JSON strings
    let rawX = [], rawY = [], rawZ = [];
    
    try {
      if (data.raw_x_json && typeof data.raw_x_json === 'string') {
        rawX = JSON.parse(data.raw_x_json);
        if (!Array.isArray(rawX)) rawX = [];
      }
      if (data.raw_y_json && typeof data.raw_y_json === 'string') {
        rawY = JSON.parse(data.raw_y_json);
        if (!Array.isArray(rawY)) rawY = [];
      }
      if (data.raw_z_json && typeof data.raw_z_json === 'string') {
        rawZ = JSON.parse(data.raw_z_json);
        if (!Array.isArray(rawZ)) rawZ = [];
      }
    } catch (e) {
      console.error("Failed to parse raw data JSON:", e.message);
      // Don't fail – just skip metric computation
      return Response.json({ ok: true, skipped: 'Invalid raw data format' });
    }
    
    const updates = {};
    
    console.log(`[computeSensorMetrics] Computing for ID=${sensorDataId}, rawZ.length=${rawZ.length}`);
    console.log(`[computeSensorMetrics] rawX.length=${rawX.length}, rawY.length=${rawY.length}`);
    
    // RMS Z a Peak Z z akceleračních dat
    if (rawZ.length > 0) {
      const { rms: rmsZ_ms2, peak: peakZ_ms2 } = calcAveragedRMS_Peak(rawZ, Math.max(2, Math.floor(rawZ.length / 100)));
      console.log(`[computeSensorMetrics] RMS=${rmsZ_ms2} Peak=${peakZ_ms2}`);
      if (rmsZ_ms2 !== null) {
        updates.rms_z_g = Math.round((rmsZ_ms2 / G_FACTOR) * 10000) / 10000;
        console.log(`[computeSensorMetrics] Set rms_z_g=${updates.rms_z_g}`);
      }
      if (peakZ_ms2 !== null) {
        updates.peak_z_g = Math.round((peakZ_ms2 / G_FACTOR) * 10000) / 10000;
        console.log(`[computeSensorMetrics] Set peak_z_g=${updates.peak_z_g}`);
      }
    }
    
    // Velocity RMS z bandpass filtrovaného signálu
    if (rawX.length > 0) {
      const rawX_filtered = applyBandpassFilter(rawX);
      const velX = accelerationToVelocity(rawX_filtered);
      const velRMS_X = velX ? calcAveragedVelocityRMS(velX, 10, false) : null;
      if (velRMS_X !== null) updates.vel_rms_x_mm_s = Math.round(velRMS_X * 1000) / 1000;
    }
    
    if (rawY.length > 0) {
      const rawY_filtered = applyBandpassFilter(rawY);
      const velY = accelerationToVelocity(rawY_filtered);
      const velRMS_Y = velY ? calcAveragedVelocityRMS(velY, 10, false) : null;
      if (velRMS_Y !== null) updates.vel_rms_y_mm_s = Math.round(velRMS_Y * 1000) / 1000;
    }
    
    if (rawZ.length > 0) {
      const rawZ_filtered = applyBandpassFilter(rawZ);
      const velZ = accelerationToVelocity(rawZ_filtered);
      const velRMS_Z = velZ ? calcAveragedVelocityRMS(velZ, 10, false) : null;
      if (velRMS_Z !== null) updates.vel_rms_z_mm_s = Math.round(velRMS_Z * 1000) / 1000;
    }
    
    // Envelope RMS (Z axis)
    if (rawZ.length > 0) {
      const envRMS_Z = getEnvelopeRMS_10_1000Hz(rawZ);
      if (envRMS_Z !== null) updates.env_rms_z = envRMS_Z;
    }
    
    // Update SensorData record (use service role — called from automation without user session)
    if (Object.keys(updates).length > 0) {
      await base44.asServiceRole.entities.SensorData.update(sensorDataId, updates);
      console.log(`[computeSensorMetrics] Updated ${sensorDataId} with:`, updates);
    }
    
    return Response.json({ ok: true, updates });
  } catch (error) {
    console.error("computeSensorMetrics error:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});