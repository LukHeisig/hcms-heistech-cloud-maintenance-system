import React from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { format } from "date-fns";
import { cs } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bell } from "lucide-react";

const SEV = { D: "bg-red-100 text-red-700", C: "bg-orange-100 text-orange-700", B: "bg-yellow-100 text-yellow-700" };
const toDate = (d) => new Date(/[Zz]$|[+-]\d{2}:\d{2}$/.test(String(d)) ? d : d + "Z");

export default function RecentVibrationAlerts({ alerts }) {
  return (
    <Card className="op-recent border-none shadow-lg">
      <CardHeader className="border-b border-slate-100">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Bell className="w-5 h-5 text-slate-600" /> Poslední alarmy
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        {alerts.length === 0 ? (
          <p className="text-center text-slate-500 py-8 text-sm">Žádné alarmy</p>
        ) : (
          <div className="space-y-2">
            {alerts.map(a => (
              <Link key={a.id} to={createPageUrl(`Machine?id=${a.machine_id}#alerts`)}
                className="op-alert">
                <div className="flex items-center gap-2">
                  <span className={`sev-${a.severity || "B"} text-xs font-bold px-1.5 py-0.5 rounded ${SEV[a.severity] || SEV.B}`}>{a.severity}</span>
                  <span className="text-sm font-medium text-slate-900 truncate flex-1">{a.machine_name} · {a.measurement_point}</span>
                </div>
                <p className="text-xs text-slate-600 mt-1">
                  {a.metric_label}: <span className="font-mono font-semibold">{a.value?.toFixed(2)} {a.metric_unit}</span>
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {a.created_date && format(toDate(a.created_date), "d. M. yyyy HH:mm", { locale: cs })}
                  {a.status === "acknowledged" ? ` · kvitoval ${a.acknowledged_by || "neznámý"}` : " · aktivní"}
                </p>
              </Link>
            ))}
          </div>
        )}
        <Link to={createPageUrl("VibrationOnline?tab=alerts")} className="block text-center text-sm text-blue-700 hover:text-blue-800 font-medium mt-4">
          Všechny alarmy →
        </Link>
      </CardContent>
    </Card>
  );
}