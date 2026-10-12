import React from "react";
import { Users } from "lucide-react";
import { format } from "date-fns";
import { cs } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";

export default function LineIssueRow({ issue, machineName, pointName, reporterName, onOpen }) {
  const resolved = issue.status === "resolved";
  const statusLabel = resolved ? "Vyřešeno" : "Nahlášeno";
  return (
    <div role="link" tabIndex={0} onClick={onOpen} onKeyDown={event => {
      if (event.key === "Enter") onOpen();
    }} className="flex items-center gap-4 p-2 hover:bg-slate-50 rounded-md border border-transparent hover:border-slate-100 transition-colors cursor-pointer md:gap-3 md:rounded-none md:border-0 md:border-b md:border-border md:px-0 md:py-3 md:hover:bg-transparent md:hover:text-dashboard-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <span role="img" aria-label={statusLabel} title={statusLabel} className={`hidden md:block h-2.5 w-2.5 shrink-0 rounded-full ${resolved ? "bg-status-success" : "bg-dashboard-warning"}`} />
      <div className="flex-shrink-0 w-24 text-xs text-slate-400 md:w-auto md:order-last md:text-muted-foreground">
        {format(new Date(issue.created_date), "HH:mm", { locale: cs })}
      </div>
      <div className="flex-shrink-0 md:hidden">
        <Badge className={resolved ? "bg-green-100 text-green-800 hover:bg-green-100" : "bg-orange-100 text-orange-800 hover:bg-orange-100"}>{statusLabel}</Badge>
      </div>
      <div className="flex-1 min-w-0 flex items-center gap-4 md:flex-col md:items-start md:gap-1">
        <div className="flex-shrink-0 w-48 md:w-auto md:flex md:flex-wrap md:items-baseline md:gap-x-2">
          <p className="text-sm font-bold text-slate-900 md:font-medium md:text-inherit" title={machineName}>{machineName}</p>
          <p className="text-xs text-slate-500 truncate md:text-muted-foreground md:whitespace-normal" title={pointName}>{pointName}</p>
        </div>
        <div className="flex-1 md:w-full">
          <p className="text-sm text-slate-700 truncate md:text-muted-foreground md:whitespace-normal md:break-words" title={issue.description}>{issue.description}</p>
        </div>
      </div>
      <div className="flex-shrink-0 flex items-center gap-3">
        <div className="text-xs text-slate-500 flex items-center gap-1 w-32 justify-end md:text-muted-foreground">
          <Users className="w-3 h-3" /><span className="truncate" title={reporterName}>{reporterName}</span>
        </div>
        {issue.photo_url ? <button type="button" aria-label="Otevřít fotografii závady" onKeyDown={event => event.stopPropagation()} onClick={event => {
          event.stopPropagation();
          window.open(issue.photo_url, "_blank", "noopener,noreferrer");
        }}><img src={issue.photo_url} alt="Foto závady" className="w-8 h-8 object-cover rounded border border-border hover:opacity-80 transition-opacity" /></button> : <div className="w-8 h-8" />}
      </div>
    </div>
  );
}