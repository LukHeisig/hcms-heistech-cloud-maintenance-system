import React from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

export default function RpmRangeSettings({ formData, setFormData }) {
  const set = (k, v) => setFormData({ ...formData, [k]: v });
  return (
    <div className="space-y-3 border-t border-slate-200 pt-4">
      <div>
        <Label>Rozsah otáček stroje</Label>
        <p className="text-xs text-slate-500">Zúží pásmo, ve kterém se ve spektru hledá otáčková frekvence (1×), aby se nevybrala vyšší harmonická. Prázdné = výchozí 360–4 800 ot/min (6–80 Hz).</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <Label htmlFor="rpm_min">Min. otáčky (ot/min)</Label>
          <Input id="rpm_min" type="number" min={0} step="1" placeholder="360" value={formData.rpm_min ?? ""} onChange={(e) => set("rpm_min", e.target.value)} />
        </div>
        <div>
          <Label htmlFor="rpm_max">Max. otáčky (ot/min)</Label>
          <Input id="rpm_max" type="number" min={0} step="1" placeholder="4800" value={formData.rpm_max ?? ""} onChange={(e) => set("rpm_max", e.target.value)} />
        </div>
        <p className="text-xs text-slate-500 self-end">Použije se ve spektrech, v AI analýze i pro míru nevývahy. Např. motor 1 480 ot/min: 1 400–1 550.</p>
      </div>
    </div>
  );
}