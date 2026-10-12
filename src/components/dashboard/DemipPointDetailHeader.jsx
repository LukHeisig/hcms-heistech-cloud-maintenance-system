import React from "react";
import { ArrowLeft, ChevronRight, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatMachineName } from "@/lib/utils";

export default function DemipPointDetailHeader({ point, machine, line, status, canEdit, onBack, onEdit }) {
  const critical = status === "overdue" || status === "critical";
  const warning = status === "warning";
  const dotClass = critical ? "bg-status-danger" : warning ? "bg-status-warning" : "bg-status-success";
  const label = critical ? "Po termínu" : warning ? "Varování" : "V termínu";
  return (
    <header className="mx-auto w-full min-w-0 max-w-xl px-3 pt-3 [overflow-wrap:anywhere]">
      <Button variant="ghost" size="sm" onClick={onBack} className="mb-3 h-9 px-2 text-sm">
        <ArrowLeft className="h-4 w-4" />Zpět na kontrolní body
      </Button>
      <div className="flex min-w-0 items-start gap-3">
        <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${dotClass}`} role="img" aria-label={label} title={label} />
        <div className="min-w-0 flex-1">
          <h1 className="text-sm font-semibold leading-snug text-foreground">{point.number && `${point.number} - `}{point.name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-x-1 gap-y-1 text-xs text-muted-foreground">
            <span className="min-w-0">{line?.name || "Neznámá linka"}</span>
            <ChevronRight className="h-3 w-3 shrink-0" aria-hidden="true" />
            <span className="min-w-0">{machine ? formatMachineName(machine) : "Neznámý stroj"}</span>
          </div>
        </div>
        {canEdit && <Button variant="ghost" size="icon" onClick={onEdit} aria-label="Upravit kontrolní bod" className="h-8 w-8 shrink-0"><Pencil className="h-4 w-4" /></Button>}
      </div>
    </header>
  );
}