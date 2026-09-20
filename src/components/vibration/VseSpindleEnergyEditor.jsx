import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { COUNTER_BANDS } from "@/components/vibration/vseTemplates";

export default function VseSpindleEnergyEditor({ definition, onChange }) {
  const updateAxis = (ai, patch) => {
    const axes = definition.axes.map((a, i) => (i === ai ? { ...a, ...patch } : a));
    onChange({ ...definition, axes });
  };

  const updateCounter = (ai, ci, label) => {
    const counters = definition.axes[ai].counters.map((c, i) => (i === ci ? { ...c, label } : c));
    updateAxis(ai, { counters });
  };

  return (
    <div className="grid md:grid-cols-3 gap-3">
      {definition.axes.map((axis, ai) => (
        <div key={axis.key} className="border rounded-lg p-3 bg-slate-50 space-y-3">
          <div>
            <Label className="text-xs">Název osy {axis.key}</Label>
            <Input value={axis.label} onChange={(e) => updateAxis(ai, { label: e.target.value })} className="h-8" />
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Countery (3 pásma)</p>
            {axis.counters.map((c, ci) => {
              const band = COUNTER_BANDS.find((b) => b.key === c.key);
              return (
                <div key={c.key} className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: band?.color }} />
                  <Input value={c.label} onChange={(e) => updateCounter(ai, ci, e.target.value)} className="h-8 text-sm" />
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}