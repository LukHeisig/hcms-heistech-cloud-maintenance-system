import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// ─── helpers ────────────────────────────────────────────────────────────────

function hexToBytes(hex) {
  const clean = hex.replace(/\s+/g, '');
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(clean.substr(i * 2, 2), 16);
  }
  return bytes;
}

function readUint32BE(bytes, offset) {
  return ((bytes[offset] << 24) | (bytes[offset+1] << 16) | (bytes[offset+2] << 8) | bytes[offset+3]) >>> 0;
}

function readUint64BE(bytes, offset) {
  const hi = readUint32BE(bytes, offset);
  const lo = readUint32BE(bytes, offset + 4);
  return hi * 4294967296 + lo;
}

function readInt16BE(bytes, offset) {
  const v = (bytes[offset] << 8) | bytes[offset+1];
  return v >= 0x8000 ? v - 0x10000 : v;
}

function readFloat32LE(bytes, offset) {
  const buf = new ArrayBuffer(4);
  const view = new DataView(buf);
  view.setUint8(0, bytes[offset]);
  view.setUint8(1, bytes[offset+1]);
  view.setUint8(2, bytes[offset+2]);
  view.setUint8(3, bytes[offset+3]);
  return view.getFloat32(0, true); // little-endian
}

function readUint32LE(bytes, offset) {
  const buf = new ArrayBuffer(4);
  const view = new DataView(buf);
  view.setUint8(0, bytes[offset]);
  view.setUint8(1, bytes[offset+1]);
  view.setUint8(2, bytes[offset+2]);
  view.setUint8(3, bytes[offset+3]);
  return view.getUint32(0, true);
}

function adcToVoltage(adc) {
  return Math.round(((adc - 1400) * 0.001547 + 2.7) * 1000) / 1000;
}

function calcRMS(arr) {
  if (!arr || arr.length === 0) return null;
  const sum = arr.reduce((s, v) => s + v * v, 0);
  return Math.sqrt(sum / arr.length);
}

// Rozdělí signál na segmenty a vrátí průměrné RMS a Peak
function calcAveragedRMS_Peak(rawArray, numSegments = 10) {
  if (!rawArray || rawArray.length === 0) return { rms: null, peak: null };
  
  const segmentSize = Math.floor(rawArray.length / numSegments);
  if (segmentSize < 1) return { rms: null, peak: null };
  
  const rmsValues = [];
  const peakValues = [];
  
  // Projít segmenty a spočítat RMS a Peak pro každý
  for (let i = 0; i < numSegments; i++) {
    const start = i * segmentSize;
    const end = i === numSegments - 1 ? rawArray.length : (i + 1) * segmentSize;
    const segment = rawArray.slice(start, end);
    
    const rms = calcRMS(segment);
    if (rms !== null) rmsValues.push(rms);
    
    const peak = Math.max(...segment.map(Math.abs));
    peakValues.push(peak);
  }
  
  // Spočítat průměr RMS a Peak hodnot
  const avgRms = rmsValues.length > 0 ? rmsValues.reduce((a, b) => a + b) / rmsValues.length : null;
  const avgPeak = peakValues.length > 0 ? peakValues.reduce((a, b) => a + b) / peakValues.length : null;
  
  return { rms: avgRms, peak: avgPeak };
}

// Numerická integrace akcelerace na rychlost pomocí trapezoidní metody
function accelerationToVelocity(accelArray, fs = 26700) {
  if (!accelArray || accelArray.length < 2) return null;
  
  const dt = 1 / fs;
  const velocity = [0]; // počáteční rychlost je 0
  
  for (let i = 1; i < accelArray.length; i++) {
    // Trapezoidní integrace: v[n] = v[n-1] + (a[n-1] + a[n]) / 2 * dt
    const avgAccel = (accelArray[i - 1] + accelArray[i]) / 2;
    velocity.push(velocity[i - 1] + avgAccel * dt);
  }
  
  return velocity;
}

