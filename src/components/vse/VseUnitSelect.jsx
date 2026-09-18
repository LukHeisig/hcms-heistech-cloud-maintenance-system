import React from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

function isOnline(unit) {
  return unit.last_seen && Date.now() - new Date(unit.last_seen).getTime() < 15 * 60 * 1000;
}

export default function VseUnitSelect({ units, selectedId, onChange }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-slate-500">Jednotka ({units.length})</Label>
      <Select value={selectedId || ""} onValueChange={onChange}>
        <SelectTrigger className="bg-white">
          <SelectValue placeholder="Vyberte jednotku…" />
        </SelectTrigger>
        <SelectContent>
          {units.map((u) => (
            <SelectItem key={u.id} value={u.id}>
              <span className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${isOnline(u) ? "bg-green-500" : "bg-slate-400"}`} />
                <span>{u.name || u.unit_id}</span>
                <span className="text-xs text-slate-400 font-mono">{u.unit_id}</span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}