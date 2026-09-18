import React from "react";
import { Gauge, Hash, Circle, TrendingUp, Type } from "lucide-react";

const WIDTH_CLASS = {
  "1": "col-span-1",
  "2": "col-span-2",
  "3": "col-span-3",
  "4": "col-span-4",
};

const ICONS = {
  value: Hash,
  gauge: Gauge,
  status: Circle,
  trend: TrendingUp,
  label: Type,
};

export default function VseLayoutPreview({ elements }) {
  return (
    <div className="mt-4">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
        Náhled rozložení
      </p>
      <div className="grid grid-cols-4 gap-2 p-3 bg-slate-900 rounded-lg">
        {elements.map((el, idx) => {
          const Icon = ICONS[el.type] || Hash;
          return (
            <div
              key={el.key || idx}
              className={`${WIDTH_CLASS[String(el.width || "1")]} rounded-md bg-slate-800 border border-slate-700 p-3 min-h-[70px] flex flex-col justify-between`}
            >
              <div className="flex items-center gap-2 text-slate-300">
                <Icon className="w-3.5 h-3.5 text-teal-400" />
                <span className="text-xs truncate">{el.label || `Prvek ${idx + 1}`}</span>
              </div>
              <div className="text-slate-500 text-xs font-mono">
                -- {el.unit || ""}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}