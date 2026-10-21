// Vážený medián: hodnoty seřazené od nejstarší po nejnovější, váha 1..n (nejnovější = n).
export function weightedMedian(values: number[]) {
  if (!values.length) return 0;
  const items = values.map((v, i) => ({ v, w: i + 1 })).sort((a, b) => a.v - b.v);
  const half = items.reduce((s, x) => s + x.w, 0) / 2;
  let acc = 0;
  for (const x of items) { acc += x.w; if (acc >= half) return x.v; }
  return items[items.length - 1].v;
}

// Lineární regrese míry nevývahy (%) v čase → odhad data dosažení 100 %.
// Vyžaduje alespoň 7 dní dat za chodu stroje.
export function predictUnbalance(points: { t: number; percent: number }[]) {
  if (points.length < 3) return { status: 'insufficient' };
  const span = (points[points.length - 1].t - points[0].t) / 86400;
  if (span < 4) return { status: 'insufficient', span_days: +span.toFixed(1) };

  const t0 = points[0].t;
  const xs = points.map((p) => (p.t - t0) / 86400);
  const ys = points.map((p) => p.percent);
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) { num += (xs[i] - mx) * (ys[i] - my); den += (xs[i] - mx) ** 2; }
  const slope = den ? num / den : 0; // % za den
  const intercept = my - slope * mx;
  const nowX = (Date.now() / 1000 - t0) / 86400;
  const fit = intercept + slope * nowX;
  // Aktuální úroveň = vážený medián posledních 6 měření (novější mají větší váhu).
  // Pokud je vyšší než hodnota přímky, má přednost — přímka přes celé období reaguje pomalu.
  const recentMedian = weightedMedian(ys.slice(-6));
  const current = Math.max(fit, recentMedian);

  const base = { slope_per_day: +slope.toFixed(3), current_fit: Math.round(fit), recent_median: Math.round(recentMedian), points: n, t0, intercept: +intercept.toFixed(3) };
  if (current >= 100) return { ...base, status: 'exceeded' };
  if (slope <= 0.01) return { ...base, status: 'stable' };
  const days = (100 - current) / slope;
  return { ...base, status: 'rising', days_left: Math.round(days), eta_unix: Math.round(Date.now() / 1000 + days * 86400) };
}