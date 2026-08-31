import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { secrets } from 'base44:runtime';

// ═════════════════════════════════════════════════════════════════════════════
// AISSENS vibration webhook — opravená verze (DSP v2)
//
// Jednotky: zrychlení všude v [g], rychlost v [mm/s], teplota v [°C].
// POZOR: hodnoty rms_z_g a vel_rms_* se oproti v1 číselně mění.
// ═════════════════════════════════════════════════════════════════════════════

const DSP_VERSION = 2;

// ─── helpers ────────────────────────────────────────────────────────────────

function hexToBytes(hex) {
  const clean = hex.replace(/\s+/g, '');
  const bytes = new Uint8Array(Math.floor(clean.length / 2));
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

function adcToVoltage(adc) {
  return Math.round(((adc - 1400) * 0.001547 + 2.7) * 1000) / 1000;
}

// Baterie: úroveň odvozujeme z napětí (spolehlivé), NE z bajtu úrovně od senzoru.
// Filtr věrohodnosti: napětí mimo rozsah 2.5–4.0 V = poškozený rámec → data ignorujeme.
function evaluateBattery(voltage) {
  if (voltage == null || !isFinite(voltage) || voltage < 2.5 || voltage > 4.0) {
    return { level: null, voltage: null };
  }
  let level;
  if (voltage >= 3.30) level = 4;
  else if (voltage >= 3.15) level = 3;
  else if (voltage >= 3.00) level = 2;
  else if (voltage >= 2.85) level = 1;
  else level = 0;
  return { level, voltage };
}

function calcRMS(arr) {
  if (!arr || arr.length === 0) return null;
  const sum = arr.reduce((s, v) => s + v * v, 0);
  return Math.sqrt(sum / arr.length);
}

// Odečtení stejnosměrné složky — nutné PŘED filtfilt, jinak velký DC krok
// (gravitace ~1 g) vytvoří na okrajích signálu přechodový děj.
function removeMean(arr) {
  let sum = 0;
  for (let i = 0; i < arr.length; i++) sum += arr[i];
  const mean = sum / arr.length;
  const out = new Float64Array(arr.length);
  for (let i = 0; i < arr.length; i++) out[i] = arr[i] - mean;
  return out;
}

// Konstantně-časové porovnání tokenů.
function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// ─── DSP Utils ───────────────────────────────────────────────────────────────

// Hanningovo okno. Vrací i sumy potřebné pro správnou normalizaci spektra:
//   windowSum   = koherentní zisk okna (normalizace amplitud)
//   windowSumSq = pro energetickou korekci (výpočet RMS)
function applyHanning(signal) {
  const N = signal.length;
  const windowed = new Float64Array(N);
  let sum = 0, sumSq = 0;
  for (let i = 0; i < N; i++) {
    const w = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (N - 1)));
    windowed[i] = signal[i] * w;
    sum += w;
    sumSq += w * w;
  }
  return { windowed, windowSum: sum, windowSumSq: sumSq };
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

// Jednostranné amplitudové spektrum (špičkové amplitudy ve fyzikálních jednotkách).
//
// OPRAVA v2: normalizuje se koherentním ziskem okna (windowSum), NE délkou FFT N.
// Signál se doplňuje nulami na mocninu dvou (13350 → 16384); dělení N tedy
// ve v1 podhodnocovalo všechny amplitudy faktorem L/N ≈ 0,815 (−18,5 %).
function computeRFFT(signal, fs, windowSum = null) {
  const L = signal.length;
  let N = 1;
  while (N < L) N *= 2;
  const real = new Float64Array(N);
  const imag = new Float64Array(N);
  for (let i = 0; i < L; i++) real[i] = signal[i];
  performFFT(real, imag, N, 1);

  const numBins = (N / 2) + 1;
  const amplitudes = new Float64Array(numBins);
  const frequencies = new Float64Array(numBins);
  const cg = windowSum ?? L; // koherentní zisk okna (bez okna = délka signálu)

  amplitudes[0] = Math.sqrt(real[0]*real[0] + imag[0]*imag[0]) / cg; // DC — bez ×2
  frequencies[0] = 0;
  for (let i = 1; i < numBins; i++) {
    // ×2 = jednostranné spektrum; kompenzace útlumu okna je už v dělení cg
    amplitudes[i] = (Math.sqrt(real[i]*real[i] + imag[i]*imag[i]) / cg) * 2;
    frequencies[i] = (i * fs) / N;
  }
  return { amplitudes, frequencies, N, L };
}

