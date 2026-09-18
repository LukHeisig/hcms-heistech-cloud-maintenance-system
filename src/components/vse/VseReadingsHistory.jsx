import React, { useState } from "react";
import { format } from "date-fns";
import { ChevronDown, ChevronRight } from "lucide-react";
import VseValuesTable from "@/components/vse/VseValuesTable";

export default function VseReadingsHistory({ readings, isLoading }) {
  const [openId, setOpenId] = useState(null);

  if (isLoading) return <p className="text-sm text-slate-500 py-4 text-center">Načítám historii…</p>;
  if (readings.length === 0) return <p className="text-sm text-slate-500 py-4 text-center">Zatím žádné záznamy</p>;

  return (
    <div className="divide-y">
      {readings.map((r) => {
        const open = openId === r.id;
        return (
          <div key={r.id}>
            <button
              className="w-full flex items-center justify-between py-2 px-1 text-sm hover:bg-slate-50"
              onClick={() => setOpenId(open ? null : r.id)}
            >
              <span className="flex items-center gap-2">
                {open ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                <span className="font-mono">{format(new Date(r.recorded_at), "d. M. yyyy HH:mm:ss")}</span>
              </span>
              <span className="text-xs text-slate-500">{r.values_count} hodnot</span>
            </button>
            {open && <div className="pb-3 pl-6"><VseValuesTable valuesJson={r.values_json} /></div>}
          </div>
        );
      })}
    </div>
  );
}