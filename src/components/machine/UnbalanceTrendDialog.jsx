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
  const chart = (data?.points || []).map((x) => ({ ...x, fit: p?.slope_per_day != null ? +(p.intercept + p.slope_per_day * (x.t - p.t0) / 86400).toFixed(1) : null }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader><DialogTitle>Trend míry nevývahy – {label}</DialogTitle></DialogHeader>
        <div className="flex gap-2">
          {[7, 30, 90].map((d) => (
            <Button key={d} size="sm" variant={days === d ? "default" : "outline"} onClick={() => setDays(d)}>{d} dní</Button>
          ))}
        </div>
        {isLoading ? <Loader2 className="w-5 h-5 animate-spin text-slate-400" /> : (
          <>
            <UnbalancePrediction prediction={p} />
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="t" type="number" domain={["dataMin", "dataMax"]} tickFormatter={fmt} fontSize={11} />
                  <YAxis unit=" %" fontSize={11} domain={[0, (max) => Math.max(110, Math.ceil(max))]} />
                  <Tooltip labelFormatter={(t) => new Date(t * 1000).toLocaleString("cs-CZ")}
                    formatter={(v, n, it) => n === "percent" ? [`${v} % (${it.payload.amp} mm/s)`, "Nevývaha"] : [`${v} %`, "Trend"]} />
                  <ReferenceLine y={100} stroke="#ef4444" strokeDasharray="4 4" label={{ value: "Práh", fontSize: 11, fill: "#ef4444" }} />
                  <Line dataKey="percent" stroke="#2563eb" dot={{ r: 2 }} strokeWidth={1.5} isAnimationActive={false} />
                  <Line dataKey="fit" stroke="#f59e0b" dot={false} strokeDasharray="5 3" isAnimationActive={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <p className="text-xs text-slate-500">Jen měření za chodu stroje, {chart.length} bodů. Práh {data?.threshold} mm/s = 100 %.</p>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}