// Jednoduchý bandpass filtr (high-pass 10Hz + low-pass 1000Hz)
function applyBandpassFilter(signal, fs = 26700) {
  // High-pass filtr 10 Hz
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
  
  // Low-pass filtr 1000 Hz
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

// Spočítá segmentovaný RMS z rychlosti v mm/s
function calcAveragedVelocityRMS(velocityArray, numSegments = 10) {
  if (!velocityArray || velocityArray.length === 0) return null;
  
  const segmentSize = Math.floor(velocityArray.length / numSegments);
  if (segmentSize < 1) return null;
  
  const rmsValues = [];
  const MM_PER_SECOND = 1000; // konverze z m/s na mm/s
  
  for (let i = 0; i < numSegments; i++) {
    const start = i * segmentSize;
    const end = i === numSegments - 1 ? velocityArray.length : (i + 1) * segmentSize;
    const segment = velocityArray.slice(start, end);
    
    const rms = calcRMS(segment);
    if (rms !== null) rmsValues.push(rms * MM_PER_SECOND); // m/s na mm/s
  }
  
  // Vrátit průměrný RMS
  return rmsValues.length > 0 ? rmsValues.reduce((a, b) => a + b) / rmsValues.length : null;
}

// High-pass filter (10 Hz) to remove DC component and low-freq drift
// Fs = 26700 Hz, Fc = 10 Hz
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

// ─── AISSENS binary parser ───────────────────────────────────────────────────

function parseAissensData(bytes) {
  if (!bytes || bytes.length < 5) return null;

  const type = bytes[0];
  // bytes 1-4: data length (big-endian uint32)
  const dataLength = readUint32BE(bytes, 1);
  const data = bytes.slice(5); // data field starts at byte 5

  const result = { report_type: type };

  // ── Type 1: FFT ──────────────────────────────────────────────────────────
  if (type === 1) {
    if (data.length < 45) return result;
    result.timestamp_unix = readUint64BE(data, 0);
    // status: data[8], battery_info: data[9] — upper nibble = level
    result.battery_level = (data[9] >> 4) & 0x0F;
    const avgAdc = (data[10] << 8) | data[11];
    const lastAdc = (data[12] << 8) | data[13];
    result.battery_voltage = adcToVoltage(lastAdc);
    const tempRaw = readInt16BE(data, 14);
    result.temperature = Math.round((tempRaw / 256.0 + 28) * 100) / 100;

    // OA X,Y,Z at offset 16 (3 * float32 LE)
    result.oa_x = Math.round(readFloat32LE(data, 16) * 10000) / 10000;
    result.oa_y = Math.round(readFloat32LE(data, 20) * 10000) / 10000;
    result.oa_z = Math.round(readFloat32LE(data, 24) * 10000) / 10000;

    // frequency_resolution at 28 (float32 LE)
    result.frequency_resolution = Math.round(readFloat32LE(data, 28) * 10000) / 10000;
    // fft_length at 32 (uint32 BE)
    result.fft_length = readUint32BE(data, 32);
    // report_len at 36 (uint32 BE)
    result.report_len = readUint32BE(data, 36);
    // reserved 5 bytes at 40
    // FFT data starts at offset 45
    const fftOffset = 45;
    const reportLen = result.report_len;

    if (reportLen > 0 && data.length >= fftOffset + reportLen * 4 * 6) {
      const maxPoints = Math.min(reportLen, 512);
      const accX = [], accY = [], accZ = [], velX = [], velY = [], velZ = [];

      for (let i = 0; i < maxPoints; i++) {
        accX.push(Math.round(readFloat32LE(data, fftOffset + i * 4) * 100000) / 100000);
      }
      const accYOff = fftOffset + reportLen * 4;
      for (let i = 0; i < maxPoints; i++) {
        accY.push(Math.round(readFloat32LE(data, accYOff + i * 4) * 100000) / 100000);
      }
      const accZOff = fftOffset + reportLen * 4 * 2;
      for (let i = 0; i < maxPoints; i++) {
        accZ.push(Math.round(readFloat32LE(data, accZOff + i * 4) * 100000) / 100000);
      }
      const velXOff = fftOffset + reportLen * 4 * 3;
      for (let i = 0; i < maxPoints; i++) {
        velX.push(Math.round(readFloat32LE(data, velXOff + i * 4) * 100000) / 100000);
      }
      const velYOff = fftOffset + reportLen * 4 * 4;
      for (let i = 0; i < maxPoints; i++) {
        velY.push(Math.round(readFloat32LE(data, velYOff + i * 4) * 100000) / 100000);
      }
      const velZOff = fftOffset + reportLen * 4 * 5;
      for (let i = 0; i < maxPoints; i++) {
        velZ.push(Math.round(readFloat32LE(data, velZOff + i * 4) * 100000) / 100000);
      }

      result.has_fft = true;
      result.acc_x = accX;
      result.acc_y = accY;
      result.acc_z = accZ;
      result.vel_x = velX;
      result.vel_y = velY;
      result.vel_z = velZ;
      result.oa_acc_z = Math.round(calcRMS(accZ) * 10000) / 10000;
    }
  }

  // ── Type 9: OA Only ──────────────────────────────────────────────────────
  else if (type === 9) {
    if (data.length < 33) return result;
    result.timestamp_unix = readUint64BE(data, 0);
    result.battery_level = (data[9] >> 4) & 0x0F;
    const lastAdc = (data[12] << 8) | data[13];
    result.battery_voltage = adcToVoltage(lastAdc);
    const tempRaw = readInt16BE(data, 14);
    result.temperature = Math.round((tempRaw / 256.0 + 28) * 100) / 100;
    result.oa_x = Math.round(readFloat32LE(data, 16) * 10000) / 10000;
    result.oa_y = Math.round(readFloat32LE(data, 20) * 10000) / 10000;
    result.oa_z = Math.round(readFloat32LE(data, 24) * 10000) / 10000;
  }

  // ── Type 2: Feature (JSON) ───────────────────────────────────────────────
  else if (type === 2) {
    if (data.length < 9) return result;
    result.timestamp_unix = readUint64BE(data, 0);
    try {
      const jsonStr = new TextDecoder().decode(data.slice(8));
      const parsed = JSON.parse(jsonStr);
      result.temperature = parsed.Temperature ? parseFloat(parsed.Temperature) : null;
      result.battery_voltage = parsed.BatVoltage ?? null;
      result.feature_json = jsonStr;
    } catch (_) {}
  }

  // ── Type 3: Battery ──────────────────────────────────────────────────────
  else if (type === 3) {
    if (data.length < 9) return result;
    result.timestamp_unix = readUint64BE(data, 0);
    result.battery_level = data[8] & 0x0F;
    const lastAdc = (data[9] << 8) | data[10];
    result.battery_voltage = adcToVoltage(lastAdc);
  }

  // ── Type 4: Hibernate/Wakeup ─────────────────────────────────────────────
  // Per spec v1.7:
  //   Hibernate: Timestamp(8B) | Status(1B) | Sensor Information(json string)
  //   Wakeup:    Timestamp(8B) | Status(1B) | OnlineDuration(2B) | WiFiOnlineDuration(2B) | TransmissionDuration(2B) | BatteryUsageTime(4B)
  // Battery/Temp/RSSI are ONLY in JSON (Hibernate) via SensorInformation field
  else if (type === 4) {
    if (data.length < 9) return result;
    result.timestamp_unix = readUint64BE(data, 0);
    result.status_code = data[8];
    // status: 0=ManualHibernate, 1=ManualWakeup, 2=ScheduleHibernate, 3=ScheduleWakeup
    const isHibernate = result.status_code === 0 || result.status_code === 2;
    if (isHibernate && data.length > 9) {
      // JSON sensor information follows status byte
      try {
        const jsonStr = new TextDecoder().decode(data.slice(9));
        const info = JSON.parse(jsonStr);
        if (info.Temperature != null) result.temperature = parseFloat(info.Temperature);
        if (info.BatVoltage != null) result.battery_voltage = parseFloat(info.BatVoltage);
        if (info.BatteryLevel != null) result.battery_level = parseInt(info.BatteryLevel);
        if (info.SignalStrength != null) result.rssi = parseInt(info.SignalStrength);
        console.log(`[Type4 Hibernate] temp=${result.temperature} voltage=${result.battery_voltage} level=${result.battery_level} rssi=${result.rssi}`);
      } catch(e) {
        console.log(`[Type4 Hibernate] JSON parse error: ${e.message}`);
      }
    } else if (!isHibernate && data.length >= 17) {
      // Wakeup: parse durations (no battery/temp info)
      result.online_duration = (data[9] << 8) | data[10];
      result.wifi_online_duration = (data[11] << 8) | data[12];
      result.transmission_duration = (data[13] << 8) | data[14];
      result.battery_usage_time = readUint32BE(data, 15);
      console.log(`[Type4 Wakeup] online=${result.online_duration}s wifi=${result.wifi_online_duration}s`);
    }
  }

  // ── Type 12: Heart Beat ──────────────────────────────────────────────────
  else if (type === 12) {
    if (data.length < 9) return result;
    result.timestamp_unix = readUint64BE(data, 0);
    result.status_code = data[8];
  }

  // ── Type 0: Raw Data ─────────────────────────────────────────────────────
  // Per spec v1.7, Header (20B):
  //   [0-7]   Timestamp (8B, uint64BE)
  //   [8]     Control Flags (1B)
  //   [9]     *Index (1B, always 1)
  //   [10]    *Total (1B, always 1)
  //   [11-12] Temp (2B, Int16BE) → temperature = value/256.0 + 28
  //   [13-14] Real ODR (2B, Int16BE)
  //   [15]    Battery information (1B) — battery level 0-4
  //   [16-17] Last ADC (2B, Int16BE) → voltage = (adc-1400)*0.001547+2.7
  //   [18-19] Average ADC (2B, Int16BE)
  //   [20..] Acceleration data: x(2B LE), y(2B LE), z(2B LE) per sample
  //   Raw XYZ conversion: (Byte1<<8 | Byte0) * 0.0002441062  (little-endian!)
  else if (type === 0) {
    if (data.length < 20) return result;
    result.timestamp_unix = readUint64BE(data, 0);

    // Temp: Int16BE at [11-12]
    const tempRaw = readInt16BE(data, 11);
    result.temperature = Math.round((tempRaw / 256.0 + 28) * 100) / 100;

    // Battery level: [15]
    result.battery_level = data[15] & 0x0F;

    // Last ADC: Int16BE at [16-17]
    const lastAdc = readInt16BE(data, 16);
    result.battery_voltage = Math.round(((lastAdc - 1400) * 0.001547 + 2.7) * 1000) / 1000;

    // Real ODR: Int16BE at [13-14]
    result.real_odr = readInt16BE(data, 13);

    console.log(`[Type0] tempRaw=${tempRaw} temp=${result.temperature} batLevel=${result.battery_level} lastAdc=${lastAdc} voltage=${result.battery_voltage} odr=${result.real_odr} dataLen=${data.length}`);

    // Raw acceleration data starts at offset 20 — little-endian Int16
    const samplesOffset = 20;
    const remainingBytes = data.length - samplesOffset;
    if (remainingBytes >= 6) {
      const numSamples = Math.floor(remainingBytes / 6);
      const adcX = [], adcY = [], adcZ = [];
      for (let i = 0; i < numSamples; i++) {
        const off = samplesOffset + i * 6;
        // Little-endian: Byte1<<8 | Byte0
        adcX.push((data[off+1] << 8) | data[off]);
        adcY.push((data[off+3] << 8) | data[off+2]);
        adcZ.push((data[off+5] << 8) | data[off+4]);
      }
      // Convert signed (two's complement)
      const toSigned16 = (v) => v >= 0x8000 ? v - 0x10000 : v;
      let rawX = adcX.map(toSigned16);
      let rawY = adcY.map(toSigned16);
      let rawZ = adcZ.map(toSigned16);
      
      // Convert ADC counts → m/s² per AISSENS spec: value * 0.0002441062
      const ADC_TO_MS2 = 0.0002441062;
      rawX = rawX.map(v => v * ADC_TO_MS2);
      rawY = rawY.map(v => v * ADC_TO_MS2);
      rawZ = rawZ.map(v => v * ADC_TO_MS2);
      
      // Apply high-pass filter to remove DC component and low-freq drift
      rawX = applyHighPassFilter(rawX);
      rawY = applyHighPassFilter(rawY);
      rawZ = applyHighPassFilter(rawZ);
      
      result.raw_x = rawX.map(v => Math.round(v * 100000) / 100000); // round to 5 decimals
      result.raw_y = rawY.map(v => Math.round(v * 100000) / 100000);
      result.raw_z = rawZ.map(v => Math.round(v * 100000) / 100000);
      result.num_samples = numSamples;
      result.has_raw = true;

      // OA = RMS of filtered signal in m/s² (only Z axis)
      // Použít segmentovaný průměr (10 segmentů)
      const G_FACTOR = 9.81;
      const { rms: rmsZ_ms2, peak: peakZ_ms2 } = calcAveragedRMS_Peak(rawZ, 4);
      
      if (rmsZ_ms2 !== null) {
        result.rms_z_g = Math.round((rmsZ_ms2 / G_FACTOR) * 10000) / 10000;
      }
      
      if (peakZ_ms2 !== null) {
        result.peak_z_g = Math.round((peakZ_ms2 / G_FACTOR) * 10000) / 10000;
      }
      
      // Výpočet rychlosti vibrací RMS v pásmu 10-1000 Hz z bandpass filtrovaného signálu
      // Aplikovat bandpass filtr (10-1000 Hz) na všechny tři osy
      const rawX_filtered = applyBandpassFilter(rawX);
      const rawY_filtered = applyBandpassFilter(rawY);
      const rawZ_filtered = applyBandpassFilter(rawZ);
      
      // Integrovat akceleraci na rychlost
      const velX = accelerationToVelocity(rawX_filtered);
      const velY = accelerationToVelocity(rawY_filtered);
      const velZ = accelerationToVelocity(rawZ_filtered);
      
      // Spočítat segmentovaný RMS rychlosti (mm/s) pro každou osu
      const velRMS_X = velX ? calcAveragedVelocityRMS(velX, 4) : null;
      const velRMS_Y = velY ? calcAveragedVelocityRMS(velY, 4) : null;
      const velRMS_Z = velZ ? calcAveragedVelocityRMS(velZ, 4) : null;
      
      if (velRMS_X !== null) result.vel_rms_x_mm_s = Math.round(velRMS_X * 1000) / 1000;
      if (velRMS_Y !== null) result.vel_rms_y_mm_s = Math.round(velRMS_Y * 1000) / 1000;
      if (velRMS_Z !== null) result.vel_rms_z_mm_s = Math.round(velRMS_Z * 1000) / 1000;
      
      console.log(`[Type0 RMS/Peak Z] RMS=${result.rms_z_g}g Peak=${result.peak_z_g}g`);
    }
  }

  return result;
}

// ─── main handler ────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const base44 = createClientFromRequest(req);

  let body;
  try {
    body = await req.json();
  } catch (_) {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Expected: { topic: "SENSORID/report", payload: "HEX: 01 00 ...", qos: 0 }
  const { topic, payload, qos } = body;

  if (!topic || !payload) {
    return Response.json({ error: "Missing topic or payload" }, { status: 400 });
  }

  // Extract sensor_id from topic (e.g. "S9IMP600001265H/report")
  const sensor_id = topic.split('/')[0];
  if (!sensor_id) {
    return Response.json({ error: "Cannot parse sensor_id from topic" }, { status: 400 });
  }

  // Extract hex string — support "HEX: xx xx" prefix or plain hex
  let hexStr = payload;
  if (typeof payload === 'string' && payload.startsWith('HEX: ')) {
    hexStr = payload.slice(5);
  } else if (typeof payload === 'string' && payload.startsWith('HEX:')) {
    hexStr = payload.slice(4);
  }

  // Parse binary data
  let parsed = null;
  let bytes = null;
  try {
    bytes = hexToBytes(hexStr);
    parsed = parseAissensData(bytes);
  } catch (e) {
    console.error("Parse error:", e.message);
  }

  const now = new Date().toISOString();
  const report_type = parsed?.report_type ?? -1;

  // 1. Save raw message
  const msgRecord = await base44.asServiceRole.entities.MqttMessage.create({
    topic,
    sensor_id,
    payload_hex: hexStr.substring(0, 4000), // trim very large payloads
    report_type,
    payload_size: bytes ? bytes.length : 0,
  });

  // 2. Save parsed SensorData
  let sensorDataRecord = null;
  if (parsed) {
    // Use sensor timestamp if available (convert from unix seconds to ISO), otherwise use server time
    const recordTimestamp = parsed.timestamp_unix 
      ? new Date(parsed.timestamp_unix * 1000).toISOString()
      : now;
    
    sensorDataRecord = await base44.asServiceRole.entities.SensorData.create({
      sensor_id,
      report_type,
      timestamp_unix: parsed.timestamp_unix ?? null,
      temperature: parsed.temperature ?? null,
      battery_level: parsed.battery_level ?? null,
      battery_voltage: parsed.battery_voltage ?? null,
      rssi: parsed.rssi ?? null,
      interval: parsed.interval ?? null,
      oa_x: parsed.oa_x ?? null,
      oa_y: parsed.oa_y ?? null,
      oa_z: parsed.oa_z ?? null,
      oa_acc_z: parsed.oa_acc_z ?? null,
      rms_z_g: parsed.rms_z_g ?? null,
      peak_z_g: parsed.peak_z_g ?? null,
      vel_rms_x_mm_s: parsed.vel_rms_x_mm_s ?? null,
      vel_rms_y_mm_s: parsed.vel_rms_y_mm_s ?? null,
      vel_rms_z_mm_s: parsed.vel_rms_z_mm_s ?? null,
      has_fft: parsed.has_fft ?? false,
      has_raw: parsed.has_raw ?? false,
      num_samples: parsed.num_samples ?? null,
      raw_x_json: parsed.has_raw ? JSON.stringify(parsed.raw_x) : null,
      raw_y_json: parsed.has_raw ? JSON.stringify(parsed.raw_y) : null,
      raw_z_json: parsed.has_raw ? JSON.stringify(parsed.raw_z) : null,
      mqtt_message_id: msgRecord.id,
    });

    // 3. Save FFT data if present
    if (parsed.has_fft && sensorDataRecord) {
      await base44.asServiceRole.entities.SensorFFTData.create({
        sensor_id,
        sensor_data_id: sensorDataRecord.id,
        timestamp_unix: parsed.timestamp_unix ?? null,
        frequency_resolution: parsed.frequency_resolution ?? null,
        report_len: parsed.report_len ?? null,
        oa_x: parsed.oa_x ?? null,
        oa_y: parsed.oa_y ?? null,
        oa_z: parsed.oa_z ?? null,
        oa_acc_z: parsed.oa_acc_z ?? null,
        acc_x_json: JSON.stringify(parsed.acc_x ?? []),
        acc_y_json: JSON.stringify(parsed.acc_y ?? []),
        acc_z_json: JSON.stringify(parsed.acc_z ?? []),
        vel_x_json: JSON.stringify(parsed.vel_x ?? []),
        vel_y_json: JSON.stringify(parsed.vel_y ?? []),
        vel_z_json: JSON.stringify(parsed.vel_z ?? []),
      });
    }
  }

  // 4. Update AissensSensor registry
  const existing = await base44.asServiceRole.entities.AissensSensor.filter({ sensor_id });
  const updateData = {
    last_seen: now,
    last_report_type: report_type,
    messages_total: (existing[0]?.messages_total || 0) + 1,
  };
  if (parsed?.battery_level != null) updateData.last_battery_level = parsed.battery_level;
  if (parsed?.battery_voltage != null) updateData.last_battery_voltage = parsed.battery_voltage;
  if (parsed?.temperature != null) updateData.last_temperature = parsed.temperature;
  if (parsed?.rssi != null) updateData.last_signal_strength = parsed.rssi;

  if (existing.length > 0) {
    await base44.asServiceRole.entities.AissensSensor.update(existing[0].id, updateData);
  } else {
    await base44.asServiceRole.entities.AissensSensor.create({
      sensor_id,
      name: sensor_id,
      is_active: true,
      messages_total: 1,
      last_seen: now,
      last_report_type: report_type,
      last_battery_level: parsed?.battery_level ?? null,
      last_battery_voltage: parsed?.battery_voltage ?? null,
      last_temperature: parsed?.temperature ?? null,
    });
  }

  return Response.json({
    ok: true,
    sensor_id,
    report_type,
    parsed: parsed ? true : false,
    has_fft: parsed?.has_fft ?? false,
    mqtt_message_id: msgRecord.id,
    sensor_data_id: sensorDataRecord?.id ?? null,
  });
});