import React from "react";
import { X } from "lucide-react";

// Parametry pro porovnání (korelaci) v trendu
export const COMPARE_OPTIONS = [
  { key: "temperature", name: "Teplota [°C]" },
  { key: "vel_rms_x_mm_s", name: "Vel X [mm/s]" },
  { key: "vel_rms_y_mm_s", name: "Vel Y [mm/s]" },
  { key: "vel_rms_z_mm_s", name: "Vel Z [mm/s]" },
  { key: "oa_acc_z", name: "Acc Z [g]" },
  { key: "env_rms_z", name: "Obálka Z [g]" },
  { key: "battery_level", name: "Baterie [0-4]" },
  { key: "unbalance", name: "Míra nevývahy [%]", unbalance: true },
];

export const COMPARE_COLORS = ["#a855f7", "#e11d48", "#0ea5e9", "#14b8a6", "#f97316", "#64748b"];

const cls = "px-1.5 py-0.5 rounded border border-slate-300 bg-white text-xs text-slate-600";

// value: { sensorId, key }
export default function TrendCompareSelect({ value, onChange, onRemove, color, sensorId, sensors = [], excludeKeys = [], unbalanceEnabled }) {
  const same = value.sensorId === sensorId;
  const opts = COMPARE_OPTIONS.filter(o => (!same || !excludeKeys.includes(o.key)) && (!o.unbalance || unbalanceEnabled));
  return (
    <div className="flex items-center gap-1 rounded border px-1 py-0.5" style={{ borderColor: color }}>
      <span className="w-2 h-2 rounded-full" style={{ background: color }} />
      {sensors.length > 1 && (
        <select className={cls} value={value.sensorId} onChange={(e) => onChange({ ...value, sensorId: e.target.value })}>
          {sensors.map(s => <option key={s.id} value={s.id}>{s.label}{s.id === sensorId ? " (tento)" : ""}</option>)}
        </select>
      )}
      <select className={cls} value={value.key || ""} onChange={(e) => onChange({ ...value, key: e.target.value || null })}>
        <option value="">— parametr —</option>
        {opts.map(o => <option key={o.key} value={o.key}>{o.name}</option>)}
      </select>
      <button onClick={onRemove} className="p-0.5 text-slate-400 hover:text-red-600" title="Odebrat"><X className="w-3 h-3" /></button>
    </div>
  );
}