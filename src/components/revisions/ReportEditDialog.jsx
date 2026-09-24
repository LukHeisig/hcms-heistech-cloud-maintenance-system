import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileText, Loader2, Trash2 } from "lucide-react";
import ReportForm from "./ReportForm";
import ChangeHistory from "./ChangeHistory";
import DefectsTable from "./DefectsTable";
import { logChanges } from "./revisionLog";

export default function ReportEditDialog({ report, defects, users, user, canEdit, onClose, onOpenDefect }) {
  const qc = useQueryClient();
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setForm(report ? { ...report } : null); }, [report]);
  if (!report || !form) return null;

  const own = defects.filter((d) => d.report_id === report.id);
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["revisionReports"] });
    qc.invalidateQueries({ queryKey: ["revisionDefects"] });
  };

  const save = async () => {
    setSaving(true);
    const { id, created_date, updated_date, created_by_id, created_by, ...data } = form;
    await base44.entities.RevisionReport.update(report.id, data);
    await logChanges({ user, recordType: "report", recordId: report.id, companyId: report.company_id, before: report, after: data });
    refresh();
    onClose();
  };

  const remove = async () => {
    if (!window.confirm(`Smazat revizní zprávu ${report.report_number} včetně ${own.length} závad?`)) return;
    setSaving(true);
    await base44.entities.RevisionDefect.deleteMany({ report_id: report.id });
    await base44.entities.RevisionReport.delete(report.id);
    await logChanges({ user, recordType: "report", recordId: report.id, companyId: report.company_id, action: "deleted", after: `Zpráva ${report.report_number}` });
    refresh();
    onClose();
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>Revizní zpráva {report.report_number}</DialogTitle>
          <DialogDescription>{report.subject}</DialogDescription>
        </DialogHeader>
        <div className="max-h-[68vh] overflow-y-auto space-y-6 px-1">
          {report.pdf_url && (
            <a href={report.pdf_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm text-blue-700 hover:underline">
              <FileText className="w-4 h-4" /> Otevřít PDF revizní zprávy
            </a>
          )}
          <ReportForm value={form} onChange={setForm} disabled={!canEdit} />
          <div>
            <h3 className="font-semibold mb-2">Závady ze zprávy ({own.length})</h3>
            <DefectsTable defects={own} reports={[report]} users={users} onOpen={onOpenDefect} />
          </div>
          <ChangeHistory recordId={report.id} />
        </div>
        <DialogFooter className="gap-2">
          {canEdit && (
            <Button variant="outline" onClick={remove} disabled={saving} className="text-red-600 mr-auto gap-2">
              <Trash2 className="w-4 h-4" /> Smazat
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>Zavřít</Button>
          {canEdit && (
            <Button onClick={save} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />} Uložit změny
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}