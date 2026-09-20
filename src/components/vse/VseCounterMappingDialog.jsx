import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { COUNTER_BANDS } from "@/components/vibration/vseTemplates";

function parseJson(raw, fallback) {
  try { return JSON.parse(raw || "null") ?? fallback; } catch { return fallback; }
}

export default function VseCounterMappingDialog({ open, onOpenChange, definition, units, mapping, onSave, isSaving }) {
  const [unitId, setUnitId] = useState(null);
  const [draft, setDraft] = useState({});

  useEffect(() => {
    if (open) {
      setDraft(mapping || {});
      const firstAssigned = Object.values(mapping || {})[0];
      setUnitId(firstAssigned?.unit_id || units[0]?.unit_id || null);
    }
  }, [open]);

  const unit = units.find(u => u.unit_id === unitId);
  const unitLabel = unit?.name || unit?.unit_id;
  const variables = unit ? parseJson(unit.last_values_json, []) : [];

  const setSlot = (slot, nodeId) => {
    const next = { ...draft };
    if (!nodeId) delete next[slot];
    else {
      const v = variables.find(x => x.node_id === nodeId);
      next[slot] = { unit_id: unit.unit_id, unit_label: unitLabel, node_id: v.node_id, name: v.name };
    }
    setDraft(next);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Přiřazení proměnných VSE</DialogTitle>
          <DialogDescription>Vyberte VSE jednotku a poté přiřaďte jednotlivé countery k proměnným.</DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div>
            <Label>VSE jednotka</Label>
            <Select value={unitId || ""} onValueChange={setUnitId}>
              <SelectTrigger><SelectValue placeholder="Vyberte jednotku" /></SelectTrigger>
              <SelectContent>
                {units.map(u => (
                  <SelectItem key={u.unit_id} value={u.unit_id}>{u.name || u.unit_id}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {units.length === 0 && (
              <p className="text-xs text-amber-700 mt-1">Žádné VSE jednotky nejsou k dispozici.</p>
            )}
          </div>

          {unit && variables.length === 0 && (
            <p className="text-sm text-slate-500">Jednotka dosud neposlala žádné proměnné.</p>
          )}

          {unit && variables.length > 0 && definition.axes.map((axis) => (
            <div key={axis.key} className="border rounded-lg p-3">
              <p className="font-semibold text-slate-800 mb-2">{axis.label}</p>
              <div className="space-y-2">
                {axis.counters.map((c, ci) => {
                  const slot = `${axis.key}.${c.key}`;
                  const assigned = draft[slot];
                  const selectValue = assigned?.unit_id === unitId ? assigned.node_id : "none";
                  return (
                    <div key={c.key} className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: COUNTER_BANDS[ci]?.color }} />
                        <span className="text-slate-700">{c.label}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {assigned && assigned.unit_id !== unitId && (
                          <span className="text-xs text-slate-400">{assigned.unit_label} – {assigned.name}</span>
                        )}
                        <Select value={selectValue} onValueChange={(v) => setSlot(slot, v === "none" ? null : v)}>
                          <SelectTrigger className="h-8 w-[260px] text-xs"><SelectValue placeholder="Proměnná" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">-- Nepřiřazeno --</SelectItem>
                            {variables.map(v => (
                              <SelectItem key={v.node_id} value={v.node_id}>{unitLabel} – {v.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Zrušit</Button>
          <Button onClick={() => onSave(draft)} disabled={isSaving}>Uložit přiřazení</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}