import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plus, Pencil, Trash2, Settings2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

const EMPTY = { designation: "", manufacturer: "", nb: "", bd: "", pd: "", contact_angle_deg: 0, notes: "", bpfo_coef: "", bpfi_coef: "", bsf_coef: "", ftf_coef: "" };

function calcPreviewFreqs(b, rpm = 1800) {
  const s = rpm / 60;
  // Prioritize stored coefs
  if (b.bpfo_coef && b.bpfi_coef) {
    return {
      bpfo: +(b.bpfo_coef * s).toFixed(3),
      bpfi: +(b.bpfi_coef * s).toFixed(3),
      bsf:  b.bsf_coef ? +(b.bsf_coef * s).toFixed(3) : null,
      ftf:  b.ftf_coef ? +(b.ftf_coef * s).toFixed(3) : null,
    };
  }
  if (!b.nb || !b.bd || !b.pd) return null;
  const ratio = b.bd / b.pd * Math.cos((b.contact_angle_deg || 0) * Math.PI / 180);
  return {
    bpfo: +(0.5 * b.nb * s * (1 - ratio)).toFixed(3),
    bpfi: +(0.5 * b.nb * s * (1 + ratio)).toFixed(3),
    bsf:  +(0.5 * (b.pd / b.bd) * s * (1 - ratio * ratio)).toFixed(3),
    ftf:  +(0.5 * s * (1 - ratio)).toFixed(3),
  };
}

function calcCoefsFromGeometry(nb, bd, pd, alpha_deg) {
  if (!nb || !bd || !pd) return null;
  const ratio = (bd / pd) * Math.cos((alpha_deg || 0) * Math.PI / 180);
  return {
    bpfo: +(0.5 * nb * (1 - ratio)).toFixed(4),
    bpfi: +(0.5 * nb * (1 + ratio)).toFixed(4),
    bsf:  +(0.5 * (pd / bd) * (1 - ratio * ratio)).toFixed(4),
    ftf:  +(0.5 * (1 - ratio)).toFixed(4),
  };
}

