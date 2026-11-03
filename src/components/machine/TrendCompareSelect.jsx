import React from "react";

// Další parametr ze stejného snímače pro porovnání (korelaci) v trendu
export const COMPARE_OPTIONS = [
  { key: "temperature", name: "Teplota [°C]", color: "#a855f7" },
  { key: "vel_rms_x_mm_s", name: "Vel X [mm/s]", color: "#0ea5e9" },
  { key: "vel_rms_y_mm_s", name: "Vel Y [mm/s]", color: "#14b8a6" },
  { key: "vel_rms_z_mm_s", name: "Vel Z [mm/s]", color: "#eab308" },
  { key: "oa_acc_z", name: "Acc Z [g]", color: "#22c55e" },
  { key: "env_rms_z", name: "Obálka Z [g]", color: "#f97316" },
];

export default function TrendCompareSelect({ value, onChange, excludeKeys = [] }) {
  return (
    <label className="flex items-center gap-1">
      <span className="text-slate-400 whitespace-nowrap">Porovnat s:</span>
      <select
        value={value || ""}
        onChange={(e) => onChange(e.target.value || null)}
        className="px-1.5 py-0.5 rounded border border-slate-300 bg-white text-xs text-slate-600"
      >
        <option value="">— žádný —</option>
        {COMPARE_OPTIONS.filter(o => !excludeKeys.includes(o.key)).map(o => (
          <option key={o.key} value={o.key}>{o.name}</option>
        ))}
      </select>
    </label>
  );
}