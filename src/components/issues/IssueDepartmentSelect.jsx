import React from "react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const ISSUE_DEPARTMENT_LABELS = {
  electro: "Elektro",
  mechanical: "Mechanická",
};

export default function IssueDepartmentSelect({ value, onChange, required = true }) {
  return (
    <div>
      <Label>Zařazení v údržbě{required ? " *" : ""}</Label>
      <Select value={value || ""} onValueChange={onChange}>
        <SelectTrigger className="mt-2">
          <SelectValue placeholder="Vyberte zařazení" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="mechanical">Mechanická</SelectItem>
          <SelectItem value="electro">Elektro</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}