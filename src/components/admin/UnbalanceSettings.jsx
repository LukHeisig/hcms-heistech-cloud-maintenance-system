import React from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

export default function UnbalanceSettings({ formData, setFormData }) {
  const set = (k, v) => setFormData({ ...formData, [k]: v });
  return (
    <div className="space-y-3 border-t border-slate-200 pt-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <Label>Sledovat míru nevývahy</Label>
          <p className="text-xs text-slate-500">Amplituda na otáčkové frekvenci (1×) z FFT rychlosti, otáčky se detekují automaticky.</p>
        </div>
        <Switch checked={!!formData.unbalance_enabled} onCheckedChange={(v) => set("unbalance_enabled", v)} />
      </div>
      {formData.unbalance_enabled && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <Label htmlFor="unbalance_threshold_mm_s">Prahová hodnota 1× (mm/s)</Label>
            <Input id="unbalance_threshold_mm_s" type="number" min={0} step="0.1" value={formData.unbalance_threshold_mm_s ?? 2.8} onChange={(e) => set("unbalance_threshold_mm_s", e.target.value)} />
          </div>
          <p className="md:col-span-2 text-xs text-slate-500 self-end">Práh = 100 %. Alarm „Upozornění“ při 100 %, „Výstraha“ při 150 %. Platí zpoždění alarmu stroje a měří se jen za chodu (práh chodu z motohodin).</p>
        </div>
      )}
    </div>
  );
}