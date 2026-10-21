import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { ResponsiveContainer, ComposedChart, Line, XAxis, YAxis, Tooltip, ReferenceLine, CartesianGrid } from "recharts";
import UnbalancePrediction from "@/components/machine/UnbalancePrediction";

const fmt = (t) => new Date(t * 1000).toLocaleDateString("cs-CZ", { day: "numeric", month: "numeric" });

export default function UnbalanceTrendDialog({ open, onOpenChange, machine, sensorId, label }) {
  const [days, setDays] = useState(30);
  const { data, isLoading } = useQuery({
    queryKey: ["unbalanceTrend", machine.id, sensorId, days],
    queryFn: async () => (await base44.functions.invoke("getUnbalance", { machineId: machine.id, sensorId, days })).data,
    enabled: open && !!sensorId,
  });
  const p = data?.prediction;
  // Trend se počítá jen z posledních 5 dní → přímku kreslíme od začátku okna, u rostoucího trendu až do dosažení prahu
  const fitAt = (t) => +(p.intercept + p.slope_per_day * (t - p.t0) / 86400).toFixed(1);
  const hasFit = p?.slope_per_day != null;
  const chart = (data?.points || []).map((x) => ({ ...x, fit: hasFit && x.t >= p.t0 ? fitAt(x.t) : null }));
  if (hasFit && p.status === "rising" && p.days_left <= 30) chart.push({ t: p.eta_unix, fit: 100 });
  const points = (data?.points || []).length;
  const trendDays = machine.unbalance_trend_alarm_days ?? 3;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader><DialogTitle>Trend míry nevývahy – {label}</DialogTitle></DialogHeader>
        <div className="flex gap-2">
          {[7, 14, 30].map((d) => (
            <Button key={d} size="sm" variant={days === d ? "default" : "outline"} onClick={() => setDays(d)}>{d} dní</Button>
          ))}
        </div>
        {isLoading ? <Loader2 className="w-5 h-5 animate-spin text-slate-400" /> : (
          <>
            <UnbalancePrediction prediction={p} trendDays={trendDays} />
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="t" type="number" domain={["dataMin", "dataMax"]} tickFormatter={fmt} fontSize={11} />
                  <YAxis unit=" %" fontSize={11} domain={[0, (max) => Math.max(110, Math.ceil(max))]} />
                  <Tooltip labelFormatter={(t) => new Date(t * 1000).toLocaleString("cs-CZ")}
                    formatter={(v, n, it) => n === "percent" ? [`${v} % (${it.payload.amp} mm/s)`, "Nevývaha"] : [`${v} %`, "Trend (5 dní)"]} />
                  <ReferenceLine y={100} stroke="#ef4444" strokeDasharray="4 4" label={{ value: "Práh", fontSize: 11, fill: "#ef4444" }} />
                  <ReferenceLine y={90} stroke="#f59e0b" strokeDasharray="2 4" label={{ value: "Upozornění 90 %", fontSize: 11, fill: "#b45309", position: "insideBottomRight" }} />
                  {hasFit && <ReferenceLine x={p.t0} stroke="#94a3b8" strokeDasharray="2 4" label={{ value: "okno trendu", fontSize: 10, fill: "#64748b", position: "insideTopLeft" }} />}
                  {hasFit && p.recent_median != null && <ReferenceLine y={p.recent_median} stroke="#7c3aed" strokeOpacity={0.5} label={{ value: `vážený medián ${p.recent_median} %`, fontSize: 10, fill: "#7c3aed", position: "insideTopLeft" }} />}
                  <Line dataKey="percent" stroke="#2563eb" dot={{ r: 2 }} strokeWidth={1.5} isAnimationActive={false} />
                  <Line dataKey="fit" stroke="#f59e0b" dot={false} strokeDasharray="5 3" connectNulls isAnimationActive={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <p className="text-xs text-slate-500">Jen měření za chodu stroje, {points} bodů. Trend z posledních 5 dní, alarm při váženém mediánu ≥ 90 % nebo dosažení prahu dle trendu do {trendDays} dní. Práh {data?.threshold} mm/s = 100 %.</p>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}