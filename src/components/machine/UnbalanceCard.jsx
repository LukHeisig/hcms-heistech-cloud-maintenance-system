import React from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Scale, Loader2 } from "lucide-react";

const color = (p) => (p >= 100 ? "bg-red-500" : p >= 70 ? "bg-yellow-500" : "bg-green-500");

export default function UnbalanceCard({ machine, rowLabels = [] }) {
  const { data, isLoading } = useQuery({
    queryKey: ["unbalance", machine.id],
    queryFn: async () => (await base44.functions.invoke("getUnbalance", { machineId: machine.id })).data,
    refetchInterval: 5 * 60 * 1000,
  });

  return (
    <Card className="border-none shadow-lg">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          <Scale className="w-4 h-4 text-blue-600" /> Míra nevývahy
          {data?.threshold && <span className="text-xs font-normal text-slate-500">práh {data.threshold} mm/s = 100 %</span>}
        </div>
        {isLoading && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
        {!isLoading && !data?.items?.length && <p className="text-xs text-slate-500">Žádná FFT data z přiřazených snímačů.</p>}
        {data?.items?.map((it) => (
          <div key={it.sensor_id + it.schema_row_index} className="space-y-1">
            <div className="flex justify-between text-xs text-slate-600 gap-2">
              <span className="truncate">{rowLabels[it.schema_row_index] || `Bod ${it.schema_row_index + 1}`}</span>
              {it.has_data ? (
                <span>{it.running ? `${it.amp} mm/s @ ${it.freq} Hz (${it.rpm} ot/min, osa ${it.axis})` : "Stroj stojí"}</span>
              ) : <span>bez dat</span>}
            </div>
            {it.has_data && it.running && (
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 rounded bg-slate-100 overflow-hidden">
                  <div className={`h-full ${color(it.percent)}`} style={{ width: `${Math.min(100, it.percent)}%` }} />
                </div>
                <span className="text-xs font-semibold w-12 text-right">{it.percent} %</span>
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}