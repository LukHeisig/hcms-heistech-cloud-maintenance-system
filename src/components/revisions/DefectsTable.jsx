import React, { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search } from "lucide-react";
import DefectStatusBadge, { ClassificationBadge } from "./DefectStatusBadge";
import { STATUSES, VTZ_TYPES, OPEN_STATUSES, isDefectOverdue, fmtDate, userName } from "./revisionConstants";

const STATUS_FILTERS = {
  all: "Všechny stavy",
  open: "K řešení (otevřené)",
  overdue: "Po termínu",
  ...Object.fromEntries(Object.entries(STATUSES).map(([k, v]) => [k, v.label])),
};

export default function DefectsTable({ defects, reports, users, onOpen, initialStatus = "all" }) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState(initialStatus);
  const [cls, setCls] = useState("all");
  const [vtz, setVtz] = useState("all");
  const reportMap = useMemo(() => Object.fromEntries(reports.map((r) => [r.id, r])), [reports]);

  const rows = useMemo(() => {
    const s = q.toLowerCase();
    return defects
      .filter((d) => {
        if (status === "open" && !OPEN_STATUSES.includes(d.status || "new")) return false;
        if (status === "overdue" && !isDefectOverdue(d)) return false;
        if (!["all", "open", "overdue"].includes(status) && (d.status || "new") !== status) return false;
        if (cls !== "all" && d.classification !== cls) return false;
        if (vtz !== "all" && d.vtz_type !== vtz) return false;
        if (s) {
          const r = reportMap[d.report_id];
          const hay = [d.defect_number, d.description, d.location, d.responsible, r?.subject, r?.report_number].join(" ").toLowerCase();
          if (!hay.includes(s)) return false;
        }
        return true;
      })
      .sort((a, b) => (isDefectOverdue(b) - isDefectOverdue(a)) || (a.due_date || "9").localeCompare(b.due_date || "9"));
  }, [defects, q, status, cls, vtz, reportMap]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input className="pl-9" placeholder="Hledat..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{Object.entries(STATUS_FILTERS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={cls} onValueChange={setCls}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Všechny klasifikace</SelectItem>
            {["C1", "C2", "C3"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={vtz} onValueChange={setVtz}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Všechny typy VTZ</SelectItem>
            {Object.entries(VTZ_TYPES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-x-auto border rounded-lg bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600 text-xs uppercase">
            <tr>
              <th className="p-3 text-left">Číslo</th>
              <th className="p-3 text-left">Kl.</th>
              <th className="p-3 text-left">Závada</th>
              <th className="p-3 text-left">Přiděleno</th>
              <th className="p-3 text-left">Termín</th>
              <th className="p-3 text-left">Stav</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={6} className="p-6 text-center text-slate-500">Žádné závady</td></tr>
            )}
            {rows.map((d) => {
              const r = reportMap[d.report_id];
              const overdue = isDefectOverdue(d);
              return (
                <tr key={d.id} onClick={() => onOpen(d)}
                  className={`border-t cursor-pointer hover:bg-slate-50 ${overdue ? "bg-red-50/60" : ""}`}>
                  <td className="p-3 whitespace-nowrap font-mono text-xs">{d.defect_number}</td>
                  <td className="p-3"><ClassificationBadge value={d.classification} /></td>
                  <td className="p-3 min-w-[260px]">
                    <p className="text-slate-900 line-clamp-2">{d.description}</p>
                    <p className="text-xs text-slate-500">{r?.subject}{d.location ? ` · ${d.location}` : ""}</p>
                  </td>
                  <td className="p-3 text-xs">
                    <p>{d.assigned_to ? userName(users, d.assigned_to) : "—"}</p>
                    {d.responsible && <p className="text-slate-500">{d.responsible}</p>}
                  </td>
                  <td className={`p-3 whitespace-nowrap ${overdue ? "text-red-700 font-semibold" : ""}`}>{fmtDate(d.due_date)}</td>
                  <td className="p-3"><DefectStatusBadge defect={d} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}