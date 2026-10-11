import React from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { formatDistanceToNow } from "date-fns";
import { cs } from "date-fns/locale";
import { Bell } from "lucide-react";
import MachineDiagnosticStatus from "@/components/dashboard/MachineDiagnosticStatus";

const DOT = { D: "bg-red-500", C: "bg-orange-500", B: "bg-green-500", A: "bg-green-500" };

export default function VibrationLineMachines({ machines, byMachine, loading }) {
  const navigate = useNavigate();
  const rows = machines;
  if (rows.length === 0) return null;
  return (
    <div className="mt-3 divide-y divide-slate-100 border-t border-slate-100">
      {rows.map(m => {
        const s = byMachine[m.id] || {};
        return (
          <div key={m.id}
            onClick={(e) => { e.stopPropagation(); navigate(createPageUrl(`Machine?id=${m.id}#vibration`)); }}
            className="py-2 px-1 text-sm hover:bg-slate-50 rounded cursor-pointer">
            <div className="flex flex-wrap items-center gap-3">
             <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${DOT[s.zone] || "bg-slate-300"}`} title={s.zone ? `Aktuální pásmo ${s.zone}` : "Bez vyhodnocení"} />
            <span className="font-medium text-slate-800 flex-1 truncate">{m.name}</span>
            {s.alerts > 0 && (
              <span title="Zobrazit alarmy"
                onClick={(e) => { e.stopPropagation(); navigate(createPageUrl(`Machine?id=${m.id}#alerts`)); }}
                className="flex items-center gap-1 text-xs text-red-600 font-semibold px-1.5 py-0.5 rounded hover:bg-red-50">
                <Bell className="w-3.5 h-3.5" />{s.alerts}
              </span>
            )}
            <span className="font-mono text-slate-700 w-24 text-right">{s.vel != null ? `${s.vel.toFixed(2)} mm/s` : "—"}</span>
            <span className="text-xs text-slate-400 w-28 text-right">
              {s.lastSeen ? formatDistanceToNow(new Date(s.lastSeen), { addSuffix: true, locale: cs }) : "bez dat"}
            </span>
            </div>
            <MachineDiagnosticStatus status={s} loading={loading} />
            </div>
            );
      })}
    </div>
  );
}