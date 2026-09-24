import React from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { dueDateFor } from "./revisionConstants";

export default function DefectRowsEditor({ rows, onChange, foundDate }) {
  const update = (i, patch) => onChange(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const remove = (i) => onChange(rows.filter((_, idx) => idx !== i));
  const add = () => onChange([...rows, { location: "", standard_ref: "", description: "", classification: "C2", due_date: dueDateFor(foundDate, "C2") }]);

  return (
    <div className="space-y-3">
      {rows.length === 0 && <p className="text-sm text-slate-500">Zpráva neobsahuje žádné závady.</p>}
      {rows.map((r, i) => (
        <div key={i} className="border rounded-lg p-3 space-y-2 bg-slate-50">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500 w-6">[{i + 1}]</span>
            <Input className="flex-1" placeholder="Místo / část zařízení" value={r.location || ""} onChange={(e) => update(i, { location: e.target.value })} />
            <Select value={r.classification} onValueChange={(v) => update(i, { classification: v, due_date: dueDateFor(foundDate, v) })}>
              <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
              <SelectContent>{["C1", "C2", "C3"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
            <Input type="date" className="w-40" value={r.due_date || ""} onChange={(e) => update(i, { due_date: e.target.value })} title="Termín odstranění" />
            <Button variant="ghost" size="icon" onClick={() => remove(i)}><Trash2 className="w-4 h-4 text-red-600" /></Button>
          </div>
          <Input placeholder="Norma / článek" value={r.standard_ref || ""} onChange={(e) => update(i, { standard_ref: e.target.value })} />
          <Textarea rows={2} placeholder="Popis závady *" value={r.description || ""} onChange={(e) => update(i, { description: e.target.value })} />
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={add} className="gap-2"><Plus className="w-4 h-4" /> Přidat závadu</Button>
    </div>
  );
}