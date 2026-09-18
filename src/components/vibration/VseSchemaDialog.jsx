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
import { Plus, LayoutDashboard } from "lucide-react";
import VseElementRow from "@/components/vibration/VseElementRow";

const emptyElement = () => ({ type: "value", label: "", metric: "", unit: "" });

export default function VseSchemaDialog({ open, onOpenChange, schema, onSave, isSaving }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [elements, setElements] = useState([]);

  useEffect(() => {
    if (!open) return;
    setName(schema?.name || "");
    setDescription(schema?.description || "");
    let parsed = [];
    try {
      const raw = JSON.parse(schema?.rows_definition || "[]");
      parsed = Array.isArray(raw) ? raw.filter((e) => e && e.type) : [];
    } catch (e) {
      parsed = [];
    }
    setElements(parsed);
  }, [open, schema]);

  const updateElement = (index, next) => {
    const copy = [...elements];
    copy[index] = next;
    setElements(copy);
  };

  const removeElement = (index) => setElements(elements.filter((_, i) => i !== index));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LayoutDashboard className="w-5 h-5 text-teal-600" />
            {schema ? "Upravit vizualizaci VSE" : "Nová vizualizace VSE"}
          </DialogTitle>
          <DialogDescription>
            Vizualizace se skládá z prvků (objektů), na které se mapují hodnoty z VSE jednotek.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Název vizualizace *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="např. CNC Edwards" />
            </div>
            <div>
              <Label>Popis</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={1} />
            </div>
          </div>

          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold text-slate-800">Prvky vizualizace ({elements.length})</h4>
              <Button variant="outline" size="sm" onClick={() => setElements([...elements, emptyElement()])}>
                <Plus className="w-4 h-4 mr-2" /> Přidat prvek
              </Button>
            </div>

            {elements.length === 0 ? (
              <div className="border border-dashed rounded-lg p-8 text-center text-sm text-slate-500">
                Zatím žádné prvky. Začněte přidáním prvního prvku.
              </div>
            ) : (
              <div className="space-y-3 bg-slate-50 p-3 rounded-lg">
                {elements.map((el, idx) => (
                  <VseElementRow
                    key={idx}
                    element={el}
                    index={idx}
                    onChange={updateElement}
                    onRemove={removeElement}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Zrušit</Button>
          <Button
            disabled={!name.trim() || isSaving}
            onClick={() => onSave({ name: name.trim(), description, elements })}
          >
            Uložit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}