import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarClock } from "lucide-react";
import { VTZ_TYPES, fmtDate, daysUntil } from "./revisionConstants";

export default function UpcomingRevisions({ reports, onOpen }) {
  const list = reports
    .filter((r) => r.next_revision_date)
    .sort((a, b) => a.next_revision_date.localeCompare(b.next_revision_date))
    .slice(0, 8);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <CalendarClock className="w-5 h-5 text-amber-600" /> Nejbližší revize
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {list.length === 0 && <p className="text-sm text-slate-500">Žádné plánované revize.</p>}
        {list.map((r) => {
          const days = daysUntil(r.next_revision_date);
          const tone = days < 0 ? "bg-red-600 text-white" : days <= 90 ? "bg-amber-100 text-amber-800" : "bg-green-100 text-green-800";
          return (
            <button key={r.id} onClick={() => onOpen(r)}
              className="w-full text-left flex items-center justify-between gap-3 p-3 rounded-lg border hover:bg-slate-50">
              <div className="min-w-0">
                <p className="font-medium text-sm text-slate-900 truncate">{r.subject || r.report_number}</p>
                <p className="text-xs text-slate-500">{VTZ_TYPES[r.vtz_type]} · {r.report_number}</p>
              </div>
              <Badge className={`${tone} whitespace-nowrap`}>
                {fmtDate(r.next_revision_date)} {days < 0 ? "· po termínu" : `· ${days} dní`}
              </Badge>
            </button>
          );
        })}
      </CardContent>
    </Card>
  );
}