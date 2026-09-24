import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { FileText, AlertTriangle, Clock, CheckCircle2, CalendarClock } from "lucide-react";
import { OPEN_STATUSES, isDefectOverdue, daysUntil } from "./revisionConstants";

const Stat = ({ icon: Icon, label, value, tone, sub }) => (
  <Card className={`border-l-4 ${tone.border}`}>
    <CardContent className="p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${tone.bg}`}>
        <Icon className={`w-5 h-5 ${tone.text}`} />
      </div>
      <div>
        <p className="text-2xl font-bold text-slate-900">{value}</p>
        <p className="text-xs text-slate-500">{label}</p>
        {sub && <p className="text-xs text-slate-600 mt-0.5">{sub}</p>}
      </div>
    </CardContent>
  </Card>
);

const T = {
  blue: { border: "border-l-blue-500", bg: "bg-blue-50", text: "text-blue-600" },
  amber: { border: "border-l-amber-500", bg: "bg-amber-50", text: "text-amber-600" },
  red: { border: "border-l-red-600", bg: "bg-red-50", text: "text-red-600" },
  green: { border: "border-l-green-600", bg: "bg-green-50", text: "text-green-600" },
};

export default function RevisionStats({ reports, defects }) {
  const open = defects.filter((d) => OPEN_STATUSES.includes(d.status || "new"));
  const byClass = (c) => open.filter((d) => d.classification === c).length;
  const overdue = defects.filter(isDefectOverdue).length;
  const closed = defects.filter((d) => d.status === "closed").length;
  const upcoming = reports.filter((r) => r.next_revision_date && daysUntil(r.next_revision_date) <= 90).length;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
      <Stat icon={FileText} label="Revizní zprávy" value={reports.length} tone={T.blue} />
      <Stat icon={AlertTriangle} label="Otevřené závady" value={open.length} tone={T.amber}
        sub={`C1: ${byClass("C1")} · C2: ${byClass("C2")} · C3: ${byClass("C3")}`} />
      <Stat icon={Clock} label="Závady po termínu" value={overdue} tone={T.red} />
      <Stat icon={CheckCircle2} label="Ukončené závady" value={closed} tone={T.green} />
      <Stat icon={CalendarClock} label="Revize do 90 dní / po termínu" value={upcoming} tone={T.amber} />
    </div>
  );
}