import React from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

export default function MotohoursSettings({ formData, setFormData }) {
  const set = (k, v) => setFormData({ ...formData, [k]: v });
  return (
    <div className="space-y-3 border-t border-slate-200 pt-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <Label>Počítat motohodiny z vibrací</Label>
          <p className="text-xs text-slate-500">Stroj se považuje za běžící, když rychlost vibrací překročí práh chodu.</p>
        </div>
        <Switch checked={!!formData.motohours_enabled} onCheckedChange={(v) => set("motohours_enabled", v)} />
      </div>
      {formData.motohours_enabled && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <Label htmlFor="motohours_initial">Počáteční stav (h)</Label>
            <Input id="motohours_initial" type="number" min={0} step="0.1" value={formData.motohours_initial ?? 0} onChange={(e) => set("motohours_initial", e.target.value)} />
          </div>
          <div>
            <Label htmlFor="motohours_from">Počítat od</Label>
            <Input id="motohours_from" type="datetime-local" value={formData.motohours_from || ""} onChange={(e) => set("motohours_from", e.target.value)} />
          </div>
          <div>
            <Label htmlFor="motohours_threshold_mm_s">Práh chodu (mm/s)</Label>
            <Input id="motohours_threshold_mm_s" type="number" min={0} step="0.05" value={formData.motohours_threshold_mm_s ?? 0.3} onChange={(e) => set("motohours_threshold_mm_s", e.target.value)} />
          </div>
          <p className="md:col-span-3 text-xs text-slate-500">Po uložení se motohodiny přepočítají z historie. Dále se aktualizují automaticky každých 15 minut.</p>
        </div>
      )}
    </div>
  );
}