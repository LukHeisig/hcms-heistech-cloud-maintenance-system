import React, { useState } from "react";
import UnbalanceTrendDialog from "@/components/machine/UnbalanceTrendDialog";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Scale, Loader2 } from "lucide-react";

const tone = (p, trendHit) =>
  p >= 150 ? "bg-red-100 border-red-500 text-red-900"
  : p >= 100 ? "bg-red-50 border-red-300 text-red-800"
  : p >= 90 || trendHit ? "bg-yellow-50 border-yellow-300 text-yellow-800"
  : "bg-green-50 border-green-300 text-green-800";

export default function UnbalanceCard({ machine, rowLabels = [] }) {
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ["unbalance", machine.id],
    queryFn: async () => (await base44.functions.invoke("getUnbalance", { machineId: machine.id })).data,
    refetchInterval: 5 * 60 * 1000,
  });

  const trendDays = machine.unbalance_trend_alarm_days ?? 3;
  const items = (data?.items || []).filter((i) => i.has_data);
  const running = items.filter((i) => i.running);
  const val = (i) => i.median ?? i.percent;
  const top = running.length ? running.reduce((a, b) => (val(b) > val(a) ? b : a)) : items[0];
  const label = top ? (rowLabels[top.schema_row_index] || `Bod ${top.schema_row_index + 1}`) : "";
  const trendHit = trendDays > 0 && top?.days_left != null && top.days_left <= trendDays;
  const cls = top?.running ? tone(val(top), trendHit) : "bg-slate-50 border-slate-200 text-slate-500";

  return (
    <>
      <button type="button" disabled={!top} onClick={() => setOpen(true)}
        className={`w-44 flex-shrink-0 rounded-lg border px-3 py-2 text-left transition hover:shadow-md disabled:cursor-default ${cls}`}
        title="Vážený medián posledních 6 měření za chodu – trend a predikce čištění">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold">
          <Scale className="w-3.5 h-3.5" /> Míra nevývahy
        </div>
        {isLoading ? <Loader2 className="w-4 h-4 animate-spin mt-2" /> : !top ? (
          <p className="text-[11px] mt-1">Bez FFT dat</p>
        ) : top.running ? (
          <>
            <div className="text-2xl font-bold leading-tight">{val(top)} %</div>
            <div className="text-[10px] opacity-80">vážený medián posl. {top.median_count || 6} měření</div>
            <div className="text-[11px] opacity-80">poslední: {top.percent} % · {label}</div>
            <div className="text-[11px] opacity-80">{top.amp} mm/s · {top.rpm} ot/min · osa {top.axis}</div>
            {trendHit && <div className="text-[11px] font-semibold">↗ práh za {top.days_left} dní</div>}
          </>
        ) : <p className="text-xs font-semibold mt-1">Stroj stojí</p>}
      </button>
      <UnbalanceTrendDialog open={open} onOpenChange={setOpen} machine={machine}
        sensorId={top?.sensor_id} label={label} />
    </>
  );
}