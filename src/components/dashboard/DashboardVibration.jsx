import React, { useState } from "react";
import { Activity, Bell, WifiOff, BatteryLow, Loader2 } from "lucide-react";
import DashboardSummary from "@/components/dashboard/DashboardSummary";
import VibrationLineMachines from "@/components/dashboard/VibrationLineMachines";
import RecentVibrationAlerts from "@/components/dashboard/RecentVibrationAlerts";
import VibrationAlarmFrequencyChart from "@/components/dashboard/VibrationAlarmFrequencyChart";
import OfflineSensorsDialog from "@/components/dashboard/OfflineSensorsDialog";
import MonitoredMachinesDialog from "@/components/dashboard/MonitoredMachinesDialog";

export default function DashboardVibration({ user, companies, lines, machines, vib, loading }) {
  const [offlineOpen, setOfflineOpen] = useState(false);
  const [batteryOpen, setBatteryOpen] = useState(false);
  const [machinesOpen, setMachinesOpen] = useState(false);
  const items = [
    { label: "Sledované stroje", value: vib.monitoredMachines, icon: Activity, note: `${vib.sensorCount} senzorů`, onClick: () => setMachinesOpen(true) },
    { label: "Aktivní alarmy", value: vib.alertsD + vib.alertsC, icon: Bell, danger: vib.alertsD + vib.alertsC > 0, to: "/VibrationOnline?tab=alerts", note: `D: ${vib.alertsD} · C: ${vib.alertsC}` },
    { label: "Senzory offline", value: vib.offlineCount, icon: WifiOff, note: "bez dat déle než 12 h", onClick: vib.offlineCount > 0 ? () => setOfflineOpen(true) : undefined },
    { label: "Slabá baterie", value: vib.lowBatteryCount, icon: BatteryLow, note: "úroveň 1/4 a méně", onClick: vib.lowBatteryCount > 0 ? () => setBatteryOpen(true) : undefined },
  ];
  const monitored = machines.filter(machine => machine.vibration_source === "vse" || machine.monitor_vibration || vib.byMachine[machine.id]);
  return <>
    <DashboardSummary items={items} />
    <OfflineSensorsDialog open={offlineOpen} onOpenChange={setOfflineOpen} sensors={vib.offlineSensors || []} machines={machines} />
    <OfflineSensorsDialog variant="battery" open={batteryOpen} onOpenChange={setBatteryOpen} sensors={vib.lowBatterySensors || []} machines={machines} />
    <MonitoredMachinesDialog open={machinesOpen} onOpenChange={setMachinesOpen} machines={monitored} lines={lines} companies={companies} loading={loading || vib.isLoading} />
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start mb-6">
      <section className="lg:col-span-2 bg-card border border-border rounded-xl shadow-sm min-w-0">
        <h2 className="text-xl font-semibold p-4 md:p-6 border-b border-border">Sledované stroje</h2>
        <div className="p-4 md:p-6 space-y-6">
          {loading || vib.isLoading ? <Loader2 className="w-6 h-6 animate-spin mx-auto" aria-label="Načítání vibrací" /> : monitored.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">Zatím nejsou žádné sledované stroje.</p> : companies.map(company => {
            const companyLines = lines.filter(line => line.company_id === company.id && monitored.some(machine => machine.line_id === line.id));
            if (!companyLines.length) return null;
            return <section key={company.id}><h3 className="text-lg font-bold break-words mb-3">{company.name}</h3>{companyLines.map(line => <div key={line.id} className="mb-4">
              <h4 className="text-sm font-semibold break-words">{line.name}</h4>
              <VibrationLineMachines machines={monitored.filter(machine => machine.line_id === line.id)} byMachine={vib.byMachine} loading={vib.isLoading} />
            </div>)}</section>;
          })}
        </div>
      </section>
      <RecentVibrationAlerts alerts={vib.recentAlerts} />
    </div>
    <VibrationAlarmFrequencyChart user={user} machines={machines} lines={lines} companies={companies} />
  </>;
}