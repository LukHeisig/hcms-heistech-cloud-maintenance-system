import React from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

export default function MotohoursDailyChart({ days }) {
  if (!days.length) return <p className="text-sm text-slate-500">Zatím žádná denní historie.</p>;
  const data = days.map((d) => ({ date: d.date.slice(8, 10) + "." + d.date.slice(5, 7) + ".", hours: Math.round((d.hours || 0) * 10) / 10 }));
  return (
    <div className="h-40">
      <p className="text-xs text-slate-500 mb-1">Denní motohodiny (30 dní)</p>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <XAxis dataKey="date" fontSize={11} />
          <YAxis fontSize={11} width={30} domain={[0, 24]} />
          <Tooltip formatter={(v) => [`${v} h`, "Chod"]} />
          <Bar dataKey="hours" fill="hsl(var(--demip-brand))" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}