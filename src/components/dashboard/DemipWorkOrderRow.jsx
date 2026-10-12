import React from "react";
import { ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { cs } from "date-fns/locale";

export default function DemipWorkOrderRow({ order, machineName, isOverdue, onSelect, badges, assignedName, showDetails = false, dateFormat = "d.M.", className = "" }) {
  const dotClass = isOverdue ? "bg-status-danger" : order.status === "in_progress" ? "bg-status-warning" : "bg-status-success";
  return (
    <button type="button" onClick={onSelect}
      className={`flex min-h-16 w-full min-w-0 items-center gap-3 rounded-lg border border-border bg-card px-3 py-3 text-left text-card-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${className}`}>
      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${dotClass}`} aria-hidden="true" />
      <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="min-w-0 text-sm font-semibold leading-snug">{order.title}</span>
          {badges}
          {isOverdue && <span className="text-xs font-medium text-status-danger">Po termínu</span>}
        </span>
        <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
          {showDetails && <span>{order.companyName} › {order.lineName} › </span>}{machineName}
        </span>
        {showDetails && order.description && <span className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{order.description}</span>}
        <span className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs leading-relaxed text-muted-foreground">
          <span className={isOverdue ? "font-semibold text-status-danger" : ""}>Termín: {format(new Date(order.planned_date), dateFormat, { locale: cs })}</span>
          {showDetails && assignedName && <span>{assignedName}</span>}
          {showDetails && !!order.estimated_duration_hours && <span>{order.estimated_duration_hours}h</span>}
        </span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
    </button>
  );
}