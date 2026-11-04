import { useQueries } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

// Načte řady {t, v} pro všechna porovnání (libovolný snímač stroje / míra nevývahy)
export default function useTrendCompareData(compares, { rangeDays, historyFrom, machineId }) {
  return useQueries({
    queries: compares.map(compare => ({
      queryKey: ["trendCompare", compare.sensorId, compare.key, rangeDays, historyFrom, machineId],
      enabled: !!compare.key,
      staleTime: 120000,
      queryFn: async () => {
        if (compare.key === "unbalance") {
          const res = await base44.functions.invoke("getUnbalance", { machineId, sensorId: compare.sensorId, days: rangeDays ?? 30 });
          return (res.data?.points || []).map(p => ({ t: p.t, v: p.percent }));
        }
        const res = await base44.functions.invoke("getSensorTrend", {
          sensor_id: compare.sensorId, days: rangeDays, limit: 2000,
          is_temperature: compare.key === "temperature", from_date: historyFrom || null,
        });
        return (res.data?.data || []).filter(r => r[compare.key] != null).map(r => ({ t: r.ts_unix, v: r[compare.key] }));
      },
    })),
  });
}

// Přiřadí každému bodu nejbližší hodnotu porovnání (do tolerance v sekundách)
export function nearestValue(series, t, tol = 3600) {
  if (!series?.length || t == null) return null;
  let lo = 0, hi = series.length - 1;
  while (lo < hi) { const m = (lo + hi) >> 1; if (series[m].t < t) lo = m + 1; else hi = m; }
  const cands = [series[lo], series[lo - 1]].filter(Boolean);
  const best = cands.reduce((a, b) => (Math.abs(b.t - t) < Math.abs(a.t - t) ? b : a));
  return Math.abs(best.t - t) <= tol ? best.v : null;
}