// Integrace zrychlení [g] → rychlost [mm/s] ve frekvenční oblasti.
function getVelocitySpectrum(accelAmpsG, freqs) {
  const velAmps = new Float64Array(accelAmpsG.length);
  for (let i = 0; i < accelAmpsG.length; i++) {
    const f = freqs[i];
    if (f === 0) velAmps[i] = 0;
    else velAmps[i] = (accelAmpsG[i] * 9.80665 / (2 * Math.PI * f)) * 1000;
  }
  return velAmps;
}

// RMS v pásmu z amplitudového spektra.
//
// OPRAVA v2: parametr `corr` = windowSum² / (N · windowSumSq) — energetická
// korekce, která současně řeší (a) rozdíl mezi amplitudovým a energetickým
// korekčním faktorem okna a (b) rozprostření energie zero-paddingem.
// Bez ní RMS ve v1 nadhodnocovala zhruba o 33 %.
function calculateRMSFromSpectrum(amps, freqs, minFreq, maxFreq, corr = 1) {
  let sumSq = 0;
  for (let i = 0; i < amps.length; i++) {
    const f = freqs[i];
    if (f >= minFreq && f <= maxFreq && f > 0) {
      sumSq += amps[i] * amps[i];
    }
  }
  return Math.sqrt((sumSq / 2) * corr);
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

// Nulová fáze: filtrace dopředu i pozpátku (efektivně 4. řád).
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

function parseAissensData(bytes, fftLowCutHz = 2) {
  if (!bytes || bytes.length < 5) return null;

  const type = bytes[0];
  // bytes 1-4: data length (big-endian uint32)
  const dataLength = readUint32BE(bytes, 1);
  const data = bytes.slice(5); // data field starts at byte 5

  const result = { report_type: type, dsp_version: DSP_VERSION };

  // OPRAVA v2: deklarovaná délka se ověřuje — uříznuté rámce se zahodí.
  if (dataLength > 0 && data.length < dataLength) {
    console.log(`[Parse] TRUNCATED frame: declared ${dataLength} B, got ${data.length} B — zahazuji`);
    result.truncated = true;
    return result;
  }

  // ── Type 1: FFT ──────────────────────────────────────────────────────────
  if (type === 1) {
    if (data.length < 45) return result;
    result.timestamp_unix = readUint64BE(data, 0);
    // OPRAVA v2: úroveň z napětí, nibble od senzoru ignorujeme (viz evaluateBattery)
    const lastAdc1 = (data[12] << 8) | data[13];
    const bat1 = evaluateBattery(adcToVoltage(lastAdc1));
    result.battery_level = bat1.level;
    result.battery_voltage = bat1.voltage;

    const tempRaw = readInt16BE(data, 14);
    // tempRaw=0 znamená, že senzor teplotu neposkytl (výsledek by byl přesně 28.0°C) — ignorujeme
    result.temperature = tempRaw !== 0 ? Math.round((tempRaw / 256.0 + 28) * 100) / 100 : null;

    // OA X,Y,Z at offset 16 (3 * float32 LE)
    result.oa_x = Math.round(readFloat32LE(data, 16) * 10000) / 10000;
    result.oa_y = Math.round(readFloat32LE(data, 20) * 10000) / 10000;
    result.oa_z = Math.round(readFloat32LE(data, 24) * 10000) / 10000;

    result.frequency_resolution = Math.round(readFloat32LE(data, 28) * 10000) / 10000;
    result.fft_length = readUint32BE(data, 32);
    result.fft_lines = readUint32BE(data, 36);
    // reserved 5 bytes at 40, FFT data od offsetu 45

    const fftOffset = 45;
    const reportLen = result.fft_lines;

    if (reportLen > 0 && data.length >= fftOffset + reportLen * 4 * 6) {
      const maxPoints = Math.min(reportLen, 512);
      const readAxis = (base) => {
        const out = [];
        for (let i = 0; i < maxPoints; i++) {
          out.push(Math.round(readFloat32LE(data, base + i * 4) * 100000) / 100000);
        }
        return out;
      };
      result.acc_x = readAxis(fftOffset);
      result.acc_y = readAxis(fftOffset + reportLen * 4);
      result.acc_z = readAxis(fftOffset + reportLen * 4 * 2);
      result.vel_x = readAxis(fftOffset + reportLen * 4 * 3);
      result.vel_y = readAxis(fftOffset + reportLen * 4 * 4);
      result.vel_z = readAxis(fftOffset + reportLen * 4 * 5);

      result.has_fft = true;
      // OPRAVA v2: calcRMS může vrátit null → v1 z toho udělala 0
      const rmsAccZ = calcRMS(result.acc_z);
      result.oa_acc_z = rmsAccZ != null ? Math.round(rmsAccZ * 10000) / 10000 : null;
    }
  }

  // ── Type 9: OA Only ──────────────────────────────────────────────────────
  else if (type === 9) {
    if (data.length < 33) return result;
    result.timestamp_unix = readUint64BE(data, 0);
    const lastAdc9 = (data[12] << 8) | data[13];
    const bat9 = evaluateBattery(adcToVoltage(lastAdc9));
    result.battery_level = bat9.level;
    result.battery_voltage = bat9.voltage;
    const tempRaw9 = readInt16BE(data, 14);
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
      const feat = JSON.parse(jsonStr);
      result.temperature = feat.Temperature != null ? parseFloat(feat.Temperature) : null;
      const bat2 = evaluateBattery(feat.BatVoltage != null ? parseFloat(feat.BatVoltage) : null);
      result.battery_voltage = bat2.voltage;
      result.battery_level = bat2.level;
      result.feature_json = jsonStr;
    } catch (_) {}
  }

  // ── Type 3: Battery ──────────────────────────────────────────────────────
  else if (type === 3) {
    if (data.length < 11) return result;
    result.timestamp_unix = readUint64BE(data, 0);
    const lastAdc3 = (data[9] << 8) | data[10];
    const bat3 = evaluateBattery(adcToVoltage(lastAdc3));
    result.battery_level = bat3.level;
    result.battery_voltage = bat3.voltage;
  }

  // ── Type 4: Hibernate/Wakeup ─────────────────────────────────────────────
  // Per spec v1.7:
  //   Hibernate: Timestamp(8B) | Status(1B) | Sensor Information(json string)
  //   Wakeup:    Timestamp(8B) | Status(1B) | OnlineDuration(2B) | WiFiOnlineDuration(2B)
  //              | TransmissionDuration(2B) | BatteryUsageTime(4B)
  else if (type === 4) {
    if (data.length < 9) return result;
    result.timestamp_unix = readUint64BE(data, 0);
    result.status_code = data[8];

    // Zda zpráva obsahuje JSON zjistíme spolehlivě podle toho, že na pozici 9 začíná znakem '{' (0x7B).
    // Různé verze firmwaru totiž posílají JSON buď při Wakeup, nebo Hibernate.
    if (data.length > 9 && data[9] === 0x7B) {
      try {
        const jsonStr = new TextDecoder().decode(data.slice(9));
        const info = JSON.parse(jsonStr);
        if (info.Temperature != null) result.temperature = parseFloat(info.Temperature);
        if (info.BatVoltage != null) {
          const bat4 = evaluateBattery(parseFloat(info.BatVoltage));
          result.battery_voltage = bat4.voltage;
          result.battery_level = bat4.level;
        }
        if (info.SignalStrength != null) result.rssi = parseInt(info.SignalStrength);
        console.log(`[Type4 JSON] temp=${result.temperature} voltage=${result.battery_voltage} level=${result.battery_level} rssi=${result.rssi}`);
      } catch (e) {
        console.log(`[Type4 JSON] parse error: ${e.message}`);
      }
    } else if (data.length >= 19) {
      // OPRAVA v2: battery_usage_time je uint32 na [15..18] → potřeba 19 B, ne 17
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
  //   [15]    Battery information (1B) — ignorujeme (nespolehlivé pod zátěží)
  //   [16-17] Last ADC (2B, Int16BE) → voltage = (adc-1400)*0.001547+2.7
  //   [18-19] Average ADC (2B, Int16BE)
  //   [20..]  Acceleration data: x(2B LE), y(2B LE), z(2B LE) per sample
  else if (type === 0) {
    if (data.length < 20) return result;
    result.timestamp_unix = readUint64BE(data, 0);

    const tempRaw0 = readInt16BE(data, 11);
    result.temperature = tempRaw0 !== 0 ? Math.round((tempRaw0 / 256.0 + 28) * 100) / 100 : null;

    const lastAdc = readInt16BE(data, 16);
    const bat0 = evaluateBattery(adcToVoltage(lastAdc));
    result.battery_level = bat0.level;
    result.battery_voltage = bat0.voltage;

    result.real_odr = readInt16BE(data, 13);

    // OPRAVA v2: fs se odvozuje jednou a používá se ve VŠECH filtrech
    // (v1 měla v HP filtru natvrdo 26700 Hz bez ohledu na skutečné ODR).
    const fs = (result.real_odr >= 1000 && result.real_odr <= 30000) ? result.real_odr : 26700;
    result.fs_used = fs;

    console.log(`[Type0] tempRaw=${tempRaw0} temp=${result.temperature} lastAdc=${lastAdc} voltage=${result.battery_voltage} odr=${result.real_odr} fs=${fs} dataLen=${data.length}`);

    const samplesOffset = 20;
    const remainingBytes = data.length - samplesOffset;
    if (remainingBytes < 6) return result;

    const numSamples = Math.floor(remainingBytes / 6);
    result.num_samples = numSamples;

    // Validace: odmítni záznamy s příliš malým počtem vzorků (< 1000 = nesmyslná data).
    // Správný záznam při 26700 Hz / 1 s má ~26700 vzorků.
    const MIN_VALID_SAMPLES = 1000;
    if (numSamples < MIN_VALID_SAMPLES) {
      console.log(`[Type0] REJECTED: only ${numSamples} samples (min ${MIN_VALID_SAMPLES}), skipping raw/FFT storage`);
      result.has_raw = false;
      result.has_fft = false;
      return result;
    }

    // Little-endian Int16, dvojkový doplněk → g
    // 0.0002441062 ≈ 8/32768 = LSB akcelerometru ±8 g. Jednotka je [g], NE m/s².
    const ADC_TO_G = 0.0002441062;
    const rawXa = new Float64Array(numSamples);
    const rawYa = new Float64Array(numSamples);
    const rawZa = new Float64Array(numSamples);
    const toSigned16 = (v) => (v >= 0x8000 ? v - 0x10000 : v);
    for (let i = 0; i < numSamples; i++) {
      const off = samplesOffset + i * 6;
      rawXa[i] = toSigned16((data[off+1] << 8) | data[off])   * ADC_TO_G;
      rawYa[i] = toSigned16((data[off+3] << 8) | data[off+2]) * ADC_TO_G;
      rawZa[i] = toSigned16((data[off+5] << 8) | data[off+4]) * ADC_TO_G;
    }

    // OPRAVA v2: de-mean + zero-phase Butterworth HP 10 Hz místo jednopólového
    // kauzálního filtru → žádný přechodový děj na začátku, žádný fázový posun.
    const rawX = filtfiltButterworthHPF(removeMean(rawXa), 10, fs);
    const rawY = filtfiltButterworthHPF(removeMean(rawYa), 10, fs);
    const rawZ = filtfiltButterworthHPF(removeMean(rawZa), 10, fs);

    // Uložení raw dat (omezeno kvůli velikosti pole v DB)
    const maxSamples = 5000;
    const round5 = (v) => Math.round(v * 100000) / 100000;
    result.raw_x = Array.from(rawX.slice(0, maxSamples), round5);
    result.raw_y = Array.from(rawY.slice(0, maxSamples), round5);
    result.raw_z = Array.from(rawZ.slice(0, maxSamples), round5);
    result.has_raw = true;

    // ─── DSP Pipeline: 4× 0,5 s segmentace → FFT → průměrování → RMS ────────
    const NUM_SEGMENTS = 4;
    const segLen = Math.floor(fs * 0.5);

    if (rawZ.length < segLen) {
      console.log(`[Type0] DSP SKIP: signal too short for segmentation (${rawZ.length} < ${segLen})`);
      result.has_fft = false;
      return result;
    }

    // Průměr N spekter pro jednu osu.
    // OPRAVA v2: průměruje se VÝKON (|A|²), ne amplituda — amplitudové
    // průměrování podhodnocuje náhodné složky (šum ložisek, kavitace).
    function computeAveragedFFT(signal, axisName) {
      const numSeg = Math.min(NUM_SEGMENTS, Math.floor(signal.length / segLen));
      if (numSeg < 1) {
        console.log(`[DSP] ${axisName}: SKIP — 0 segments`);
        return null;
      }
      let sumPow = null, freqs = null, corr = 1;
      for (let s = 0; s < numSeg; s++) {
        const seg = signal.slice(s * segLen, (s + 1) * segLen);
        const { windowed, windowSum, windowSumSq } = applyHanning(seg);
        const fft = computeRFFT(windowed, fs, windowSum);
        if (!sumPow) {
          sumPow = new Float64Array(fft.amplitudes.length);
          freqs = fft.frequencies;
        }
        for (let i = 0; i < fft.amplitudes.length; i++) {
          sumPow[i] += fft.amplitudes[i] * fft.amplitudes[i];
        }
        // energetická korekce (okno + zero-padding); pro všechny segmenty stejná
        corr = (windowSum * windowSum) / (fft.N * windowSumSq);
      }
      const avgAmps = new Float64Array(sumPow.length);
      for (let i = 0; i < sumPow.length; i++) avgAmps[i] = Math.sqrt(sumPow[i] / numSeg);
      console.log(`[DSP] ${axisName}: ${numSeg} segments, bins=${avgAmps.length}, binWidth=${freqs[1]?.toFixed(4)} Hz, corr=${corr.toFixed(4)}`);
      return { avgAmps, frequencies: freqs, corr };
    }

    const fftX = computeAveragedFFT(rawX, 'X');
    const fftY = computeAveragedFFT(rawY, 'Y');
    const fftZ = computeAveragedFFT(rawZ, 'Z');
    if (!fftX || !fftY || !fftZ) {
      result.has_fft = false;
      return result;
    }

    // Rychlostní spektra [mm/s] — integrace zrychlení [g] ve frekvenční oblasti
    const velXAmps = getVelocitySpectrum(fftX.avgAmps, fftX.frequencies);
    const velYAmps = getVelocitySpectrum(fftY.avgAmps, fftY.frequencies);
    const velZAmps = getVelocitySpectrum(fftZ.avgAmps, fftZ.frequencies);

    // Obálka: HP 500 Hz → Hilbertova obálka → de-mean → průměrované FFT
    const filteredZHP = filtfiltButterworthHPF(rawZ, 500, fs);
    const envelopeZ = computeHilbertEnvelope(filteredZHP);
    const fftEnvZ = computeAveragedFFT(removeMean(envelopeZ), 'EnvZ');

    // ─── Celkové hodnoty (RMS) z průměrných spekter ─────────────────────────
    const r3 = (v) => Math.round(v * 1000) / 1000;
    // Rychlost XYZ [mm/s]: fftLowCutHz–1000 Hz
    result.vel_rms_x_mm_s = r3(calculateRMSFromSpectrum(velXAmps, fftX.frequencies, fftLowCutHz, 1000, fftX.corr));
    result.vel_rms_y_mm_s = r3(calculateRMSFromSpectrum(velYAmps, fftY.frequencies, fftLowCutHz, 1000, fftY.corr));
    result.vel_rms_z_mm_s = r3(calculateRMSFromSpectrum(velZAmps, fftZ.frequencies, fftLowCutHz, 1000, fftZ.corr));
    // Zrychlení Z [g]: fftLowCutHz–6000 Hz
    // OPRAVA v2: spektrum je už v g — žádné dělení 9,80665 (v1 dělila navíc).
    result.rms_z_g = r3(calculateRMSFromSpectrum(fftZ.avgAmps, fftZ.frequencies, fftLowCutHz, 6000, fftZ.corr));
    // Obálka Z [g]: fftLowCutHz–1000 Hz
    result.env_rms_z = fftEnvZ
      ? r3(calculateRMSFromSpectrum(fftEnvZ.avgAmps, fftEnvZ.frequencies, fftLowCutHz, 1000, fftEnvZ.corr))
      : null;

    console.log(`[DSP] low_cut=${fftLowCutHz}Hz | vel_rms x=${result.vel_rms_x_mm_s} y=${result.vel_rms_y_mm_s} z=${result.vel_rms_z_mm_s} mm/s | acc_z=${result.rms_z_g} g | env_z=${result.env_rms_z} g`);

    // ─── Příprava FFT dat pro uložení do DB ─────────────────────────────────
    result.has_fft = true;
    const binWidth = fftZ.frequencies[1] || 1;
    result.frequency_resolution = binWidth;    // rozteč čar (po zero-paddingu)
    result.true_resolution_hz = fs / segLen;   // skutečná rozlišovací schopnost

    // Vynulování frekvencí pod fftLowCutHz (DC + velmi nízké frekvence)
    for (let i = 0; i < fftZ.frequencies.length; i++) {
      if (fftZ.frequencies[i] >= fftLowCutHz) break;
      fftX.avgAmps[i] = 0; fftY.avgAmps[i] = 0; fftZ.avgAmps[i] = 0;
      velXAmps[i] = 0; velYAmps[i] = 0; velZAmps[i] = 0;
      if (fftEnvZ) fftEnvZ.avgAmps[i] = 0;
    }

    const maxVelPoints = Math.ceil(1000 / binWidth) + 1;  // vel: low_cut–1000 Hz
    const maxAccPoints = Math.ceil(6000 / binWidth) + 1;  // acc: low_cut–6000 Hz
    const maxEnvPoints = Math.ceil(1000 / binWidth) + 1;  // env: low_cut–1000 Hz

    result.acc_x = Array.from(fftX.avgAmps.slice(0, maxAccPoints), round5);
    result.acc_y = Array.from(fftY.avgAmps.slice(0, maxAccPoints), round5);
    result.acc_z = Array.from(fftZ.avgAmps.slice(0, maxAccPoints), round5);
    result.vel_x = Array.from(velXAmps.slice(0, maxVelPoints), round5);
    result.vel_y = Array.from(velYAmps.slice(0, maxVelPoints), round5);
    result.vel_z = Array.from(velZAmps.slice(0, maxVelPoints), round5);
    result.env_z = fftEnvZ ? Array.from(fftEnvZ.avgAmps.slice(0, maxEnvPoints), round5) : [];
    result.fft_lines = result.acc_z.length;
  }

  return result;
}

// ─── main handler ────────────────────────────────────────────────────────────

export default async function(req) {
  if (req.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  // OPRAVA v2: fail-closed — chybějící token dřív znamenal otevřený endpoint
  const expectedToken = secrets.get("VIBRATION_API_TOKEN");
  if (!expectedToken) {
    console.error("VIBRATION_API_TOKEN není nastaven — odmítám požadavek");
    return Response.json({ error: "Server misconfigured" }, { status: 500 });
  }
  const token = req.headers.get("x-webhook-token")
    || req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!safeEqual(token ?? "", expectedToken)) {
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
  const { topic, payload } = body;
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
  if (hexStr.startsWith('HEX: ')) hexStr = hexStr.slice(5);
  else if (hexStr.startsWith('HEX:')) hexStr = hexStr.slice(4);

  let bytes = null;
  try {
    bytes = hexToBytes(hexStr);
  } catch (_) {
    return Response.json({ error: "Invalid hex payload" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const nowSec = Math.floor(Date.now() / 1000);

  // ─── FILTRACE ZPRÁV ────────────────────────────────────────────────────────
  // Akceptujeme POUZE Type 0 (RAW) pro plné zpracování.
  // Type 4 (Hibernate/Wakeup) zpracujeme částečně — jen metadata (baterie, teplota, rssi).
  //
  // OPRAVA v2: typ se zjišťuje z prvního bajtu PŘED parsováním — zahazované
  // Type 1 zprávy se tak už zbytečně nedekódují (6 × 512 floatů na zprávu).
  const report_type = bytes.length > 0 ? bytes[0] : -1;

  if (report_type !== 0 && report_type !== 4) {
    console.log(`[Filter] Discarding report_type=${report_type} for sensor ${sensor_id}`);
    try {
      const existingSensor = await base44.asServiceRole.entities.AissensSensor.filter({ sensor_id });
      if (existingSensor.length > 0) {
        await base44.asServiceRole.entities.AissensSensor.update(existingSensor[0].id, {
          last_seen: now,
          messages_total: (existingSensor[0].messages_total || 0) + 1,
        });
      }
    } catch (e) {
      console.error("[Filter] registry update failed:", e.message);
    }
    return Response.json({ ok: true, sensor_id, report_type, action: "discarded" });
  }

  // ─── Type 4: jen metadata, bez SensorData záznamu ──────────────────────────
  if (report_type === 4) {
    let parsed4 = null;
    try {
      parsed4 = parseAissensData(bytes, 2);
    } catch (e) {
      console.error("Parse error (type 4):", e.message);
    }
    console.log(`[Filter] Type 4 — metadata only for sensor ${sensor_id}`);
    try {
      const existing4 = await base44.asServiceRole.entities.AissensSensor.filter({ sensor_id });
      const metaUpdate = {
        last_seen: now,
        last_report_type: report_type,
        messages_total: (existing4[0]?.messages_total || 0) + 1,
      };
      if (parsed4?.battery_level != null) metaUpdate.last_battery_level = parsed4.battery_level;
      if (parsed4?.battery_voltage != null) metaUpdate.last_battery_voltage = parsed4.battery_voltage;
      if (parsed4?.temperature != null) metaUpdate.last_temperature = parsed4.temperature;
      if (parsed4?.rssi != null) metaUpdate.last_signal_strength = parsed4.rssi;

      if (existing4.length > 0) {
        await base44.asServiceRole.entities.AissensSensor.update(existing4[0].id, metaUpdate);
      } else {
        await base44.asServiceRole.entities.AissensSensor.create({ sensor_id, name: sensor_id, is_active: true, ...metaUpdate });
      }
    } catch (e) {
      console.error("[Type4] registry update failed:", e.message);
      return Response.json({ error: "Storage failed" }, { status: 500 });
    }
    return Response.json({ ok: true, sensor_id, report_type, action: "metadata_only" });
  }

  // ─── Od zde zpracováváme POUZE Type 0 (RAW) ────────────────────────────────

  // Načtení nastavení (fft_low_cut_hz) z MqttSettings
  let fftLowCutHz = 2;
  try {
    const mqttSettings = await base44.asServiceRole.entities.MqttSettings.list(null, 1);
    if (mqttSettings[0]?.fft_low_cut_hz != null) fftLowCutHz = mqttSettings[0].fft_low_cut_hz;
  } catch (_) { /* použijeme default 2 Hz */ }

  let parsed = null;
  try {
    parsed = parseAissensData(bytes, fftLowCutHz);
  } catch (e) {
    console.error("Parse error:", e.message);
  }
  if (!parsed) {
    return Response.json({ error: "Parse failed" }, { status: 422 });
  }

  // OPRAVA v2: jedna časová značka pro SensorData i SensorTrendPoint,
  // se sanity checkem (firmware bez NTP posílá 0 nebo nesmysly).
  const tsValid = parsed.timestamp_unix > 1500000000 && parsed.timestamp_unix < nowSec + 86400;
  const tsUnix = tsValid ? parsed.timestamp_unix : nowSec;
  const recordTimestamp = new Date(tsUnix * 1000).toISOString();
  if (!tsValid && parsed.timestamp_unix) {
    console.log(`[TS] nedůvěryhodný timestamp ze senzoru (${parsed.timestamp_unix}), používám čas serveru`);
  }

  let msgRecord = null;
  let sensorDataRecord = null;
  const warnings = [];

  try {
    // 1. Save raw message
    // OPRAVA v2: u Type 0 má hex ~160 kB; uříznutý zlomek na 4000 znaků byl
    // k ničemu (nešlo z něj přeparsovat), takže se pro RAW neukládá vůbec.
    msgRecord = await base44.asServiceRole.entities.MqttMessage.create({
      topic,
      sensor_id,
      payload_hex: null,
      report_type,
      payload_size: bytes.length,
    });

    // 2. Save parsed SensorData
    sensorDataRecord = await base44.asServiceRole.entities.SensorData.create({
      sensor_id,
      report_type,
      timestamp_unix: tsUnix,
      recorded_at: recordTimestamp,
      dsp_version: DSP_VERSION,
      temperature: parsed.temperature ?? null,
      battery_level: parsed.battery_level ?? null,
      battery_voltage: parsed.battery_voltage ?? null,
      rssi: parsed.rssi ?? null,

      oa_x: parsed.oa_x ?? null,
      oa_y: parsed.oa_y ?? null,
      oa_z: parsed.oa_z ?? null,
      oa_acc_z: parsed.oa_acc_z ?? null,
      rms_z_g: parsed.rms_z_g ?? null,
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
  } catch (e) {
    console.error("[Storage] SensorData write failed:", e.message);
    return Response.json({ error: "Storage failed", detail: e.message }, { status: 500 });
  }

  // 3. SensorTrendPoint (lightweight trend record)
  if (parsed.has_fft && sensorDataRecord &&
      (parsed.vel_rms_x_mm_s > 0 || parsed.vel_rms_y_mm_s > 0 || parsed.vel_rms_z_mm_s > 0)) {
    try {
      await base44.asServiceRole.entities.SensorTrendPoint.create({
        sensor_id,
        sensor_data_id: sensorDataRecord.id,
        timestamp_unix: tsUnix,
        dsp_version: DSP_VERSION,
        vel_rms_x_mm_s: parsed.vel_rms_x_mm_s ?? null,
        vel_rms_y_mm_s: parsed.vel_rms_y_mm_s ?? null,
        vel_rms_z_mm_s: parsed.vel_rms_z_mm_s ?? null,
        rms_z_g: parsed.rms_z_g ?? null,
        env_rms_z: parsed.env_rms_z ?? null,
        temperature: parsed.temperature ?? null,
      });
    } catch (e) {
      console.error("[Storage] SensorTrendPoint write failed:", e.message);
      warnings.push("trend_point_failed");
    }
  }

  // 3b. FFT data
  if (parsed.has_fft && sensorDataRecord) {
    try {
      await base44.asServiceRole.entities.SensorFFTData.create({
        sensor_id,
        sensor_data_id: sensorDataRecord.id,
        timestamp_unix: tsUnix,
        dsp_version: DSP_VERSION,
        frequency_resolution: parsed.frequency_resolution ?? null,
        true_resolution_hz: parsed.true_resolution_hz ?? null,
        report_len: parsed.fft_lines ?? null,
        oa_x: parsed.vel_rms_x_mm_s ?? null,
        oa_y: parsed.vel_rms_y_mm_s ?? null,
        oa_z: parsed.vel_rms_z_mm_s ?? null,
        oa_acc_z: parsed.rms_z_g ?? null,
        acc_x_json: JSON.stringify(parsed.acc_x ?? []),
        acc_y_json: JSON.stringify(parsed.acc_y ?? []),
        acc_z_json: JSON.stringify(parsed.acc_z ?? []),
        vel_x_json: JSON.stringify(parsed.vel_x ?? []),
        vel_y_json: JSON.stringify(parsed.vel_y ?? []),
        vel_z_json: JSON.stringify(parsed.vel_z ?? []),
        env_z_json: JSON.stringify(parsed.env_z ?? []),
      });
    } catch (e) {
      console.error("[Storage] SensorFFTData write failed:", e.message);
      warnings.push("fft_data_failed");
    }
  }

  // 4. Update AissensSensor registry
  try {
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
        ...updateData,
      });
    }
  } catch (e) {
    console.error("[Storage] registry update failed:", e.message);
    warnings.push("registry_failed");
  }

  return Response.json({
    ok: true,
    sensor_id,
    report_type,
    dsp_version: DSP_VERSION,
    parsed: true,
    has_fft: parsed?.has_fft ?? false,
    mqtt_message_id: msgRecord?.id ?? null,
    sensor_data_id: sensorDataRecord?.id ?? null,
    warnings,
  });
}