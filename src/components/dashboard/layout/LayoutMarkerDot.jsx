import React, { useState, useRef } from "react";
import { X } from "lucide-react";

const RANK = { A: 1, B: 2, C: 3, D: 4 };
const COLORS = {
  A: "bg-status-success", B: "bg-status-success", C: "bg-dashboard-warning", D: "bg-status-danger animate-pulse",
};

export function markerZone(stats) {
  if (!stats) return null;
  const zones = [stats.zone, stats.severity].filter(Boolean);
  return zones.sort((a, b) => RANK[b] - RANK[a])[0] || null;
}

// Kolečko stroje na layoutu (na dotyku: 1. klepnutí = tooltip, 2. klepnutí = detail stroje)
export default function LayoutMarkerDot({ marker, machine, stats, editing, onOpen, onDelete, onDragStart }) {
  const zone = markerZone(stats);
  const [open, setOpen] = useState(false);
  const pointerType = useRef("mouse");
  const handleClick = () => {
    if (editing) return;
    if (pointerType.current !== "mouse" && !open) return setOpen(true);
    onOpen(machine);
  };
  return (
    <div className={`absolute -translate-x-1/2 -translate-y-1/2 group ${open ? "z-20" : ""}`} style={{ left: `${marker.x}%`, top: `${marker.y}%` }}
      onClick={(e) => e.stopPropagation()}>
      <button type="button" onPointerDown={(e) => { pointerType.current = e.pointerType; if (editing) { e.preventDefault(); onDragStart(); } }}
        style={editing ? { cursor: "grab" } : undefined} onClick={handleClick} onBlur={() => setOpen(false)}
        className={`w-7 h-7 rounded-full border-2 border-card shadow-lg ${zone ? COLORS[zone] : "bg-muted-foreground"}`} />
      <span className="absolute left-1/2 -translate-x-1/2 top-8 whitespace-nowrap rounded bg-card/90 px-1.5 py-0.5 text-[10px] font-semibold shadow">
        {machine?.name || "?"}{zone ? ` · ${zone}` : ""}
      </span>
      {!editing && (
        <div className={`pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-9 z-10 ${open ? "block" : "hidden"} group-hover:block whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-xs text-background shadow-lg`}>
          <div className="font-semibold">{machine?.name || "Neznámý stroj"}</div>
          <div>Vibrace: {stats?.vel != null ? `${stats.vel.toFixed(2)} mm/s` : "bez dat"}</div>
          <div>Pásmo: {zone || "—"}{stats?.alerts ? ` · alarmy: ${stats.alerts}` : ""}</div>
          {open && <div className="opacity-70">Klepněte znovu pro detail</div>}
        </div>
      )}
      {editing && (
        <button type="button" onClick={() => onDelete(marker)} aria-label="Odebrat stroj"
          className="absolute -top-2 -right-2 w-4 h-4 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center">
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}