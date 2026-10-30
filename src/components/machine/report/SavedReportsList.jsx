import React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { FileText, Trash2 } from "lucide-react";

export default function SavedReportsList({ machineId, onOpen }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const isSuperAdmin = user?.user_type === "superAdmin";
  const { data: reports = [], isLoading } = useQuery({
    queryKey: ["vibrationReports", machineId],
    queryFn: () => base44.entities.VibrationReport.filter({ machine_id: machineId }, "-created_date", 50),
  });

  const remove = async (r) => {
    if (!window.confirm(`Smazat zprávu ${r.period_from} – ${r.period_to}?`)) return;
    await base44.entities.VibrationReport.delete(r.id);
    qc.invalidateQueries({ queryKey: ["vibrationReports", machineId] });
  };

  if (isLoading) return <p className="text-xs text-muted-foreground">Načítám uložené zprávy…</p>;
  if (!reports.length) return <p className="text-xs text-muted-foreground">Zatím žádné uložené zprávy.</p>;
  return (
    <div className="space-y-1 max-h-48 overflow-y-auto">
      {reports.map((r) => (
        <div key={r.id} className="flex items-center gap-1 rounded hover:bg-muted">
          <button onClick={() => onOpen(r)} className="flex-1 flex items-center gap-2 text-left text-sm p-2">
            <FileText className="w-4 h-4 text-muted-foreground" />
            <span className="flex-1">{r.period_from} – {r.period_to}</span>
            <span className="text-xs text-muted-foreground">{r.author} · pásmo {r.overall_band || "—"}</span>
          </button>
          {isSuperAdmin && (
            <button onClick={() => remove(r)} title="Smazat zprávu" className="p-2 text-destructive hover:opacity-70">
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}