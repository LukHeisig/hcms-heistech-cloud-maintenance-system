import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Settings2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

const EMPTY = { designation: "", manufacturer: "", nb: "", bd: "", pd: "", contact_angle_deg: 0, notes: "" };

// Výpočet defektních frekvencí při 1 Hz (rpm/60 → škálovat frontendem)
function calcBearingFreqs(b, rpm = 1800) {
  if (!b?.nb || !b?.bd || !b?.pd) return null;
  const s = rpm / 60; // Hz
  const ratio = b.bd / b.pd * Math.cos(b.contact_angle_deg * Math.PI / 180);
  return {
    bpfo: +(0.5 * b.nb * s * (1 - ratio)).toFixed(3),
    bpfi: +(0.5 * b.nb * s * (1 + ratio)).toFixed(3),
    bsf:  +(0.5 * (b.pd / b.bd) * s * (1 - ratio * ratio)).toFixed(3),
    ftf:  +(0.5 * s * (1 - ratio)).toFixed(3),
  };
}

function BearingForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState(initial || EMPTY);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const preview = calcBearingFreqs({ ...form, nb: Number(form.nb), bd: Number(form.bd), pd: Number(form.pd), contact_angle_deg: Number(form.contact_angle_deg) || 0 });

  return (
    <div className="space-y-4">
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
          <Label>Počet valivých elementů (Nb) *</Label>
          <Input type="number" placeholder="9" value={form.nb} onChange={e => set("nb", e.target.value)} />
        </div>
        <div>
          <Label>Průměr valivého elementu Bd [mm] *</Label>
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
        <div>
          <Label>Poznámky</Label>
          <Input placeholder="Volitelný popis..." value={form.notes} onChange={e => set("notes", e.target.value)} />
        </div>
      </div>

      {preview && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs">
          <p className="font-semibold text-blue-700 mb-1.5">Defektní frekvence při 1800 RPM (náhled):</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 font-mono text-blue-800">
            <span>BPFO (vnější dráha): <strong>{preview.bpfo} Hz</strong></span>
            <span>BPFI (vnitřní dráha): <strong>{preview.bpfi} Hz</strong></span>
            <span>BSF (valivý element): <strong>{preview.bsf} Hz</strong></span>
            <span>FTF (klec): <strong>{preview.ftf} Hz</strong></span>
          </div>
        </div>
      )}

      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>Zrušit</Button>
        <Button
          disabled={!form.designation || !form.nb || !form.bd || !form.pd}
          onClick={() => onSave({
            ...form,
            nb: Number(form.nb),
            bd: Number(form.bd),
            pd: Number(form.pd),
            contact_angle_deg: Number(form.contact_angle_deg) || 0,
          })}
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