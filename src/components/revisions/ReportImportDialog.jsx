import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Upload, Sparkles, FilePlus } from "lucide-react";
import ReportForm from "./ReportForm";
import DefectRowsEditor from "./DefectRowsEditor";
import { extractRevisionReport } from "./extractRevisionReport";
import { dueDateFor, nextRevisionFrom, toIso, CATEGORIES } from "./revisionConstants";
import { logChanges } from "./revisionLog";
import { endOfMonth } from "date-fns";

const EMPTY = { vtz_type: "electro", is_operational: true };

export default function ReportImportDialog({ open, onOpenChange, companyId, user, onSaved }) {
  const [step, setStep] = useState("upload");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [form, setForm] = useState(EMPTY);
  const [rows, setRows] = useState([]);

  const reset = () => { setStep("upload"); setForm(EMPTY); setRows([]); setError(""); setBusy(""); };
  const close = (v) => { if (!v) reset(); onOpenChange(v); };
  const foundDate = form.revision_date_to || form.revision_date_from;

  const handleFile = async (file) => {
    if (!file) return;
    setError("");
    setBusy("Nahrávám PDF...");
    const { file_url } = await base44.integrations.Core.UploadPublicFile({ file });
    setBusy("AI vytěžuje data z revizní zprávy...");
    try {
      const x = await extractRevisionReport(file_url);
      const found = x.revision_date_to || x.revision_date_from;
      const interval = x.interval_months || CATEGORIES[x.category]?.months || null;
      const next = x.next_revision_month
        ? toIso(endOfMonth(new Date(`${x.next_revision_month}-01`)))
        : nextRevisionFrom(found, interval);
      const { defects = [], next_revision_month, ...rest } = x;
      setForm({ ...EMPTY, ...rest, interval_months: interval, next_revision_date: next, pdf_url: file_url });
      setRows(defects.map((d) => ({ ...d, classification: d.classification || "C2", due_date: dueDateFor(found, d.classification || "C2") })));
      setStep("review");
    } catch (e) {
      setError("Vytěžení se nezdařilo. Údaje můžete vyplnit ručně.");
      setForm({ ...EMPTY, pdf_url: file_url });
      setStep("review");
    }
    setBusy("");
  };

  const save = async () => {
    setBusy("Ukládám...");
    const report = await base44.entities.RevisionReport.create({ ...form, company_id: companyId });
    const valid = rows.filter((r) => r.description?.trim());
    if (valid.length) {
      await base44.entities.RevisionDefect.bulkCreate(valid.map((r, i) => ({
        ...r,
        company_id: companyId,
        report_id: report.id,
        defect_number: `${form.report_number}/${i + 1}`,
        vtz_type: form.vtz_type,
        found_date: foundDate || undefined,
        status: "new",
      })));
    }
    await logChanges({ user, recordType: "report", recordId: report.id, companyId, action: "created", after: `Zpráva ${form.report_number}, závad: ${valid.length}` });
    onSaved();
    close(false);
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Nová revizní zpráva</DialogTitle>
          <DialogDescription>Nahrajte PDF revizní zprávy – AI vytěží údaje a závady. Před uložením je zkontrolujte.</DialogDescription>
        </DialogHeader>

        {busy ? (
          <div className="py-16 flex flex-col items-center gap-3 text-slate-600">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" /> {busy}
          </div>
        ) : step === "upload" ? (
          <div className="grid md:grid-cols-2 gap-4 py-4">
            <label className="border-2 border-dashed rounded-xl p-8 text-center cursor-pointer hover:bg-blue-50 border-blue-300">
              <input type="file" accept="application/pdf" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
              <Sparkles className="w-10 h-10 mx-auto text-blue-600 mb-2" />
              <p className="font-semibold">Načíst PDF a vytěžit pomocí AI</p>
              <p className="text-xs text-slate-500 mt-1"><Upload className="w-3 h-3 inline" /> Vyberte soubor PDF</p>
            </label>
            <button onClick={() => setStep("review")} className="border-2 border-dashed rounded-xl p-8 text-center hover:bg-slate-50">
              <FilePlus className="w-10 h-10 mx-auto text-slate-500 mb-2" />
              <p className="font-semibold">Zadat ručně</p>
              <p className="text-xs text-slate-500 mt-1">Bez PDF (např. plynová, tlaková, zdvihací VTZ)</p>
            </button>
          </div>
        ) : (
          <div className="max-h-[65vh] overflow-y-auto space-y-6 px-1">
            {error && <p className="text-sm text-red-600">{error}</p>}
            <ReportForm value={form} onChange={setForm} />
            <div>
              <h3 className="font-semibold mb-2">Zjištěné závady ({rows.length})</h3>
              <DefectRowsEditor rows={rows} onChange={setRows} foundDate={foundDate} />
            </div>
          </div>
        )}

        {step === "review" && !busy && (
          <DialogFooter>
            <Button variant="outline" onClick={() => close(false)}>Zrušit</Button>
            <Button onClick={save} disabled={!form.report_number?.trim()} className="bg-blue-600 hover:bg-blue-700">Uložit zprávu a závady</Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}