import React from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function VseVariableSelect({ options, value, onChange }) {
  return (
    <Select
      value={value || "none"}
      onValueChange={(val) => onChange(val === "none" ? null : options.find(o => o.value === val) || null)}
    >
      <SelectTrigger className="h-8 text-xs w-[240px]">
        <SelectValue placeholder="Přiřadit proměnnou" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">-- Nepřiřazeno --</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}