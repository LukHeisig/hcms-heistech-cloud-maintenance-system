import React from "react";
import { AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";
import { cs } from "date-fns/locale";

export default function ControlPointActiveIssues({ issues, getUserDisplayName }) {
  if (!issues.length) return null;
  return (
    <Card className="min-w-0 rounded-lg border-status-warning/40 bg-status-warning/5 shadow-none">
      <CardHeader className="min-w-0 p-3 pb-2">
        <CardTitle className="flex flex-wrap items-center gap-2 text-sm font-semibold text-status-warning">
          <AlertTriangle className="h-4 w-4 shrink-0" />Aktivní závady ({issues.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 p-3">
        {issues.map(issue => (
          <div key={issue.id} className="rounded-lg border border-status-warning/30 bg-card p-3">
            <p className="mb-1 whitespace-pre-wrap text-sm text-foreground">{issue.description}</p>
            {issue.photo_url && <div className="mt-2"><img src={issue.photo_url} alt="Závada" className="max-h-24 rounded-md object-contain" /></div>}
            <p className="mt-2 text-xs text-muted-foreground">{format(new Date(issue.created_date), "d.M.yyyy HH:mm", { locale: cs })} • {getUserDisplayName(issue.created_by)}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}