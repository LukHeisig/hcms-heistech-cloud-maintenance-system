import React from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Timer } from "lucide-react";
import { format, subDays } from "date-fns";
import MotohoursDailyChart from "@/components/machine/MotohoursDailyChart";

const fmt = (h) => (h || 0).toLocaleString("cs-CZ", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export default function MotohoursCard({ machine }) {
  const from = format(subDays(new Date(), 29), "yyyy-MM-dd");
  const { data: days = [] } = useQuery({
    queryKey: ["machineRunDays", machine.id],
    queryFn: () => base44.entities.MachineRunDay.filter({ machine_id: machine.id, date: { $gte: from } }, "date", 31),
    staleTime: 300000,
  });
  const today = format(new Date(), "yyyy-MM-dd");
  const week = format(subDays(new Date(), 6), "yyyy-MM-dd");
  const todayH = days.find((d) => d.date === today)?.hours || 0;
  const weekH = days.filter((d) => d.date >= week).reduce((s, d) => s + (d.hours || 0), 0);
  const total = (machine.motohours_initial || 0) + (machine.motohours_accumulated || 0);

  return (
    <Card className="shadow-lg">
      <CardHeader className="border-b border-slate-100">
        <CardTitle className="flex items-center gap-2"><Timer className="w-5 h-5" />Motohodiny</CardTitle>
      </CardHeader>
      <CardContent className="pt-4 space-y-4">
        <div className="flex flex-wrap items-end gap-6">
          <div>
            <p className="text-3xl font-bold text-slate-900">{fmt(total)} h</p>
            <p className="text-xs text-slate-500 flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${machine.motohours_running ? "bg-green-500" : "bg-slate-400"}`} />
              {machine.motohours_running ? "Stroj běží" : "Stroj stojí"} (dle posledního měření)
            </p>
          </div>
          <div><p className="text-lg font-semibold">{fmt(todayH)} h</p><p className="text-xs text-slate-500">dnes</p></div>
          <div><p className="text-lg font-semibold">{fmt(weekH)} h</p><p className="text-xs text-slate-500">posledních 7 dní</p></div>
        </div>
        <MotohoursDailyChart days={days} />
      </CardContent>
    </Card>
  );
}