import React from "react";
import { AlertTriangle, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { cs } from "date-fns/locale";

export default function DemipPointRow({ point, lastRecord, nextDate, status, hasIssues, issueCount, onSelect }) {
  const critical = status === "critical" || status === "overdue";
  const warning = status === "warning";
  const dotClass = critical ? "bg-status-danger" : warning ? "bg-dashboard-warning" : "bg-status-success";
  const textClass = critical ? "text-status-danger" : warning ? "text-status-warning" : "text-status-success";
  const label = critical ? "Po termínu" : warning ? "Varování" : "V termínu";
  return (
    <button type="button" onClick={() => onSelect(point.id)}
      className="flex min-h-16 w-full min-w-0 items-center gap-3 rounded-lg border border-border bg-card px-3 py-3 text-left text-card-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:min-h-0 md:rounded-none md:border-0 md:border-b md:px-0 md:hover:bg-transparent md:hover:text-dashboard-accent">
      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${dotClass}`} role="img" aria-label={label} title={label} />
      <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="min-w-0 text-sm font-semibold leading-snug md:font-medium">{point.number && `${point.number} - `}{point.name}</span>
          {hasIssues && <span className="inline-flex items-center gap-1 text-xs font-medium text-status-warning"><AlertTriangle className="h-3 w-3 shrink-0" />{issueCount ? `Závady: ${issueCount}` : "Závada"}</span>}
        </span>
        <span className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs leading-relaxed text-muted-foreground">
          {!!point.interval_hours && <span>Interval: {point.interval_hours}h</span>}
          {lastRecord && <span>Poslední: {format(new Date(lastRecord.performed_at), "d.M. HH:mm", { locale: cs })}</span>}
        </span>
        {nextDate && <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
          Následující kontrola: <span className={`font-semibold ${textClass}`}>{format(nextDate, "d.M. yyyy", { locale: cs })}</span>
        </span>}
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground md:hidden" aria-hidden="true" />
    </button>
  );
}