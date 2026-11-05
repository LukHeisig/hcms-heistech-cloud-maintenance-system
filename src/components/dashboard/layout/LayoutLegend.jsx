import React from "react";

const ITEMS = [
  ["bg-status-success", "A/B — v pořádku"],
  ["bg-dashboard-warning", "C — upozornění"],
  ["bg-status-danger", "D — kritické"],
  ["bg-muted-foreground", "Bez dat"],
];

// Legenda barev vibračních pásem
export default function LayoutLegend() {
  return (
    <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
      {ITEMS.map(([color, label]) => (
        <span key={label} className="flex items-center gap-1.5">
          <span className={`w-3 h-3 rounded-full ${color}`} />{label}
        </span>
      ))}
    </div>
  );
}