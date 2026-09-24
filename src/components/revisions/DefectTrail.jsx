import React from "react";
import { fmtDate, userName } from "./revisionConstants";

// Průkazný řetězec: zjištěno → přiděleno → termín → provedeno → odstraněno → potvrzeno → kontrola
export default function DefectTrail({ defect, users }) {
  const steps = [
    ["Zjištěno", fmtDate(defect.found_date)],
    ["Přiděleno", defect.assigned_to ? userName(users, defect.assigned_to) : defect.responsible || "—"],
    ["Termín", fmtDate(defect.due_date)],
    ["Provedeno", defect.removal_method || "—"],
    ["Odstraněno", fmtDate(defect.removed_date)],
    ["Potvrdil", defect.closed_by ? `${userName(users, defect.closed_by)} (${fmtDate(defect.closed_date)})` : "—"],
    ["Kontrola", defect.verified_by || "—"],
  ];
  return (
    <div className="grid grid-cols-2 md:grid-cols-7 gap-1 text-xs">
      {steps.map(([label, val]) => (
        <div key={label} className={`rounded p-2 border ${val === "—" ? "bg-slate-50 text-slate-400" : "bg-blue-50 border-blue-200"}`}>
          <p className="font-semibold text-slate-600">{label}</p>
          <p className="text-slate-900 break-words line-clamp-3">{val}</p>
        </div>
      ))}
    </div>
  );
}