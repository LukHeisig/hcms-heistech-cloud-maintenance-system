import React from "react";
import { Link } from "react-router-dom";
import { ChevronDown, ArrowRight } from "lucide-react";

const dot = { ok: "bg-status-success", warning: "bg-dashboard-warning", critical: "bg-status-danger" };
const label = { ok: "Termíny splněny", warning: "Termín překročen", critical: "Kritické překročení termínu" };
const worst = statuses => statuses.some(s => s === "critical" || s === "overdue") ? "critical" : statuses.includes("warning") ? "warning" : "ok";

export default function DashboardDemipLine({ line, machines, points, getPointStatus, compact }) {
  const status = worst(points.map(getPointStatus));
  return <details className="dashboard-line rounded-lg border border-border bg-card">
    <summary className="flex items-center gap-3 p-4 cursor-pointer list-none">
      <span className={`w-3 h-3 rounded-full shrink-0 ${dot[status]}`} role="img" aria-label={label[status]} title={label[status]} />
      <div className="min-w-0 flex-1">
        <h3 className={compact ? "text-sm font-semibold break-words" : "text-lg font-bold break-words"}>{line.name}</h3>
        <p className="text-xs text-muted-foreground mt-1">{machines.length} {machines.length === 1 ? "stroj" : machines.length < 5 ? "stroje" : "strojů"} · {points.length} bodů</p>
      </div>
      <ChevronDown className="dashboard-line-chevron w-4 h-4 shrink-0 text-muted-foreground" />
    </summary>
    <div className="border-t border-border px-4 pb-3">
      {machines.length === 0 && <p className="text-sm text-muted-foreground py-3">V této lince nejsou žádné stroje.</p>}
      {machines.map(machine => {
        const machinePoints = points.filter(p => p.machine_id === machine.id);
        const machineStatus = worst(machinePoints.map(getPointStatus));
        return <Link key={machine.id} to={`/Machine?id=${machine.id}`} className="flex items-center gap-3 py-3 border-b border-border hover:text-dashboard-accent">
          <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${dot[machineStatus]}`} title={label[machineStatus]} aria-label={label[machineStatus]} role="img" />
          <span className="text-sm font-medium flex-1 min-w-0 break-words">{machine.name}</span>
          <span className="text-xs text-muted-foreground shrink-0">{machinePoints.length} bodů</span>
        </Link>;
      })}
      <Link to={`/LineDetail?id=${line.id}&company=${line.company_id}`} className="flex items-center justify-end gap-2 text-sm font-medium text-dashboard-accent pt-3">Otevřít linku<ArrowRight className="w-4 h-4" /></Link>
    </div>
  </details>;
}