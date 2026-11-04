import React from "react";

// Parametry pro porovnání (korelaci) v trendu
export const COMPARE_OPTIONS = [
  { key: "temperature", name: "Teplota [°C]", color: "#a855f7" },
  { key: "vel_rms_x_mm_s", name: "Vel X [mm/s]", color: "#0ea5e9" },
  { key: "vel_rms_y_mm_s", name: "Vel Y [mm/s]", color: "#14b8a6" },
  { key: "vel_rms_z_mm_s", name: "Vel Z [mm/s]", color: "#eab308" },
  { key: "oa_acc_z", name: "Acc Z [g]", color: "#22c55e" },
  { key: "env_rms_z", name: "Obálka Z [g]", color: "#f97316" },
  { key: "unbalance", name: "Míra nevývahy [%]", color: "#e11d48", unbalance: true },
];

const cls = "px-1.5 py-0.5 rounded border border-slate-300 bg-white text-xs text-slate-600";

// value: { sensorId, key } | null
export default function TrendCompareSelect({ value, onChange, sensorId, sensors = [], excludeKeys = [], unbalanceEnabled }) {
  const cmpSensor = value?.sensorId || sensorId;
  const same = cmpSensor === sensorId;
  const opts = COMPARE_OPTIONS.filter(o => (!same || !excludeKeys.includes(o.key)) && (!o.unbalance || unbalanceEnabled));
  return (
    <div className="flex items-center gap-1">
      <span className="text-slate-400 whitespace-nowrap">Porovnat s:</span>
      {sensors.length > 1 && (
        <select className={cls} value={cmpSensor}
          onChange={(e) => onChange(value?.key ? { sensorId: e.target.value, key: value.key } : null, e.target.value)}>
          {sensors.map(s => <option key={s.id} value={s.id}>{s.label}{s.id === sensorId ? " (tento)" : ""}</option>)}
        </select>
      )}
      <select className={cls} value={value?.key || ""}
        onChange={(e) => onChange(e.target.value ? { sensorId: cmpSensor, key: e.target.value } : null, cmpSensor)}>
        <option value="">— žádný —</option>
        {opts.map(o => <option key={o.key} value={o.key}>{o.name}</option>)}
      </select>
    </div>
  );
}