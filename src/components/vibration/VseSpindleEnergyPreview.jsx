import React from "react";
import { COUNTER_BANDS } from "@/components/vibration/vseTemplates";

const DEMO = [
  [58, 29, 13],
  [74, 20, 6],
  [81, 15, 4],
];

function Donut({ values }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <svg viewBox="0 0 100 100" className="w-24 h-24">
      {values.map((v, i) => {
        const len = (v / 100) * c;
        const el = (
          <circle
            key={i}
            cx="50" cy="50" r={r} fill="none"
            stroke={COUNTER_BANDS[i].color} strokeWidth="14"
            strokeDasharray={`${len} ${c - len}`}
            strokeDashoffset={-offset}
            transform="rotate(-90 50 50)"
          />
        );
        offset += len;
        return el;
      })}
      <text x="50" y="47" textAnchor="middle" fontSize="18" fontWeight="700" fill={COUNTER_BANDS[0].color}>{values[0]} %</text>
      <text x="50" y="62" textAnchor="middle" fontSize="8" fill="#64748b">v limitu</text>
    </svg>
  );
}

export default function VseSpindleEnergyPreview({ definition }) {
  return (
    <div className="mt-4">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Náhled vizualizace (ilustrativní data)</p>
      <div className="rounded-lg p-4 space-y-3" style={{ backgroundColor: "#f4f1ec" }}>
        <div className="grid grid-cols-3 gap-3">
          {definition.axes.map((axis, ai) => (
            <div key={axis.key} className="bg-white rounded-md border p-3 flex flex-col items-center">
              <div className="flex items-center gap-3">
                <Donut values={DEMO[ai] || DEMO[0]} />
                <div className="space-y-1 text-xs">
                  {axis.counters.map((c, ci) => (
                    <div key={c.key} className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: COUNTER_BANDS[ci]?.color }} />
                      <span className="text-slate-700">{(DEMO[ai] || DEMO[0])[ci]} %</span>
                    </div>
                  ))}
                </div>
              </div>
              <p className="text-xs font-semibold text-slate-800 mt-1">{axis.label}</p>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-3">
          {definition.axes.map((axis, ai) => (
            <div key={axis.key} className="bg-white rounded-md border p-3">
              <p className="text-xs font-semibold text-slate-800 mb-2">{axis.label} <span className="text-slate-400 font-normal">· 30 dní</span></p>
              <div className="flex items-end gap-px h-14">
                {Array.from({ length: 30 }).map((_, d) => {
                  const base = DEMO[ai] || DEMO[0];
                  const jitter = ((d * 7 + ai * 3) % 9) - 4;
                  const ok = Math.max(40, Math.min(95, base[0] + jitter));
                  const warn = Math.min(100 - ok, base[1]);
                  const dmg = 100 - ok - warn;
                  return (
                    <div key={d} className="flex-1 flex flex-col-reverse">
                      <div style={{ height: `${ok}%`, backgroundColor: COUNTER_BANDS[0].color }} />
                      <div style={{ height: `${warn}%`, backgroundColor: COUNTER_BANDS[1].color }} />
                      <div style={{ height: `${dmg}%`, backgroundColor: COUNTER_BANDS[2].color }} />
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}