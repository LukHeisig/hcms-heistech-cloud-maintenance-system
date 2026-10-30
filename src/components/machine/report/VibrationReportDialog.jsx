import React, { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Printer, Save, ArrowLeft } from "lucide-react";
import { format, subDays } from "date-fns";
import { buildReport } from "@/lib/vibrationReport";
import ReportPreview from "./ReportPreview";
import SavedReportsList from "./SavedReportsList";

const PRINT_CSS = `@media print { body * { visibility: hidden !important; } #vib-report, #vib-report * { visibility: visible !important; }
#vib-report { position: absolute; left: 0; top: 0; width: 100%; } [role=dialog] { overflow: visible !important; max-height: none !important; transform: none !important; } @page { size: A4; margin: 12mm; } }`;

// points: [{ label, sensorId, velStd, accStd, bearing, orientation }]
export default function VibrationReportDialog({ open, onClose, machine, points }) {
  const qc = useQueryClient();
  const [from, setFrom] = useState(format(subDays(new Date(), 30), "yyyy-MM-dd"));
  const [to, setTo] = useState(format(new Date(), "yyyy-MM-dd"));
  const [selected, setSelected] = useState(points.map((p) => p.sensorId));
  const [author, setAuthor] = useState("");
  const [data, setData] = useState(null);
  const [meta, setMeta] = useState(null);
  const [savedId, setSavedId] = useState(null);
  const [busy, setBusy] = useState(false);

  React.useEffect(() => { base44.auth.me().then((u) => setAuthor(u.custom_display_name || u.full_name || u.email)); }, []);

  const generate = async () => {
    setBusy(true);
    const d = await buildReport({ machine, points: points.filter((p) => selected.includes(p.sensorId)), from, to });
    setMeta({ from, to, author, created: format(new Date(), "yyyy-MM-dd") });
    setData(d); setSavedId(null); setBusy(false);
  };

  const save = async () => {
    setBusy(true);
    const payload = { machine_id: machine.id, machine_name: machine.name, period_from: meta.from, period_to: meta.to, author: meta.author,
      overall_band: data.overall, conclusion: data.conclusion, recommendation: data.recommendation, data_json: JSON.stringify({ ...data, created: meta.created }) };
    const rec = savedId ? await base44.entities.VibrationReport.update(savedId, payload) : await base44.entities.VibrationReport.create(payload);
    setSavedId(rec.id || savedId);
    qc.invalidateQueries({ queryKey: ["vibrationReports", machine.id] });
    setBusy(false);
  };

  const openSaved = (r) => {
    const d = JSON.parse(r.data_json);
    setData({ ...d, conclusion: r.conclusion, recommendation: r.recommendation });
    setMeta({ from: r.period_from, to: r.period_to, author: r.author, created: d.created || r.created_date.slice(0, 10) });
    setSavedId(r.id);
  };

  const toggle = (sid) => setSelected((s) => (s.includes(sid) ? s.filter((x) => x !== sid) : [...s, sid]));

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <style>{PRINT_CSS}</style>
        <DialogHeader className="print:hidden"><DialogTitle>Technická zpráva z měření vibrací</DialogTitle></DialogHeader>
        {!data ? (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div><label className="text-xs text-muted-foreground">Od</label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
              <div><label className="text-xs text-muted-foreground">Do</label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
              <div><label className="text-xs text-muted-foreground">Zpracoval</label><Input value={author} onChange={(e) => setAuthor(e.target.value)} /></div>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground">Měřicí místa</p>
              {points.map((p) => (
                <label key={p.sensorId} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox checked={selected.includes(p.sensorId)} onCheckedChange={() => toggle(p.sensorId)} />{p.label}
                </label>
              ))}
            </div>
            <Button onClick={generate} disabled={busy || !selected.length} className="w-full">
              {busy && <Loader2 className="w-4 h-4 animate-spin" />}{busy ? "Sestavuji zprávu (vč. hodnocení FFT)…" : "Sestavit zprávu"}
            </Button>
            <div className="border-t pt-3"><p className="text-xs font-semibold text-muted-foreground mb-2">Uložené zprávy</p>
              <SavedReportsList machineId={machine.id} onOpen={openSaved} /></div>
          </div>
        ) : (
          <>
            <div className="flex gap-2 print:hidden">
              <Button variant="outline" size="sm" onClick={() => setData(null)}><ArrowLeft className="w-4 h-4" />Zpět</Button>
              <div className="flex-1" />
              <Button variant="outline" size="sm" onClick={save} disabled={busy}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}{savedId ? "Uložit změny" : "Uložit zprávu"}</Button>
              <Button size="sm" onClick={() => window.print()}><Printer className="w-4 h-4" />Export PDF</Button>
            </div>
            <ReportPreview machine={machine} meta={meta} data={data} onChange={setData} />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}