import React from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { FileText } from "lucide-react";

export default function SavedReportsList({ machineId, onOpen }) {
  const { data: reports = [], isLoading } = useQuery({
    queryKey: ["vibrationReports", machineId],
    queryFn: () => base44.entities.VibrationReport.filter({ machine_id: machineId }, "-created_date", 50),
  });
  if (isLoading) return <p className="text-xs text-muted-foreground">Načítám uložené zprávy…</p>;
  if (!reports.length) return <p className="text-xs text-muted-foreground">Zatím žádné uložené zprávy.</p>;
  return (
    <div className="space-y-1 max-h-48 overflow-y-auto">
      {reports.map((r) => (
        <button key={r.id} onClick={() => onOpen(r)} className="w-full flex items-center gap-2 text-left text-sm p-2 rounded hover:bg-muted">
          <FileText className="w-4 h-4 text-muted-foreground" />
          <span className="flex-1">{r.period_from} – {r.period_to}</span>
          <span className="text-xs text-muted-foreground">{r.author} · pásmo {r.overall_band || "—"}</span>
        </button>
      ))}
    </div>
  );
}