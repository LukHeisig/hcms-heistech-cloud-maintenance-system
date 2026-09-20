import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { COUNTER_BANDS } from "@/components/vibration/vseTemplates";

export default function VseSpindleEnergyPanel({ definition, mapping = {}, values = {} }) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-bold text-slate-900">Energie vibrací vřetene · countery ve třech osách</h3>
        <p className="text-sm text-slate-500">Kolik času vřeteno běží v jednotlivých pásmech — počítá se jen za chodu.</p>
      </div>
      <div className="grid md:grid-cols-3 gap-4">
        {definition.axes.map((axis) => (
          <Card key={axis.key}>
            <CardContent className="p-4">
              <p className="font-semibold text-slate-800 mb-3">{axis.label}</p>
              <div className="space-y-2">
                {axis.counters.map((c, ci) => {
                  const slot = `${axis.key}.${c.key}`;
                  const assigned = mapping[slot];
                  return (
                    <div key={c.key} className="border rounded-md px-3 py-2 bg-slate-50">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: COUNTER_BANDS[ci]?.color }} />
                          <span className="text-slate-700">{c.label}</span>
                        </div>
                        {assigned ? (
                          <span className="font-mono text-sm text-slate-900">
                            {values[`${assigned.unit_id}|${assigned.node_id}`] ?? "—"}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400 italic">nenamapováno</span>
                        )}
                      </div>
                      {assigned && (
                        <p className="text-xs text-slate-500 truncate mt-1" title={assigned.node_id}>
                          {assigned.unit_label || assigned.unit_id}{assigned.sensor ? ` · ${assigned.sensor}` : ""} · {assigned.name}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}