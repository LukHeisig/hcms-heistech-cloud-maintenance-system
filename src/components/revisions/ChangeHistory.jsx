import React from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { format } from "date-fns";
import { History, Loader2 } from "lucide-react";
import { TRACKED_FIELD_LABELS } from "./revisionLog";

const ACTIONS = { created: "Vytvořeno", deleted: "Smazáno", attachment: "Příloha" };

export default function ChangeHistory({ recordId, formatValue = (f, v) => v }) {
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["revisionLog", recordId],
    queryFn: () => base44.entities.RevisionChangeLog.filter({ record_id: recordId }, "-created_date", 200),
    enabled: !!recordId,
  });

  return (
    <div>
      <h3 className="font-semibold text-sm flex items-center gap-2 mb-2"><History className="w-4 h-4" /> Historie změn</h3>
      {isLoading ? <Loader2 className="w-4 h-4 animate-spin text-slate-400" /> : logs.length === 0 ? (
        <p className="text-xs text-slate-500">Bez záznamů.</p>
      ) : (
        <div className="space-y-1 max-h-56 overflow-y-auto">
          {logs.map((l) => (
            <div key={l.id} className="text-xs border-l-2 border-slate-300 pl-2 py-1">
              <span className="text-slate-500">{format(new Date(l.created_date), "d. M. yyyy HH:mm")} · {l.changed_by_name || l.changed_by}</span>
              <p className="text-slate-800">
                {l.field ? (
                  <><b>{TRACKED_FIELD_LABELS[l.field] || l.field}:</b> {formatValue(l.field, l.old_value) || "—"} → {formatValue(l.field, l.new_value) || "—"}</>
                ) : (
                  <><b>{ACTIONS[l.action] || l.action}:</b> {l.new_value}</>
                )}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}