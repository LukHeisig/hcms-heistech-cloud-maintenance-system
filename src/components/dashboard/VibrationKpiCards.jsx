import React from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Radio, Bell, WifiOff, BatteryLow } from "lucide-react";

function Kpi({ title, value, sub, icon: Icon, gradient, to }) {
  const card = (
    <Card className={`border-none shadow-lg text-white hover:shadow-xl transition-shadow bg-gradient-to-br ${gradient}`}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-white/80 text-sm font-medium mb-1">{title}</p>
            <p className="text-4xl font-bold">{value}</p>
            {sub && <p className="text-white/80 text-xs mt-1">{sub}</p>}
          </div>
          <div className="p-3 bg-white/20 rounded-xl"><Icon className="w-6 h-6" /></div>
        </div>
      </CardContent>
    </Card>
  );
  return to ? <Link to={to}>{card}</Link> : card;
}

export default function VibrationKpiCards({ data }) {
  const totalAlerts = data.alertsD + data.alertsC;
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-8">
      <Kpi title="Sledované stroje" value={data.monitoredMachines} sub={`${data.sensorCount} senzorů`} icon={Radio} gradient="from-indigo-500 to-indigo-600" />
      <Kpi title="Aktivní alarmy" value={totalAlerts} sub={`D: ${data.alertsD} · C: ${data.alertsC}`} icon={Bell}
        gradient={data.alertsD > 0 ? "from-red-500 to-red-600" : totalAlerts > 0 ? "from-orange-500 to-orange-600" : "from-green-500 to-green-600"}
        to={createPageUrl("VibrationOnline?tab=alerts")} />
      <Kpi title="Senzory offline" value={data.offlineCount} sub="bez dat déle než 6 h" icon={WifiOff}
        gradient={data.offlineCount > 0 ? "from-slate-600 to-slate-700" : "from-slate-400 to-slate-500"} />
      <Kpi title="Slabá baterie" value={data.lowBatteryCount} sub="pod 20 %" icon={BatteryLow}
        gradient={data.lowBatteryCount > 0 ? "from-amber-500 to-amber-600" : "from-slate-400 to-slate-500"} />
    </div>
  );
}