function BearingForm({ initial, onSave, onCancel }) {
  // Determine initial tab based on whether stored coefs exist
  const hasStoredCoefs = !!(initial?.bpfo_coef && initial?.bpfi_coef);
  const [tab, setTab] = useState(hasStoredCoefs ? "manual" : "geometry");
  const [form, setForm] = useState(initial || EMPTY);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // For geometry tab: auto-compute coefs as preview
  const geoCoefs = calcCoefsFromGeometry(
    Number(form.nb), Number(form.bd), Number(form.pd), Number(form.contact_angle_deg) || 0
  );

  const previewData = tab === "manual"
    ? { ...form, nb: Number(form.nb), bd: Number(form.bd), pd: Number(form.pd), contact_angle_deg: Number(form.contact_angle_deg) || 0, bpfo_coef: Number(form.bpfo_coef), bpfi_coef: Number(form.bpfi_coef), bsf_coef: Number(form.bsf_coef), ftf_coef: Number(form.ftf_coef) }
    : { ...form, nb: Number(form.nb), bd: Number(form.bd), pd: Number(form.pd), contact_angle_deg: Number(form.contact_angle_deg) || 0, bpfo_coef: 0, bpfi_coef: 0 };

  const preview = calcPreviewFreqs(previewData);

  const handleSave = () => {
    const base = {
      designation: form.designation,
      manufacturer: form.manufacturer,
      notes: form.notes,
      nb: Number(form.nb) || null,
      bd: Number(form.bd) || null,
      pd: Number(form.pd) || null,
      contact_angle_deg: Number(form.contact_angle_deg) || 0,
    };
    if (tab === "manual") {
      onSave({ ...base, bpfo_coef: Number(form.bpfo_coef), bpfi_coef: Number(form.bpfi_coef), bsf_coef: Number(form.bsf_coef) || null, ftf_coef: Number(form.ftf_coef) || null });
    } else {
      // Geometry mode: store computed coefs
      onSave({ ...base, bpfo_coef: geoCoefs?.bpfo || null, bpfi_coef: geoCoefs?.bpfi || null, bsf_coef: geoCoefs?.bsf || null, ftf_coef: geoCoefs?.ftf || null });
    }
  };

  const manualValid = form.designation && form.bpfo_coef && form.bpfi_coef;
  const geoValid = form.designation && form.nb && form.bd && form.pd;

  return (
    <div className="space-y-4">
      {/* Common fields */}
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <Label>Označení ložiska *</Label>
          <Input placeholder="např. 6205, 22312 EK" value={form.designation} onChange={e => set("designation", e.target.value)} />
        </div>
        <div>
          <Label>Výrobce</Label>
          <Input placeholder="SKF, FAG, NSK..." value={form.manufacturer} onChange={e => set("manufacturer", e.target.value)} />
        </div>
        <div>
          <Label>Poznámky</Label>
          <Input placeholder="Volitelný popis..." value={form.notes} onChange={e => set("notes", e.target.value)} />
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full">
          <TabsTrigger value="manual" className="flex-1">Defektní frekvence ručně</TabsTrigger>
          <TabsTrigger value="geometry" className="flex-1">Výpočet z geometrie</TabsTrigger>
        </TabsList>

        <TabsContent value="manual" className="space-y-3 pt-3">
          <p className="text-xs text-slate-500">Zadejte koeficienty defektních frekvencí (násobky otáčkové frekvence fr = RPM/60).</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>BPFO koeficient *</Label>
              <Input type="number" step="0.0001" placeholder="3.5" value={form.bpfo_coef} onChange={e => set("bpfo_coef", e.target.value)} />
            </div>
            <div>
              <Label>BPFI koeficient *</Label>
              <Input type="number" step="0.0001" placeholder="5.5" value={form.bpfi_coef} onChange={e => set("bpfi_coef", e.target.value)} />
            </div>
            <div>
              <Label>BSF koeficient</Label>
              <Input type="number" step="0.0001" placeholder="2.3" value={form.bsf_coef} onChange={e => set("bsf_coef", e.target.value)} />
            </div>
            <div>
              <Label>FTF koeficient</Label>
              <Input type="number" step="0.0001" placeholder="0.4" value={form.ftf_coef} onChange={e => set("ftf_coef", e.target.value)} />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="geometry" className="space-y-3 pt-3">
          <p className="text-xs text-slate-500">Zadejte geometrii ložiska — koeficienty budou vypočteny automaticky.</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Počet valivých elementů (Nb) *</Label>
              <Input type="number" placeholder="9" value={form.nb} onChange={e => set("nb", e.target.value)} />
            </div>
            <div>
              <Label>Průměr elementu Bd [mm] *</Label>
              <Input type="number" step="0.001" placeholder="7.938" value={form.bd} onChange={e => set("bd", e.target.value)} />
            </div>
            <div>
              <Label>Roztečný průměr Pd [mm] *</Label>
              <Input type="number" step="0.001" placeholder="38.5" value={form.pd} onChange={e => set("pd", e.target.value)} />
            </div>
            <div>
              <Label>Kontaktní úhel α [°]</Label>
              <Input type="number" placeholder="0" value={form.contact_angle_deg} onChange={e => set("contact_angle_deg", e.target.value)} />
            </div>
          </div>
          {geoCoefs && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs font-mono text-slate-700 grid grid-cols-2 gap-x-4 gap-y-0.5">
              <span>BPFO: <strong>{geoCoefs.bpfo}</strong></span>
              <span>BPFI: <strong>{geoCoefs.bpfi}</strong></span>
              <span>BSF: <strong>{geoCoefs.bsf}</strong></span>
              <span>FTF: <strong>{geoCoefs.ftf}</strong></span>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {preview && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs">
          <p className="font-semibold text-blue-700 mb-1.5">Defektní frekvence při 1800 RPM (náhled):</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 font-mono text-blue-800">
            <span>BPFO (vnější dráha): <strong>{preview.bpfo} Hz</strong></span>
            <span>BPFI (vnitřní dráha): <strong>{preview.bpfi} Hz</strong></span>
            {preview.bsf != null && <span>BSF (valivý element): <strong>{preview.bsf} Hz</strong></span>}
            {preview.ftf != null && <span>FTF (klec): <strong>{preview.ftf} Hz</strong></span>}
          </div>
        </div>
      )}

      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>Zrušit</Button>
        <Button
          disabled={tab === "manual" ? !manualValid : !geoValid}
          onClick={handleSave}
          className="bg-blue-600 hover:bg-blue-700"
        >
          Uložit
        </Button>
      </DialogFooter>
    </div>
  );
}

