import React from "react";
import { Link } from "react-router-dom";
import MachineRowIndicators from "@/components/dashboard/MachineRowIndicators";

const dot = { ok: "bg-status-success", warning: "bg-dashboard-warning", critical: "bg-status-danger" };
const label = { ok: "Termíny splněny", warning: "Termín překročen", critical: "Kritické překročení termínu" };

export default function DashboardMachineRow({ machine, status, pointCount, showPoints = true, targetUrl, showIndicators = false, overdueCount, issueCount, children, statusDescription }) {
  return (
    <Link to={targetUrl || `/Machine?id=${machine.id}`} className="flex items-center gap-3 py-3 border-b border-border hover:text-dashboard-accent">
      <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${dot[status] || "bg-muted-foreground"}`} title={statusDescription || label[status] || "Diagnostický stav"} aria-label={statusDescription || label[status] || "Diagnostický stav"} role="img" />
      <span className="text-sm font-medium flex-1 min-w-0 break-words">{machine.name}{children && <span className="mt-1 block">{children}</span>}</span>
      {showPoints && <span className="text-xs text-muted-foreground shrink-0">{pointCount} bodů</span>}
      {showIndicators && <MachineRowIndicators overdueCount={overdueCount} issueCount={issueCount} />}
    </Link>
  );
}