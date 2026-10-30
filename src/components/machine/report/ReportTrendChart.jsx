import React from "react";
import { LineChart, Line, XAxis, YAxis, ReferenceLine, CartesianGrid } from "recharts";

// Denní maxima rychlosti vibrací s hranicemi pásem (pevná velikost kvůli tisku)
export default function ReportTrendChart({ point }) {
  const { ab, bc, cd } = point.limits || {};
  return (
    <div>
      <p className="text-xs font-semibold mb-1">Trend rychlosti vibrací – {point.label} [mm/s]</p>
      <LineChart width={330} height={150} data={point.chart} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
        <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" />
        <XAxis dataKey="d" tick={{ fontSize: 9 }} />
        <YAxis tick={{ fontSize: 9 }} />
        {ab != null && <ReferenceLine y={ab} stroke="#16a34a" strokeDasharray="4 3" />}
        {bc != null && <ReferenceLine y={bc} stroke="#eab308" strokeDasharray="4 3" />}
        {cd != null && <ReferenceLine y={cd} stroke="#dc2626" strokeDasharray="4 3" />}
        <Line type="monotone" dataKey="v" stroke="#1e293b" dot={false} strokeWidth={1.5} isAnimationActive={false} />
      </LineChart>
    </div>
  );
}