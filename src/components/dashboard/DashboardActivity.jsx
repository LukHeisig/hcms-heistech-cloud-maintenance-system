import React from "react";
import { Link } from "react-router-dom";
import { Activity, AlertTriangle, Droplet, ClipboardCheck } from "lucide-react";
import { format } from "date-fns";
import { cs } from "date-fns/locale";

export default function DashboardActivity({ records, issues, points, getUserDisplayName }) {
  return <aside className="op-pair op-activity">
    <section className="bg-card rounded-xl border border-border shadow-sm">
      <h2 className="flex items-center gap-2 text-lg font-semibold p-4 border-b border-border"><Activity className="w-5 h-5 text-muted-foreground" />Poslední záznamy</h2>
      <div className="p-4 space-y-3">
        {records.length === 0 && <p className="text-center text-muted-foreground py-8 text-sm">Zatím nejsou žádné záznamy</p>}
        {records.slice(0, 5).map(record => {
          const point = points.find(p => p.id === record.control_point_id);
          const Icon = record.record_type === "lubrication" ? Droplet : ClipboardCheck;
          return <div key={record.id} className="op-rec">
            <Icon className="w-4 h-4 shrink-0 mt-1 text-dashboard-accent" />
            <div className="min-w-0"><p className="text-sm font-medium break-words">{point?.name || "Neznámý bod"}</p>
              <p className="text-xs text-muted-foreground mt-1">{format(new Date(record.performed_at), "d. M. yyyy HH:mm", { locale: cs })}</p>
              <p className="text-xs text-muted-foreground mt-1 break-words">{getUserDisplayName(record.created_by)}</p></div>
          </div>;
        })}
      </div>
    </section>
    {issues.length > 0 && <section className="bg-card rounded-xl border border-border shadow-sm">
      <h2 className="flex items-center gap-2 text-lg font-semibold p-4 border-b border-border"><AlertTriangle className="w-5 h-5 text-dashboard-warning" />Aktivní závady</h2>
      <div className="p-4 space-y-3">{issues.slice(0, 3).map(issue => {
        const point = points.find(p => p.id === issue.control_point_id);
        return <div key={issue.id} className="op-defect">
          <p className="text-sm font-medium mb-1">{point?.name || "Neznámý bod"}</p><p className="text-xs text-muted-foreground line-clamp-2">{issue.description}</p>
          {issue.photo_url && <img src={issue.photo_url} alt="Závada" className="max-h-20 object-contain rounded-md mt-2" />}
          <p className="text-xs text-muted-foreground mt-2 break-words">{format(new Date(issue.created_date), "d. M. yyyy", { locale: cs })} · {getUserDisplayName(issue.created_by)}</p>
        </div>;
      })}{issues.length > 3 && <Link to="/IssueApproval" className="block text-center text-sm text-dashboard-accent font-medium mt-4">Zobrazit všechny závady →</Link>}</div>
    </section>}
  </aside>;
}