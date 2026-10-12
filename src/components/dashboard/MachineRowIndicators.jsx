import React from "react";
import { CheckCircle2 } from "lucide-react";

export default function MachineRowIndicators({ overdueCount, issueCount }) {
  return <span className="flex shrink-0 items-center gap-3 md:gap-5">
    {[{ label: "Po termínu", count: overdueCount, color: "text-status-danger" }, { label: "Závady", count: issueCount, color: "text-status-warning" }].map(({ label, count, color }) => (
      <span key={label} className="flex flex-col items-center gap-1 text-xs">
        <span className="text-muted-foreground">{label}</span>
        {count == null ? <span className="text-muted-foreground">–</span> : count > 0 ?
          <span className={`font-semibold ${color}`} aria-label={`${label}: ${count}`}>{count}</span> :
          <CheckCircle2 className="h-4 w-4 text-status-success" aria-label={`${label}: 0`} />}
      </span>
    ))}
  </span>;
}