import React from "react";
import { Badge } from "@/components/ui/badge";
import { FileText } from "lucide-react";
import { VTZ_TYPES, CATEGORIES, OPEN_STATUSES, fmtDate, daysUntil, isDefectOverdue } from "./revisionConstants";

export default function ReportsTable({ reports, defects, onOpen }) {
  const sorted = [...reports].sort((a, b) => (b.revision_date_to || "").localeCompare(a.revision_date_to || ""));
  return (
    <div className="overflow-x-auto border rounded-lg bg-white">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-slate-600 text-xs uppercase">
          <tr>
            <th className="p-3 text-left">Zpráva</th>
            <th className="p-3 text-left">Předmět revize</th>
            <th className="p-3 text-left">Typ</th>
            <th className="p-3 text-left">Revize</th>
            <th className="p-3 text-left">Příští revize</th>
            <th className="p-3 text-left">Závady</th>
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 && (
            <tr><td colSpan={6} className="p-6 text-center text-slate-500">Zatím žádné revizní zprávy</td></tr>
          )}
          {sorted.map((r) => {
            const ds = defects.filter((d) => d.report_id === r.id);
            const open = ds.filter((d) => OPEN_STATUSES.includes(d.status || "new")).length;
            const overdue = ds.filter(isDefectOverdue).length;
            const days = r.next_revision_date ? daysUntil(r.next_revision_date) : null;
            const nextTone = days === null ? "" : days < 0 ? "text-red-700 font-semibold" : days <= 90 ? "text-amber-700 font-semibold" : "";
            return (
              <tr key={r.id} onClick={() => onOpen(r)} className="border-t cursor-pointer hover:bg-slate-50">
                <td className="p-3 whitespace-nowrap">
                  <span className="flex items-center gap-2 font-mono text-xs">
                    <FileText className="w-4 h-4 text-blue-600" />{r.report_number}
                  </span>
                </td>
                <td className="p-3">
                  <p className="text-slate-900">{r.subject}</p>
                  {r.category && <p className="text-xs text-slate-500">{CATEGORIES[r.category]?.label}</p>}
                </td>
                <td className="p-3 text-xs">{VTZ_TYPES[r.vtz_type]}</td>
                <td className="p-3 whitespace-nowrap">{fmtDate(r.revision_date_to || r.revision_date_from)}</td>
                <td className={`p-3 whitespace-nowrap ${nextTone}`}>{fmtDate(r.next_revision_date)}</td>
                <td className="p-3">
                  <div className="flex flex-wrap gap-1">
                    <Badge variant="outline" className="bg-blue-50 text-blue-800">{ds.length} celkem</Badge>
                    {open > 0 && <Badge variant="outline" className="bg-amber-100 text-amber-800">{open} otevřené</Badge>}
                    {overdue > 0 && <Badge className="bg-red-600 text-white">{overdue} po termínu</Badge>}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}