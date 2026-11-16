// Pásmo hledání otáčkové frekvence (1×) ve spektru. Výchozí 6–80 Hz,
// stroj může mít nastaven užší rozsah otáček (ot/min), aby se nebraly vyšší harmonické.
export function rpmBandBins(res: number, len: number, rpmMin?: number | null, rpmMax?: number | null) {
  let minHz = rpmMin && rpmMin > 0 ? rpmMin / 60 : 6;
  let maxHz = rpmMax && rpmMax > 0 ? rpmMax / 60 : 80;
  if (maxHz <= minHz) maxHz = minHz * 2;
  let minBin = Math.max(1, Math.ceil(minHz / res));
  let maxBin = Math.min(Math.floor(maxHz / res), len - 1);
  if (maxBin < minBin) {
    // úzké pásmo mezi dvěma čarami — vezmi nejbližší čáru ke středu
    const mid = Math.min(len - 1, Math.max(1, Math.round((minHz + maxHz) / 2 / res)));
    minBin = mid; maxBin = mid;
  }
  return { minBin, maxBin };
}