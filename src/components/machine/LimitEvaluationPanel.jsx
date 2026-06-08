import React from "react";
import { CheckCircle } from "lucide-react";

const STATUS_CONFIG = {
  "A — OK":           { color: "bg-green-100 text-green-800 border-green-300",   dot: "bg-green-500" },
  "B — OK":           { color: "bg-green-100 text-green-900 border-green-400",   dot: "bg-green-700" },
  "C — Upozornění":   { color: "bg-yellow-100 text-yellow-800 border-yellow-300", dot: "bg-yellow-500" },
  "D — Výstraha":     { color: "bg-red-100 text-red-800 border-red-300",          dot: "bg-red-600 animate-pulse" },
};

const LEVEL_LABELS = ["A — OK", "B — OK", "C — Upozornění", "D — Výstraha"];
const LEVEL_COLORS = [
  "bg-green-100 text-green-800 border border-green-300",
  "bg-green-100 text-green-900 border border-green-400",
  "bg-yellow-100 text-yellow-800 border border-yellow-300",
  "bg-red-100 text-red-800 border border-red-300",
];
const LEVEL_BAR_COLORS = ["bg-green-500", "bg-green-700", "bg-yellow-500", "bg-red-600"];

const getLimitLevel = (value, a, b, c) => {
  if (value == null || a == null) return null;
  if (value < a) return 0;
  if (value < b) return 1;
  if (value < c) return 2;
  return 3;
};

export function LimitEvaluationPanel({ rmsData, velStandard, accStandard, tempStandard, temperature }) {
  const renderBar = (value, limits, max) => {
    if (value == null || !limits) return null;
    const pct = Math.min(100, (value / max) * 100);
    const level = getLimitLevel(value, limits[0], limits[1], limits[2]);
    const barColor = level != null ? LEVEL_BAR_COLORS[level] : "bg-slate-400";
    return (
      <div className="w-full bg-slate-200 rounded-full h-1.5 mt-1 relative">
        {limits.map((lim, i) => {
          const p = Math.min(100, (lim / max) * 100);
          const colors = ["border-yellow-500", "border-orange-500", "border-red-600"];
          return (
            <div key={i} className={`absolute top-0 bottom-0 w-0.5 border-l-2 ${colors[i]} opacity-80`}
              style={{ left: `${p}%` }} title={`Limit ${["A/B", "B/C", "C/D"][i]}: ${lim}`} />
          );
        })}
        <div className={`h-1.5 rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
    );
  };

  const metrics = [
    {
      label: "Vel X", value: rmsData?.vel_x, unit: "mm/s",
      limits: velStandard ? [velStandard.limit_ab, velStandard.limit_bc, velStandard.limit_cd] : null,
      max: velStandard ? (velStandard.limit_cd * 1.5) : 10,
    },
    {
      label: "Vel Y", value: rmsData?.vel_y, unit: "mm/s",
      limits: velStandard ? [velStandard.limit_ab, velStandard.limit_bc, velStandard.limit_cd] : null,
      max: velStandard ? (velStandard.limit_cd * 1.5) : 10,
    },
    {
      label: "Vel Z", value: rmsData?.vel_z, unit: "mm/s",
      limits: velStandard ? [velStandard.limit_ab, velStandard.limit_bc, velStandard.limit_cd] : null,
      max: velStandard ? (velStandard.limit_cd * 1.5) : 10,
    },
    {
      label: "Acc Z", value: rmsData?.acc_z, unit: "g",
      limits: accStandard ? [accStandard.acc_limit_ab, accStandard.acc_limit_bc, accStandard.acc_limit_cd] : null,
      max: accStandard ? (accStandard.acc_limit_cd * 1.5) : 5,
    },
    {
      label: "Obálka Z", value: rmsData?.env_z, unit: "g",
      limits: accStandard ? [accStandard.acc_limit_ab, accStandard.acc_limit_bc, accStandard.acc_limit_cd] : null,
      max: accStandard ? (accStandard.acc_limit_cd * 1.5) : 5,
    },
    {
      label: "Teplota", value: temperature, unit: "°C",
      limits: tempStandard ? [tempStandard.temp_limit_ab, tempStandard.temp_limit_bc, tempStandard.temp_limit_cd] : null,
      max: tempStandard ? (tempStandard.temp_limit_cd * 1.2) : 100,
    },
  ];

  const worstLevel = metrics.reduce((worst, m) => {
    const level = getLimitLevel(m.value, m.limits?.[0], m.limits?.[1], m.limits?.[2]);
    if (level == null) return worst;
    return Math.max(worst, level);
  }, -1);

  const overallStatus = worstLevel < 0 ? null
    : worstLevel === 0 ? "A — OK" : worstLevel === 1 ? "B — OK" : worstLevel === 2 ? "C — Upozornění" : "D — Výstraha";
  const cfg = overallStatus ? STATUS_CONFIG[overallStatus] : null;

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
          <CheckCircle className="w-3.5 h-3.5" /> Vyhodnocení dle norem
        </p>
        {cfg && (
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.color}`}>
            <div className={`w-2 h-2 rounded-full ${cfg.dot}`} />
            {overallStatus}
          </div>
        )}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {metrics.map((m) => {
          const level = getLimitLevel(m.value, m.limits?.[0], m.limits?.[1], m.limits?.[2]);
          const hasNorm = m.limits != null;
          const hasValue = m.value != null;
          const levelLabel = level != null ? LEVEL_LABELS[level] : null;
          const levelColor = level != null ? LEVEL_COLORS[level] : "bg-slate-50 text-slate-400 border border-slate-200";

          return (
            <div key={m.label} className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold text-slate-500 uppercase">{m.label}</span>
                <span className="text-[9px] text-slate-400">[{m.unit}]</span>
              </div>
              <div className={`text-sm font-mono font-bold text-center py-1 px-2 rounded ${hasValue ? (levelColor || "bg-slate-50 text-slate-700") : "text-slate-300"}`}>
                {hasValue ? m.value.toFixed(2) : "—"}
              </div>
              {hasValue && hasNorm && renderBar(m.value, m.limits, m.max)}
              {hasValue && levelLabel && (
                <div className={`text-[9px] text-center font-semibold px-1 py-0.5 rounded ${LEVEL_COLORS[level]}`}>
                  {levelLabel}
                </div>
              )}
              {!hasNorm && (
                <div className="text-[9px] text-slate-400 text-center italic">bez normy</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default LimitEvaluationPanel;