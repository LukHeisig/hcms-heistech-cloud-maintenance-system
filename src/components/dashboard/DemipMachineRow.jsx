import React from "react";
import { ChevronRight } from "lucide-react";
import { formatMachineName } from "@/lib/utils";

export default function DemipMachineRow({ machine, lineName, points, getPointStatus, onSelect }) {
  const machinePoints = points.filter(point => point.machine_id === machine.id);
  const overdue = machinePoints.filter(point => ["overdue", "critical"].includes(getPointStatus(point))).length;
  const warning = machinePoints.filter(point => getPointStatus(point) === "warning").length;
  const dotClass = overdue ? "bg-status-danger" : warning ? "bg-status-warning" : "bg-status-success";
  const label = overdue ? `${overdue} bodů po termínu` : warning ? `${warning} bodů ve varování` : "V termínu";
  return (
    <button type="button" onClick={() => onSelect(machine.id)}
      className="flex min-h-16 w-full items-center gap-3 rounded-lg border border-border bg-card px-3 py-3 text-left text-card-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${dotClass}`} role="img" aria-label={label} title={label} />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold leading-snug">{formatMachineName(machine)}</span>
        <span className="mt-1 block text-xs text-muted-foreground">{lineName || "Linka"}</span>
      </span>
      {(overdue > 0 || warning > 0) && (
        <span className={`text-xs font-semibold ${overdue ? "text-status-danger" : "text-status-warning"}`} title={label}>
          {overdue > 0 ? `${overdue} !` : warning}
        </span>
      )}
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
    </button>
  );
}