import React from "react";
import { format } from "date-fns";
import { cs } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";

export default function PlannedMaintenanceCard({ task, isOverdue, isAssigned, assignedName, children }) {
  const typeLabels = { preventive: "Preventivní", corrective: "Korektivní", predictive: "Prediktivní", inspection: "Inspekce" };
  const dotClass = isOverdue ? "bg-status-danger" : isAssigned ? "bg-demip-brand" : "bg-status-success";
  const fields = [
    { label: "Plánované datum", value: format(new Date(task.planned_date), "d. M. yyyy", { locale: cs }) },
    ...(task.assigned_to ? [{ label: "Přiřazeno", value: assignedName }] : []),
    ...(task.estimated_duration_hours ? [{ label: "Odhad. čas", value: `${task.estimated_duration_hours}h` }] : []),
    ...(task.estimated_cost ? [{ label: "Odhad. náklady", value: `${task.estimated_cost.toLocaleString()} Kč` }] : []),
  ];
  return (
    <article className="min-w-0 rounded-lg border border-border bg-card p-3 text-card-foreground [overflow-wrap:anywhere] md:p-4">
      <div className="flex min-w-0 items-start gap-2">
        <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${dotClass}`} aria-hidden="true" />
        <h3 className="min-w-0 flex-1 text-sm font-semibold leading-snug md:text-lg">{task.title}</h3>
      </div>
      <div className="mt-2 flex min-w-0 flex-wrap gap-1">
        <Badge variant="secondary" className="px-1.5 text-[10px] md:text-xs">{typeLabels[task.maintenance_type] || "Inspekce"}</Badge>
        {task.priority === "high" && <Badge variant="destructive" className="px-1.5 text-[10px] md:text-xs">Vysoká priorita</Badge>}
        {isOverdue && <Badge variant="destructive" className="px-1.5 text-[10px] md:text-xs">Po termínu</Badge>}
        {isAssigned && <Badge className="bg-demip-brand px-1.5 text-[10px] text-demip-brand-foreground md:text-xs">Pracovní příkaz vytvořen</Badge>}
      </div>
      {task.description && <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground md:text-sm">{task.description}</p>}
      <dl className="mt-3 grid min-w-0 grid-cols-2 gap-x-3 gap-y-2 md:grid-cols-4">
        {fields.map(({ label, value }) => <div key={label} className="min-w-0">
          <dt className="text-xs text-muted-foreground">{label}</dt>
          <dd className={`mt-0.5 text-xs font-medium leading-relaxed md:text-sm ${isOverdue && label === "Plánované datum" ? "text-status-danger" : "text-foreground"}`}>{value}</dd>
        </div>)}
      </dl>
      {task.notes && <p className="mt-2 whitespace-pre-wrap rounded bg-muted p-2 text-xs leading-relaxed text-muted-foreground">{task.notes}</p>}
      <div className="mt-3 flex min-w-0 flex-wrap gap-2 [&>button]:h-auto [&>button]:min-h-9 [&>button]:max-w-full [&>button]:whitespace-normal [&>button]:text-xs md:[&>button]:text-sm">{children}</div>
    </article>
  );
}