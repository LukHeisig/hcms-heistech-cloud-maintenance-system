import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

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

// ─── DSP Utils ───────────────────────────────────────────────────────────────

function applyHanning(signal) {
  const N = signal.length;
  const windowed = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    const w = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (N - 1)));
    windowed[i] = signal[i] * w;
  }
  return windowed;
}

function performFFT(real, imag, N, dir) {
  let j = 0;
  for (let i = 0; i < N - 1; i++) {
    if (i < j) {
      let tr = real[i], ti = imag[i];
      real[i] = real[j]; imag[i] = imag[j];
      real[j] = tr; imag[j] = ti;
    }
    let k = N >> 1;
    while (k <= j) { j -= k; k >>= 1; }
    j += k;
  }
  for (let len = 2; len <= N; len <<= 1) {
    const halfLen = len >> 1;
    const angle = dir * -2 * Math.PI / len;
    const wReal = Math.cos(angle);
    const wImag = Math.sin(angle);
    for (let i = 0; i < N; i += len) {
      let currWReal = 1;
      let currWImag = 0;
      for (let k = 0; k < halfLen; k++) {
        const uReal = real[i + k];
        const uImag = imag[i + k];
        const vReal = real[i + k + halfLen] * currWReal - imag[i + k + halfLen] * currWImag;
        const vImag = real[i + k + halfLen] * currWImag + imag[i + k + halfLen] * currWReal;
        real[i + k] = uReal + vReal;
        imag[i + k] = uImag + vImag;
        real[i + k + halfLen] = uReal - vReal;
        imag[i + k + halfLen] = uImag - vImag;
        const nextWReal = currWReal * wReal - currWImag * wImag;
        const nextWImag = currWReal * wImag + currWImag * wReal;
        currWReal = nextWReal;
        currWImag = nextWImag;
      }
    }
  }
}

function computeRFFT(signal, fs) {
  let N = 1;
  while (N < signal.length) N *= 2; 
  const real = new Float64Array(N);
  const imag = new Float64Array(N);
  for (let i = 0; i < signal.length; i++) real[i] = signal[i];
  performFFT(real, imag, N, 1);
  const numBins = (N / 2) + 1;
  const amplitudes = new Float64Array(numBins);
  const frequencies = new Float64Array(numBins);
  amplitudes[0] = Math.sqrt(real[0]*real[0] + imag[0]*imag[0]) / N;
  frequencies[0] = 0;
  for (let i = 1; i < numBins; i++) {
    // *2 pro jednostranné spektrum (správná peak amplituda)
    amplitudes[i] = (Math.sqrt(real[i]*real[i] + imag[i]*imag[i]) / N) * 2;
    frequencies[i] = (i * fs) / N;
  }
  return { amplitudes, frequencies };
}

function getVelocitySpectrum(accelAmps, freqs) {
  const velAmps = new Float64Array(accelAmps.length);
  for (let i = 0; i < accelAmps.length; i++) {
    const f = freqs[i];
    if (f === 0) velAmps[i] = 0;
    else velAmps[i] = (accelAmps[i] * 9.80665 / (2 * Math.PI * f)) * 1000;
  }
  return velAmps;
}

function calculateRMSFromSpectrum(amps, freqs, minFreq, maxFreq) {
  // Amps jsou peak amplitudy z jednostranného FFT (normalizované na fyzikální jednotky).
  // Parsevalova věta: RMS = sqrt( sum( (A_peak_i / sqrt(2))^2 ) ) = sqrt( sum(A_i^2) / 2 )
  let sumSq = 0;
  for (let i = 0; i < amps.length; i++) {
    const f = freqs[i];
    if (f >= minFreq && f <= maxFreq && f > 0) {
      sumSq += amps[i] * amps[i];
    }
  }
  return Math.sqrt(sumSq / 2);
}

function computeHilbertEnvelope(signal) {
  let N = 1;
  while (N < signal.length) N *= 2;
  const real = new Float64Array(N);
  const imag = new Float64Array(N);
  for (let i = 0; i < signal.length; i++) real[i] = signal[i];
  performFFT(real, imag, N, 1);
  for (let i = 1; i < N / 2; i++) { real[i] *= 2; imag[i] *= 2; }
  for (let i = N / 2 + 1; i < N; i++) { real[i] = 0; imag[i] = 0; }
  performFFT(real, imag, N, -1);
  const envelope = new Float64Array(signal.length);
  for (let i = 0; i < signal.length; i++) {
    const r = real[i] / N;
    const im = imag[i] / N;
    envelope[i] = Math.sqrt(r*r + im*im);
  }
  return envelope;
}

