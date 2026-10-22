import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Archive, Loader2 } from "lucide-react";
import { addMonths, format } from "date-fns";
import { logChanges } from "./revisionLog";

// Archivace revizní zprávy: nahrazení novou (navazující) zprávou
export default function ArchiveReportDialog({ report, reports, user, onClose, onDone }) {
  const [number, setNumber] = useState("");
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (!number.trim() || !date) return setError("Vyplňte číslo nové zprávy i datum nové revize.");
    setSaving(true);
    const link = { predecessor_report_id: report.id, predecessor_report_number: report.report_number };
    let successor = reports.find((r) => r.id !== report.id && !r.is_archived && r.report_number?.trim().toLowerCase() === number.trim().toLowerCase());
    if (successor) {
      await base44.entities.RevisionReport.update(successor.id, link);
    } else {
      successor = await base44.entities.RevisionReport.create({
        company_id: report.company_id, report_number: number.trim(), vtz_type: report.vtz_type, category: report.category,
        subject: report.subject, revision_kind: report.revision_kind, responsible_person: report.responsible_person,
        interval_months: report.interval_months, revision_date_from: date, revision_date_to: date,
        previous_revision_date: report.revision_date_to,
        next_revision_date: report.interval_months ? format(addMonths(new Date(date), report.interval_months), "yyyy-MM-dd") : undefined,
        ...link,
      });
    }
    await base44.entities.RevisionReport.update(report.id, {
      is_archived: true, archived_at: date, archived_by: user?.email,
      successor_report_id: successor.id, successor_report_number: successor.report_number,
    });
    await logChanges({ user, recordType: "report", recordId: report.id, companyId: report.company_id, action: "archived", after: `Archivováno, nahrazeno zprávou ${successor.report_number}` });
    onDone();
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Archivovat revizi {report.report_number}</DialogTitle>
          <DialogDescription>Zpráva se přesune do archivu včetně svých závad a propojí se s novou revizní zprávou.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div><Label>Číslo nové (navazující) revizní zprávy</Label><Input value={number} onChange={(e) => setNumber(e.target.value)} placeholder="např. RE-27-0012" /></div>
          <div><Label>Datum nové revize (= datum archivace)</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <p className="text-xs text-slate-500">Pokud zpráva s tímto číslem už existuje, propojí se. Jinak se založí nová zpráva s údaji ze stávající, kterou pak můžete doplnit.</p>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Zrušit</Button>
          <Button onClick={submit} disabled={saving} className="bg-blue-600 hover:bg-blue-700 gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Archive className="w-4 h-4" />} Archivovat
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}