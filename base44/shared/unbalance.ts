// Míra nevývahy: amplituda na otáčkové frekvenci (1×) z rychlostního FFT spektra.
// Otáčky se detekují automaticky jako nejvyšší pík v pásmu 6–80 Hz (průměr os X/Y/Z).
// Amplituda = RMS ±1 čáry kolem 1× v radiální ose (vyšší z X/Y), mm/s.

const parse = (s: string | null | undefined): number[] => {
  if (!s) return [];
  try { return JSON.parse(s) || []; } catch (_) { return []; }
};

// Spektrum obsahuje špičkové amplitudy (peak). RMS pásma = sqrt(Σa²/2 · corr), kde corr je
// energetická korekce Hannova okna a zero-paddingu: (2/3)·(L/N) = (2/3)·frequency_resolution/true_resolution_hz.
// Stejný výpočet jako celková hodnota vel_rms_* v aissensWebhook.
const bandRms = (arr: number[], from: number, to: number, corr: number) => {
  let sum = 0;
  for (let i = Math.max(1, from); i <= Math.min(to, arr.length - 1); i++) sum += (arr[i] || 0) ** 2;
  return Math.sqrt((sum / 2) * corr);
};

export function computeUnbalance(fft: any, thresholdMmS: number, runThresholdMmS = 0.3) {
  const res = fft.frequency_resolution || 3.259;
  const velX = parse(fft.vel_x_json), velY = parse(fft.vel_y_json), velZ = parse(fft.vel_z_json);
  const spectra = [velX, velY, velZ].filter((s) => s.length > 0);
  if (!spectra.length) return null;

  const corr = fft.true_resolution_hz ? (2 / 3) * (res / fft.true_resolution_hz) : 2 / 3;

  // Chod stroje — celková rychlost v radiálních osách (uložená RMS hodnota, jinak ze spektra)
  const lowBin = Math.ceil(2 / res);
  const overall = fft.oa_x != null || fft.oa_y != null
    ? Math.max(fft.oa_x || 0, fft.oa_y || 0)
    : Math.max(bandRms(velX, lowBin, velX.length - 1, corr), bandRms(velY, lowBin, velY.length - 1, corr));
  const running = overall >= runThresholdMmS;

  const minBin = Math.max(1, Math.ceil(6 / res));
  const maxBin = Math.min(Math.floor(80 / res), spectra[0].length - 2);
  let bin = -1, best = -1;
  for (let i = minBin; i <= maxBin; i++) {
    const avg = spectra.reduce((s, sp) => s + (sp[i] || 0), 0) / spectra.length;
    if (avg > best) { best = avg; bin = i; }
  }
  if (bin < 0) return null;

  const ampX = bandRms(velX, bin - 1, bin + 1, corr);
  const ampY = bandRms(velY, bin - 1, bin + 1, corr);
  const axis = ampX >= ampY ? 'X' : 'Y';
  const amp = Math.max(ampX, ampY);
  const freq = bin * res;

  return {
    timestamp_unix: fft.timestamp_unix,
    sensor_data_id: fft.sensor_data_id || null,
    freq: +freq.toFixed(2),
    rpm: Math.round(freq * 60),
    amp: +amp.toFixed(3),
    axis,
    running,
    percent: thresholdMmS > 0 ? Math.round((amp / thresholdMmS) * 100) : null,
  };
}