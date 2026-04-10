/**
 * DSP Utils for processing Vibration Data
 * - Hanning window
 * - Real FFT (Cooley-Tukey Radix-2)
 * - Frequency domain integration
 * - RMS calculation from spectrum
 * - Butterworth 4th Order Zero-Phase High-pass filter
 * - Hilbert Transform (Envelope)
 */

export function applyHanning(signal) {
  const N = signal.length;
  const windowed = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    const w = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (N - 1)));
    windowed[i] = signal[i] * w;
  }
  return windowed;
}

export function computeRFFT(signal, fs) {
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
    amplitudes[i] = (Math.sqrt(real[i]*real[i] + imag[i]*imag[i]) / N) * 4; 
    frequencies[i] = (i * fs) / N;
  }
  
  return { amplitudes, frequencies };
}

export function getVelocitySpectrum(accelAmps, freqs) {
  const velAmps = new Float64Array(accelAmps.length);
  for (let i = 0; i < accelAmps.length; i++) {
    const f = freqs[i];
    if (f === 0) velAmps[i] = 0;
    else velAmps[i] = (accelAmps[i] * 9.80665 / (2 * Math.PI * f)) * 1000;
  }
  return velAmps;
}

export function calculateRMSFromSpectrum(amps, freqs, minFreq, maxFreq) {
  let sumSq = 0;
  for (let i = 0; i < amps.length; i++) {
    const f = freqs[i];
    if (f >= minFreq && f <= maxFreq && f > 0) {
      const rmsBin = amps[i] / Math.SQRT2;
      sumSq += rmsBin * rmsBin;
    }
  }
  return Math.sqrt(sumSq);
}

export function computeHilbertEnvelope(signal) {
  let N = 1;
  while (N < signal.length) N *= 2;
  
  const real = new Float64Array(N);
  const imag = new Float64Array(N);
  for (let i = 0; i < signal.length; i++) real[i] = signal[i];
  
  performFFT(real, imag, N, 1);
  
  for (let i = 1; i < N / 2; i++) {
    real[i] *= 2; imag[i] *= 2;
  }
  for (let i = N / 2 + 1; i < N; i++) {
    real[i] = 0; imag[i] = 0;
  }
  
  performFFT(real, imag, N, -1);
  
  const envelope = new Float64Array(signal.length);
  for (let i = 0; i < signal.length; i++) {
    const r = real[i] / N;
    const im = imag[i] / N;
    envelope[i] = Math.sqrt(r*r + im*im);
  }
  return envelope;
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
  // Q values for 4th order Butterworth (two biquads)
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

export function filtfiltButterworthHPF(signal, fc, fs) {
  const stages = getButterworthHPFCoeffs(fc, fs);
  
  let forward = applyBiquads(signal, stages);
  let reversed = new Float64Array(signal.length);
  for (let i = 0; i < signal.length; i++) reversed[i] = forward[signal.length - 1 - i];
  
  let backward = applyBiquads(reversed, stages);
  let result = new Float64Array(signal.length);
  for (let i = 0; i < signal.length; i++) result[i] = backward[signal.length - 1 - i];
  
  return result;
}