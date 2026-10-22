import React, { useMemo, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import DefectsTable from "./DefectsTable";
import { VTZ_TYPES } from "./revisionConstants";

// Archiv závad s filtrem podle roku revize a typu VTZ
export default function DefectArchive({ defects, reports, users, onOpen }) {
  const [year, setYear] = useState("all");
  const [vtz, setVtz] = useState("all");
  const reportOf = (d) => reports.find((r) => r.id === d.report_id);
  const yearOf = (d) => (reportOf(d)?.revision_date_to || "").slice(0, 4);

  const years = useMemo(() => [...new Set(defects.map(yearOf).filter(Boolean))].sort().reverse(), [defects, reports]);
  const filtered = defects.filter((d) =>
    (year === "all" || yearOf(d) === year) && (vtz === "all" || reportOf(d)?.vtz_type === vtz));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        <Select value={year} onValueChange={setYear}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Všechny roky</SelectItem>
            {years.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={vtz} onValueChange={setVtz}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Všechny typy VTZ</SelectItem>
            {Object.entries(VTZ_TYPES).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <DefectsTable defects={filtered} reports={reports} users={users} onOpen={onOpen} />
    </div>
  );
}