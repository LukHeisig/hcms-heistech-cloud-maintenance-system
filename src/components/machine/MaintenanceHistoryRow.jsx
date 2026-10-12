import React from "react";
import { format } from "date-fns";
import { cs } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";

export default function MaintenanceHistoryRow({ record, technicianName }) {
  const typeLabels = { preventive: "Preventivní", corrective: "Korektivní", predictive: "Prediktivní", inspection: "Inspekce" };
  return (
    <article className="min-w-0 rounded-lg border border-border bg-card p-3 text-card-foreground [overflow-wrap:anywhere] md:hidden">
      <div className="flex min-w-0 items-start gap-2">
        <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-status-success" aria-hidden="true" />
        <h3 className="min-w-0 flex-1 text-sm font-semibold leading-snug">{record.title}</h3>
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
        <Badge variant="secondary" className="px-1.5 text-[10px]">{typeLabels[record.maintenance_type] || "Inspekce"}</Badge>
        <time dateTime={record.performed_at} className="text-xs leading-relaxed text-muted-foreground">{format(new Date(record.performed_at), "d.M. yyyy HH:mm", { locale: cs })}</time>
      </div>
      {record.description && <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">{record.description}</p>}
      <dl className="mt-2 flex min-w-0 flex-wrap gap-x-3 gap-y-1 text-xs leading-relaxed">
        {record.technician && <div className="min-w-0 basis-full"><dt className="inline text-muted-foreground">Technik: </dt><dd className="inline font-medium">{technicianName}</dd></div>}
        {!!record.duration_hours && <div className="min-w-0"><dt className="inline text-muted-foreground">Doba: </dt><dd className="inline font-medium">{record.duration_hours}h</dd></div>}
        {!!record.cost && <div className="min-w-0"><dt className="inline text-muted-foreground">Náklady: </dt><dd className="inline font-medium text-status-success">{record.cost.toLocaleString()} Kč</dd></div>}
      </dl>
      {record.notes && <p className="mt-2 whitespace-pre-wrap rounded bg-muted px-2 py-1.5 text-xs leading-relaxed text-muted-foreground">{record.notes}</p>}
    </article>
  );
}