import React from "react";
import { Archive, ArrowRight, ArrowLeft } from "lucide-react";
import { fmtDate } from "./revisionConstants";

// Vazby mezi archivovanou a navazující revizní zprávou
export default function ReportLinks({ report, reports, onOpenReport }) {
  const byId = (id) => reports.find((r) => r.id === id);
  const succ = byId(report.successor_report_id);
  const pred = byId(report.predecessor_report_id);
  if (!report.is_archived && !report.predecessor_report_id) return null;
  const link = (r, num) => r
    ? <button type="button" className="font-semibold text-blue-700 hover:underline" onClick={() => onOpenReport(r)}>{r.report_number}</button>
    : <strong>{num}</strong>;
  return (
    <div className="rounded-lg border bg-slate-50 p-3 text-sm space-y-1">
      {report.is_archived && (
        <p className="flex flex-wrap items-center gap-1.5 text-amber-800">
          <Archive className="w-4 h-4" /> Archivováno {fmtDate(report.archived_at)}{report.archived_by && ` (${report.archived_by})`}
          <ArrowRight className="w-4 h-4" /> nahrazeno zprávou {link(succ, report.successor_report_number)}
        </p>
      )}
      {report.predecessor_report_id && (
        <p className="flex flex-wrap items-center gap-1.5 text-slate-700">
          <ArrowLeft className="w-4 h-4" /> Navazuje na archivovanou zprávu {link(pred, report.predecessor_report_number)}
        </p>
      )}
    </div>
  );
}