import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LayoutDashboard } from "lucide-react";
import { VSE_TEMPLATES, parseVseDefinition } from "@/components/vibration/vseTemplates";
import VseSpindleEnergyEditor from "@/components/vibration/VseSpindleEnergyEditor";
import VseSpindleEnergyPreview from "@/components/vibration/VseSpindleEnergyPreview";

export default function VseSchemaDialog({ open, onOpenChange, schema, onSave, isSaving }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [definition, setDefinition] = useState(null);

  useEffect(() => {
    if (!open) return;
    setName(schema?.name || "");
    setDescription(schema?.description || "");
    setDefinition(parseVseDefinition(schema?.rows_definition) || VSE_TEMPLATES.spindle_energy.buildDefault());
  }, [open, schema]);

  const template = definition ? VSE_TEMPLATES[definition.template] : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LayoutDashboard className="w-5 h-5 text-teal-600" />
            {schema ? "Upravit šablonu vizualizace" : "Nová šablona vizualizace"}
          </DialogTitle>
          <DialogDescription>
            Vyberte typ šablony s pevně danou strukturou. Konkrétní countery z VSE jednotky se
            k jednotlivým slotům mapují až na kartě stroje.
          </DialogDescription>
        </DialogHeader>

        {definition && (
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Název šablony *</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="např. Vřeteno CNC frézky" />
              </div>
              <div>
                <Label>Popis</Label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={1} />
              </div>
            </div>

            <div>
              <Label>Typ šablony</Label>
              <Select
                value={definition.template}
                onValueChange={(v) => setDefinition(VSE_TEMPLATES[v].buildDefault())}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.values(VSE_TEMPLATES).map((t) => (
                    <SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500 mt-1">{template?.description}</p>
            </div>

            <div className="border-t pt-4">
              <h4 className="font-semibold text-slate-800 mb-3">Struktura šablony</h4>
              {definition.template === "spindle_energy" && (
                <>
                  <VseSpindleEnergyEditor definition={definition} onChange={setDefinition} />
                  <VseSpindleEnergyPreview definition={definition} />
                </>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Zrušit</Button>
          <Button
            disabled={!name.trim() || !definition || isSaving}
            onClick={() => onSave({ name: name.trim(), description, definition })}
          >
            Uložit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}