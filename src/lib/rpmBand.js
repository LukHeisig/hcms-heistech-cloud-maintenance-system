// Pásmo hledání otáčkové frekvence (1×) ve spektru. Výchozí 6–80 Hz,
// stroj může mít nastaven užší rozsah otáček (ot/min), aby se nebraly vyšší harmonické.
export function rpmBandBins(res, len, rpmMin, rpmMax) {
  const minHz = rpmMin > 0 ? rpmMin / 60 : 6;
  let maxHz = rpmMax > 0 ? rpmMax / 60 : 80;
  if (maxHz <= minHz) maxHz = minHz * 2;
  let minBin = Math.max(1, Math.ceil(minHz / res));
  let maxBin = Math.min(Math.floor(maxHz / res), len - 1);
  if (maxBin < minBin) {
    const mid = Math.min(len - 1, Math.max(1, Math.round((minHz + maxHz) / 2 / res)));
    minBin = mid; maxBin = mid;
  }
  return { minBin, maxBin };
}

// Otáčky (ot/min) z rychlostního spektra [{x,y,z}] — nejvyšší průměr os v pásmu
export function detectRpmFromSpectrum(specVel, freqRes, rpmRange) {
  if (!specVel || specVel.length === 0 || !freqRes) return null;
  const { minBin, maxBin } = rpmBandBins(freqRes, specVel.length, rpmRange?.min, rpmRange?.max);
  let maxAmp = 0, maxIdx = -1;
  for (let i = minBin; i <= maxBin; i++) {
    const p = specVel[i] || {};
    const amp = ((p.x || 0) + (p.y || 0) + (p.z || 0)) / 3;
    if (amp > maxAmp) { maxAmp = amp; maxIdx = i; }
  }
  if (maxIdx < 0) return null;
  return Math.round(maxIdx * freqRes * 60);
}