import React from "react";

const BAND_CLS = { A: "bg-green-600", B: "bg-green-600", C: "bg-yellow-500", D: "bg-red-600" };
const TREND = { up: "↑ roste", down: "↓ klesá", stable: "→ ustálený" };
const n = (v) => (v == null ? "—" : v.toFixed(2).replace(".", ","));

export const BandCell = ({ b }) => b ? <span className={`inline-block w-8 text-center text-white font-bold rounded ${BAND_CLS[b]}`}>{b}</span> : "—";

export default function ReportPointsTable({ points }) {
  return (
    <table className="w-full text-xs border-collapse">
      <thead>
        <tr className="border-b-2 border-slate-400 text-slate-500 text-left">
          <th className="py-1">Místo</th><th>Rychlost max</th><th>Průměr</th><th>Pásmo</th>
          <th>Zrychlení max [g]</th><th>Obálka max [g]</th><th>Stav ložiska</th><th>Trend</th>
        </tr>
      </thead>
      <tbody>
        {points.map((p) => (
          <tr key={p.sensorId} className="border-b border-slate-200">
            <td className="py-1 font-semibold">{p.label}</td>
            <td>{n(p.velMax)} {p.axis && `(${p.axis})`}</td>
            <td>{n(p.velAvg)}</td>
            <td><BandCell b={p.velBand} /></td>
            <td>{n(p.accMax)}</td><td>{n(p.envMax)}</td>
            <td><BandCell b={p.bearingBand} /></td>
            <td>{TREND[p.trend]}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}