function getButterworthHPFCoeffs(fc, fs) {
  const getStage = (Q) => {
    const w0 = 2 * Math.PI * fc / fs;
    const alpha = Math.sin(w0) / (2 * Q);
    const cosw0 = Math.cos(w0);
    const a0 = 1 + alpha;
    return {
      b0: ((1 + cosw0) / 2) / a0,
      b1: -(1 + cosw0) / a0,
      b2: ((1 + cosw0) / 2) / a0,
      a1: (-2 * cosw0) / a0,
      a2: (1 - alpha) / a0
    };
  };
  return [getStage(0.5411961), getStage(1.3065630)];
}

function applyBiquads(signal, stages) {
  let output = new Float64Array(signal.length);
  for (let i = 0; i < signal.length; i++) output[i] = signal[i];
  for (const s of stages) {
    const nextOut = new Float64Array(signal.length);
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let i = 0; i < signal.length; i++) {
      const x = output[i];
      const y = s.b0 * x + s.b1 * x1 + s.b2 * x2 - s.a1 * y1 - s.a2 * y2;
      nextOut[i] = y;
      x2 = x1; x1 = x;
      y2 = y1; y1 = y;
    }
    output = nextOut;
  }
  return output;
}

function filtfiltButterworthHPF(signal, fc, fs) {
  const stages = getButterworthHPFCoeffs(fc, fs);
  let forward = applyBiquads(signal, stages);
  let reversed = new Float64Array(signal.length);
  for (let i = 0; i < signal.length; i++) reversed[i] = forward[signal.length - 1 - i];
  let backward = applyBiquads(reversed, stages);
  let result = new Float64Array(signal.length);
  for (let i = 0; i < signal.length; i++) result[i] = backward[signal.length - 1 - i];
  return result;
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
    // tempRaw=0 znamená, že senzor teplotu neposkytl (výsledek by byl přesně 28.0°C) — ignorujeme
    result.temperature = tempRaw !== 0 ? Math.round((tempRaw / 256.0 + 28) * 100) / 100 : null;

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
      
      // Hodnoty se nyní počítají novým klientským DSP modulem.
    }
  }

  // ── Type 9: OA Only ──────────────────────────────────────────────────────
  else if (type === 9) {
    if (data.length < 33) return result;
    result.timestamp_unix = readUint64BE(data, 0);
    result.battery_level = (data[9] >> 4) & 0x0F;
    const lastAdc = (data[12] << 8) | data[13];
    result.battery_voltage = adcToVoltage(lastAdc);
    const tempRaw9 = readInt16BE(data, 14);
    // tempRaw=0 znamená, že senzor teplotu neposkytl (výsledek by byl přesně 28.0°C) — ignorujeme
    result.temperature = tempRaw9 !== 0 ? Math.round((tempRaw9 / 256.0 + 28) * 100) / 100 : null;
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
    
    // Zda zpráva obsahuje JSON zjistíme spolehlivě podle toho, že na pozici 9 začíná znakem '{' (0x7B)
    // Různé verze firmwaru totiž posílají JSON buď při Wakeup, nebo Hibernate.
    if (data.length > 9 && data[9] === 0x7B) {
      try {
        const jsonStr = new TextDecoder().decode(data.slice(9));
        const info = JSON.parse(jsonStr);
        if (info.Temperature != null) result.temperature = parseFloat(info.Temperature);
        if (info.BatVoltage != null) result.battery_voltage = parseFloat(info.BatVoltage);
        if (info.BatteryLevel != null) result.battery_level = parseInt(info.BatteryLevel);
        if (info.SignalStrength != null) result.rssi = parseInt(info.SignalStrength);
        console.log(`[Type4 JSON] temp=${result.temperature} voltage=${result.battery_voltage} level=${result.battery_level} rssi=${result.rssi}`);
      } catch(e) {
        console.log(`[Type4 JSON] parse error: ${e.message}`);
      }
    } else if (data.length >= 17) {
      // Binární data o délkách připojení
      result.online_duration = (data[9] << 8) | data[10];
      result.wifi_online_duration = (data[11] << 8) | data[12];
      result.transmission_duration = (data[13] << 8) | data[14];
      result.battery_usage_time = readUint32BE(data, 15);
      console.log(`[Type4 Binary] online=${result.online_duration}s wifi=${result.wifi_online_duration}s`);
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
    const tempRaw0 = readInt16BE(data, 11);
    // tempRaw=0 znamená, že senzor teplotu neposkytl (výsledek by byl přesně 28.0°C) — ignorujeme
    result.temperature = tempRaw0 !== 0 ? Math.round((tempRaw0 / 256.0 + 28) * 100) / 100 : null;

    // Battery level: [15]
    result.battery_level = data[15] & 0x0F;

    // Last ADC: Int16BE at [16-17]
    const lastAdc = readInt16BE(data, 16);
    result.battery_voltage = Math.round(((lastAdc - 1400) * 0.001547 + 2.7) * 1000) / 1000;

    // Real ODR: Int16BE at [13-14]
    result.real_odr = readInt16BE(data, 13);

    console.log(`[Type0] tempRaw=${tempRaw0} temp=${result.temperature} batLevel=${result.battery_level} lastAdc=${lastAdc} voltage=${result.battery_voltage} odr=${result.real_odr} dataLen=${data.length}`);

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
      
      // Limit samples to first 5000 to avoid database field size issues
      const maxSamples = 5000;
      const trimmedX = rawX.slice(0, maxSamples);
      const trimmedY = rawY.slice(0, maxSamples);
      const trimmedZ = rawZ.slice(0, maxSamples);
      
      // Validace: odmítni záznamy s příliš malým počtem vzorků (< 1000 = nesmyslná data)
      // Správný záznam při 26700 Hz / 1 sec má ~26700 vzorků, minimum akceptujeme 1000
      const MIN_VALID_SAMPLES = 1000;
      if (numSamples < MIN_VALID_SAMPLES) {
        console.log(`[Type0] REJECTED: only ${numSamples} samples (min ${MIN_VALID_SAMPLES}), skipping raw/FFT storage`);
        result.has_raw = false;
        result.has_fft = false;
        result.num_samples = numSamples;
        return result;
      }

      result.raw_x = trimmedX.map(v => Math.round(v * 100000) / 100000);
      result.raw_y = trimmedY.map(v => Math.round(v * 100000) / 100000);
      result.raw_z = trimmedZ.map(v => Math.round(v * 100000) / 100000);
      result.num_samples = numSamples;
      result.has_raw = true;

      // ─── Backend DSP Výpočty ───
      const fs = 26700;
      
      const winZ = applyHanning(rawZ);
      const fftZ = computeRFFT(winZ, fs);
      result.rms_z_g = Math.round(calculateRMSFromSpectrum(fftZ.amplitudes, fftZ.frequencies, 0, fs/2) * 1000) / 1000;

      const winX = applyHanning(rawX);
      const fftX = computeRFFT(winX, fs);
      const velXAmps = getVelocitySpectrum(fftX.amplitudes, fftX.frequencies);
      result.vel_rms_x_mm_s = Math.round(calculateRMSFromSpectrum(velXAmps, fftX.frequencies, 2, 1000) * 1000) / 1000;

      const winY = applyHanning(rawY);
      const fftY = computeRFFT(winY, fs);
      const velYAmps = getVelocitySpectrum(fftY.amplitudes, fftY.frequencies);
      result.vel_rms_y_mm_s = Math.round(calculateRMSFromSpectrum(velYAmps, fftY.frequencies, 2, 1000) * 1000) / 1000;

      const velZAmps = getVelocitySpectrum(fftZ.amplitudes, fftZ.frequencies);
      result.vel_rms_z_mm_s = Math.round(calculateRMSFromSpectrum(velZAmps, fftZ.frequencies, 2, 1000) * 1000) / 1000;

      const filteredZ = filtfiltButterworthHPF(rawZ, 500, fs);
      const envelopeZ = computeHilbertEnvelope(filteredZ);
      const meanEnv = envelopeZ.reduce((a,b)=>a+b,0)/envelopeZ.length;
      const demeanedEnv = new Float64Array(envelopeZ.length);
      for(let i=0;i<envelopeZ.length;i++) demeanedEnv[i] = envelopeZ[i] - meanEnv;
      
      const winEnvZ = applyHanning(demeanedEnv);
      const fftEnvZ = computeRFFT(winEnvZ, fs);
      result.env_rms_z = Math.round(calculateRMSFromSpectrum(fftEnvZ.amplitudes, fftEnvZ.frequencies, 0, fs/2) * 1000) / 1000;

      // Prepare FFT data for storage
      result.has_fft = true;
      const freqRes = fftZ.frequencies[1] || 1;
      result.frequency_resolution = freqRes;
      
      // Vynulování frekvencí pod 2 Hz (odstranění DC a velmi nízkých frekvencí pro požadovaný rozsah 2+ Hz)
      for (let i = 0; i < fftZ.frequencies.length; i++) {
        if (fftZ.frequencies[i] < 2) {
          fftX.amplitudes[i] = 0;
          fftY.amplitudes[i] = 0;
          fftZ.amplitudes[i] = 0;
          velXAmps[i] = 0;
          velYAmps[i] = 0;
          velZAmps[i] = 0;
          fftEnvZ.amplitudes[i] = 0;
        } else {
          break;
        }
      }

      // Výpočet adekvátního počtu čar (bodů) pro požadované maximální frekvence
      const maxVelPoints = Math.ceil(1000 / freqRes) + 1; // Rychlost: rozsah do 1000 Hz
      const maxAccPoints = Math.ceil(6000 / freqRes) + 1; // Zrychlení: rozsah do 6000 Hz
      const maxEnvPoints = Math.ceil(1000 / freqRes) + 1; // Obálka zrychlení: rozsah do 1000 Hz

      result.acc_x = Array.from(fftX.amplitudes.slice(0, maxAccPoints)).map(v => Math.round(v * 100000)/100000);
      result.acc_y = Array.from(fftY.amplitudes.slice(0, maxAccPoints)).map(v => Math.round(v * 100000)/100000);
      result.acc_z = Array.from(fftZ.amplitudes.slice(0, maxAccPoints)).map(v => Math.round(v * 100000)/100000);
      
      result.vel_x = Array.from(velXAmps.slice(0, maxVelPoints)).map(v => Math.round(v * 100000)/100000);
      result.vel_y = Array.from(velYAmps.slice(0, maxVelPoints)).map(v => Math.round(v * 100000)/100000);
      result.vel_z = Array.from(velZAmps.slice(0, maxVelPoints)).map(v => Math.round(v * 100000)/100000);
      
      result.env_z = Array.from(fftEnvZ.amplitudes.slice(0, maxEnvPoints)).map(v => Math.round(v * 100000)/100000);
      result.report_len = result.acc_z.length;
    }
  }

  return result;
}

