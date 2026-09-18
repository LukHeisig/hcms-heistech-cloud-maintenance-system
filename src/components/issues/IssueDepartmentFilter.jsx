import React from "react";
import { Label } from "@/components/ui/label";
import { Filter } from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export default function IssueDepartmentFilter({ value, onChange }) {
  return (
    <div className="flex items-end gap-3 mb-4 p-3 bg-slate-50 rounded-lg border border-slate-200">
      <Filter className="w-4 h-4 text-slate-500 mb-2.5 flex-shrink-0" />
      <div>
        <Label className="text-xs font-medium text-slate-600 mb-1 block">
          Zařazení v údržbě (nahlásil)
        </Label>
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger className="w-64 bg-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Všechna zařazení</SelectItem>
            <SelectItem value="electro">Elektro údržba</SelectItem>
            <SelectItem value="mechanical">Mechanická údržba</SelectItem>
            <SelectItem value="none">Neurčeno</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}