export default function AdminBearings() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [dialog, setDialog] = useState(null); // null | { mode: "create" | "edit", bearing?: obj }

  const { data: bearings = [], isLoading } = useQuery({
    queryKey: ["bearingTypes"],
    queryFn: () => base44.entities.BearingType.list(null, 500),
  });

  const createMut = useMutation({
    mutationFn: (data) => base44.entities.BearingType.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["bearingTypes"] }); setDialog(null); toast({ title: "Ložisko přidáno" }); },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }) => base44.entities.BearingType.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["bearingTypes"] }); setDialog(null); toast({ title: "Ložisko aktualizováno" }); },
  });

  const deleteMut = useMutation({
    mutationFn: (id) => base44.entities.BearingType.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["bearingTypes"] }); toast({ title: "Ložisko odstraněno" }); },
  });

  const handleSave = (data) => {
    if (dialog?.mode === "edit") {
      updateMut.mutate({ id: dialog.bearing.id, data });
    } else {
      createMut.mutate(data);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Settings2 className="w-6 h-6 text-blue-600" />
            Typy ložisek
          </h1>
          <p className="text-sm text-slate-500 mt-1">Geometrie ložisek pro výpočet defektních frekvencí (BPFO, BPFI, BSF, FTF)</p>
        </div>
        <Button onClick={() => setDialog({ mode: "create" })} className="bg-blue-600 hover:bg-blue-700 gap-2">
          <Plus className="w-4 h-4" /> Přidat ložisko
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-slate-400">Načítám...</div>
          ) : bearings.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              <Settings2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>Žádné typy ložisek. Přidejte první ložisko tlačítkem výše.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              <div className="hidden md:grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_auto] gap-0 bg-slate-50 border-b px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                <div>Označení</div>
                <div className="text-center">Nb</div>
                <div className="text-center">Bd [mm]</div>
                <div className="text-center">Pd [mm]</div>
                <div className="text-center">α [°]</div>
                <div className="text-center">Výrobce</div>
                <div />
              </div>
              {bearings.map(b => (
                <div key={b.id} className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_auto] gap-0 px-4 py-3 items-center hover:bg-slate-50 transition-colors">
                  <div>
                    <span className="font-semibold text-slate-800">{b.designation}</span>
                    {b.notes && <p className="text-xs text-slate-400 truncate">{b.notes}</p>}
                  </div>
                  <div className="text-center font-mono text-sm">{b.nb}</div>
                  <div className="text-center font-mono text-sm">{b.bd}</div>
                  <div className="text-center font-mono text-sm">{b.pd}</div>
                  <div className="text-center font-mono text-sm">{b.contact_angle_deg ?? 0}</div>
                  <div className="text-center text-sm text-slate-500">{b.manufacturer || "—"}</div>
                  <div className="flex gap-1 justify-end">
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-slate-400 hover:text-blue-600"
                      onClick={() => setDialog({ mode: "edit", bearing: b })}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-slate-400 hover:text-red-600"
                      onClick={() => { if (confirm(`Smazat ložisko ${b.designation}?`)) deleteMut.mutate(b.id); }}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!dialog} onOpenChange={() => setDialog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{dialog?.mode === "edit" ? "Upravit ložisko" : "Přidat typ ložiska"}</DialogTitle>
          </DialogHeader>
          {dialog && (
            <BearingForm
              initial={dialog.bearing}
              onSave={handleSave}
              onCancel={() => setDialog(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}