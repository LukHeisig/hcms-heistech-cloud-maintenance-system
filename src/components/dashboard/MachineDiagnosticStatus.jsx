import React from "react";
import { Activity } from "lucide-react";

const TONES = {
  A: "bg-status-success/5 border-status-success/40 text-status-success",
  B: "bg-status-success/5 border-status-success/40 text-status-success",
  C: "bg-status-warning/5 border-status-warning/40 text-status-warning",
  D: "bg-status-danger/5 border-status-danger/40 text-status-danger",
};
const VIBRATION_DETAILS = {
  A: "Rychlost vibrací je v pásmu A. Stroj pracuje bez omezení.",
  B: "Rychlost vibrací je v pásmu B. Zvýšená kontrola doporučena.",
  C: "Výrazné vibrace (pásmo C). Plánujte údržbu co nejdříve.",
  D: "Nebezpečné vibrace (pásmo D). Zvažte okamžité odstavení.",
};
const BEARING_DETAILS = {
  A: "Zrychlení a obálka jsou v pásmu A. Žádné poškození ložisek.",
  B: "Zrychlení/obálka je v pásmu B. Sledujte trend ložisek.",
  C: "Zvýšené rázové vibrace (pásmo C). Blíží se porucha ložiska.",
  D: "Kritické rázové vibrace (pásmo D). Ložisko pravděpodobně poškozeno.",
};

export default function MachineDiagnosticStatus({ status, loading }) {
  const rows = [["Vibrace", status?.velocityZone, VIBRATION_DETAILS], ["Ložiska", status?.bearingZone, BEARING_DETAILS]];
  return (
    <div className="mt-1 rounded-md border border-border bg-card text-card-foreground">
      <div className="flex items-center gap-1.5 border-b border-border px-2 py-1 text-[11px] font-semibold">
        <Activity className="h-3 w-3 text-primary" />Stav měřených ložisek
      </div>
      <div className="grid grid-cols-1 gap-1 p-1 sm:grid-cols-2">
        {rows.map(([name, zone, details]) => (
          <div key={name} className={`rounded border px-2 py-1 ${TONES[zone] || "bg-muted border-border text-muted-foreground"}`}>
            <div className="flex items-center gap-1.5 text-[11px] font-medium">
              <span className="h-2 w-2 shrink-0 rounded-full bg-current" />
              {loading ? `${name} — načítání…` : zone ? `${name} — ${zone} ${zone === "D" ? "Výstraha" : zone === "C" ? "Upozornění" : "OK"}` : `Stav ${name === "Vibrace" ? "vibrací" : "ložisek"} neznámý`}
            </div>
            <p className="pl-3.5 text-[10px] leading-tight opacity-75">{loading ? "Načítám poslední měření." : details[zone] || `Není přiřazena norma pro ${name === "Vibrace" ? "rychlost" : "zrychlení"} nebo zatím nejsou data.`}</p>
          </div>
        ))}
      </div>
    </div>
  );
}