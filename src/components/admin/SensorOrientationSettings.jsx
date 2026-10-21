import React from "react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GLOBAL_ORIENTATION_OPTIONS, normalizeOrientation } from "@/lib/sensorOrientation";

export default function SensorOrientationSettings({ formData, setFormData }) {
  const set = (k, v) => setFormData({ ...formData, [k]: v });
  const mode = formData.sensor_orientation_mode || "same";
  return (
    <div className="space-y-3 border-t border-slate-200 pt-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <Label>Orientace snímačů</Label>
          <Select value={mode} onValueChange={(v) => set("sensor_orientation_mode", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="same">Všechny stejně</SelectItem>
              <SelectItem value="per_point">Každý jinak (nastavení u měřicího místa)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {mode === "same" && (
          <div>
            <Label>Směr os (pro celý stroj)</Label>
            <Select value={normalizeOrientation(formData.sensor_orientation)} onValueChange={(v) => set("sensor_orientation", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {GLOBAL_ORIENTATION_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
    </div>
  );
}