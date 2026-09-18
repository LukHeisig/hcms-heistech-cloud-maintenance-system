import React, { useMemo, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { format } from "date-fns";
import VseTrendMetricSelect from "@/components/vse/VseTrendMetricSelect";

function parse(json) {
  try { return JSON.parse(json || "[]"); } catch { return []; }
}

export default function VseTrendChart({ readings = [], isLoading }) {
  const [metric, setMetric] = useState(null);

  const { metrics, series } = useMemo(() => {
    const byMetric = {};
    readings.forEach((r) => {
      parse(r.values_json).forEach((v) => {
        if (typeof v.value !== "number" || !v.name) return;
        const t = new Date(v.timestamp || r.recorded_at).getTime();
        if (isNaN(t)) return;
        if (!byMetric[v.name]) byMetric[v.name] = { unit: v.unit || "", points: [] };
        byMetric[v.name].points.push({ t, value: v.value });
      });
    });
    Object.values(byMetric).forEach((m) => m.points.sort((a, b) => a.t - b.t));
    return { metrics: Object.keys(byMetric).sort(), series: byMetric };
  }, [readings]);

  const active = metric && series[metric] ? metric : metrics[0];
  const data = active ? series[active].points : [];
  const unit = active ? series[active].unit : "";

  if (isLoading) return <p className="text-sm text-slate-500 py-8 text-center">Načítám trend…</p>;
  if (metrics.length === 0) return <p className="text-sm text-slate-500 py-8 text-center">Žádná data pro trend</p>;

  return (
    <div className="space-y-3">
      <VseTrendMetricSelect metrics={metrics} value={active} onChange={setMetric} />
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis
            dataKey="t"
            type="number"
            domain={["dataMin", "dataMax"]}
            tickFormatter={(t) => format(new Date(t), "HH:mm:ss")}
            tick={{ fontSize: 11 }}
          />
          <YAxis
            tick={{ fontSize: 11 }}
            label={{ value: unit, angle: -90, position: "insideLeft", style: { fontSize: 11 } }}
          />
          <Tooltip
            labelFormatter={(t) => format(new Date(t), "d. M. yyyy HH:mm:ss.SSS")}
            formatter={(v) => [`${v} ${unit}`, active]}
          />
          <Line type="monotone" dataKey="value" stroke="#0d9488" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
      <p className="text-xs text-slate-500">{data.length} bodů z posledních přijatých zpráv</p>
    </div>
  );
}