// ─── main handler ────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  // Ověření webhook tokenu
  const token = req.headers.get("x-webhook-token") || req.headers.get("authorization")?.replace("Bearer ", "");
  const expectedToken = Deno.env.get("VIBRATION_API_TOKEN");
  if (expectedToken && token !== expectedToken) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
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
  let hexStr = typeof payload === 'string' ? payload : String(payload);
  if (hexStr.startsWith('HEX: ')) {
    hexStr = hexStr.slice(5);
  } else if (hexStr.startsWith('HEX:')) {
    hexStr = hexStr.slice(4);
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
      env_rms_z: parsed.env_rms_z ?? null,
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
        oa_x: parsed.oa_x ?? parsed.vel_rms_x_mm_s ?? null,
        oa_y: parsed.oa_y ?? parsed.vel_rms_y_mm_s ?? null,
        oa_z: parsed.oa_z ?? parsed.vel_rms_z_mm_s ?? null,
        oa_acc_z: parsed.oa_acc_z ?? null,
        acc_x_json: JSON.stringify(parsed.acc_x ?? []),
        acc_y_json: JSON.stringify(parsed.acc_y ?? []),
        acc_z_json: JSON.stringify(parsed.acc_z ?? []),
        vel_x_json: JSON.stringify(parsed.vel_x ?? []),
        vel_y_json: JSON.stringify(parsed.vel_y ?? []),
        vel_z_json: JSON.stringify(parsed.vel_z ?? []),
        env_z_json: JSON.stringify(parsed.env_z ?? []),
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