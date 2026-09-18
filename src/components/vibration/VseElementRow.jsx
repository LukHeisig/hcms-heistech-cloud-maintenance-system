import React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, ArrowUp, ArrowDown } from "lucide-react";

export const VSE_ELEMENT_TYPES = [
  { value: "value", label: "Číselná hodnota" },
  { value: "gauge", label: "Ukazatel (gauge)" },
  { value: "status", label: "Stavová kontrolka" },
  { value: "trend", label: "Trendový graf" },
  { value: "label", label: "Textový popisek" },
];

export const VSE_ELEMENT_WIDTHS = [
  { value: "1", label: "1/4 šířky" },
  { value: "2", label: "1/2 šířky" },
  { value: "3", label: "3/4 šířky" },
  { value: "4", label: "Celá šířka" },
];

export default function VseElementRow({ element, index, total, onChange, onRemove, onMove }) {
  const set = (field, value) => onChange(index, { ...element, [field]: value });
  const showRange = element.type === "gauge";
  const showUnit = element.type !== "label" && element.type !== "status";

  return (
    <div className="border rounded-lg p-3 bg-white space-y-3">
      <div className="flex items-center gap-2">
        <div className="flex flex-col">
          <Button variant="ghost" size="icon" className="h-4 w-6" disabled={index === 0} onClick={() => onMove(index, -1)}>
            <ArrowUp className="w-3 h-3" />
          </Button>
          <Button variant="ghost" size="icon" className="h-4 w-6" disabled={index === total - 1} onClick={() => onMove(index, 1)}>
            <ArrowDown className="w-3 h-3" />
          </Button>
        </div>
        <span className="text-xs font-semibold text-slate-400 w-6">#{index + 1}</span>
        <Select value={element.type} onValueChange={(v) => set("type", v)}>
          <SelectTrigger className="h-8 w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {VSE_ELEMENT_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          value={element.label || ""}
          onChange={(e) => set("label", e.target.value)}
          placeholder="Popis prvku (např. Vřeteno – vibrace)"
          className="h-8 flex-1"
        />
        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600" onClick={() => onRemove(index)}>
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>

      <div className="grid grid-cols-4 gap-3 pl-14">
        <div>
          <Label className="text-xs">Šířka v mřížce</Label>
          <Select value={String(element.width || "1")} onValueChange={(v) => set("width", v)}>
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {VSE_ELEMENT_WIDTHS.map((w) => (
                <SelectItem key={w.value} value={w.value}>{w.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {showUnit && (
          <div>
            <Label className="text-xs">Jednotka</Label>
            <Input
              value={element.unit || ""}
              onChange={(e) => set("unit", e.target.value)}
              placeholder="mm/s"
              className="h-8"
            />
          </div>
        )}
        {showRange && (
          <div className="grid grid-cols-2 gap-2 col-span-2">
            <div>
              <Label className="text-xs">Min</Label>
              <Input type="number" value={element.min ?? ""} onChange={(e) => set("min", e.target.value)} className="h-8" />
            </div>
            <div>
              <Label className="text-xs">Max</Label>
              <Input type="number" value={element.max ?? ""} onChange={(e) => set("max", e.target.value)} className="h-8" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}