import React from "react";

const TONES = {
  A: "bg-status-success/5 border-status-success/40 text-status-success",
  B: "bg-status-success/5 border-status-success/40 text-status-success",
  C: "bg-status-warning/5 border-status-warning/40 text-status-warning",
  D: "bg-status-danger/5 border-status-danger/40 text-status-danger",
};
const VIBRATION_DETAILS = {
  A: "Bez omezení",
  B: "Sledovat trend",
  C: "Plánovat údržbu",
  D: "Zvážit odstavení",
};
const BEARING_DETAILS = {
  A: "Bez známek poškození",
  B: "Sledovat trend",
  C: "Riziko poruchy",
  D: "Možné poškození",
};

export default function MachineDiagnosticStatus({ status, loading }) {
  const rows = [["Vibrace", status?.velocityZone, VIBRATION_DETAILS], ["Ložiska", status?.bearingZone, BEARING_DETAILS]];
  return (
    <div className="flex flex-wrap items-center gap-1">
      {rows.map(([name, zone, details]) => (
        <span key={name} className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] leading-tight ${TONES[zone] || "bg-muted border-border text-muted-foreground"}`}>
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" />
          <span className="font-medium">{name} {loading ? "— načítání…" : zone ? `${zone} ${zone === "D" ? "Výstraha" : zone === "C" ? "Upozornění" : "OK"}` : "— neznámý"}</span>
          {!loading && zone && <span className="opacity-75">· {details[zone]}</span>}
        </span>
      ))}
    </div>
  );
}