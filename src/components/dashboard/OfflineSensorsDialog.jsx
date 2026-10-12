import React from "react";
import { Link } from "react-router-dom";
import { WifiOff, BatteryLow, ChevronRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cs } from "date-fns/locale";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function OfflineSensorsDialog({ open, onOpenChange, sensors, machines, variant = "offline" }) {
  const battery = variant === "battery";
  const Icon = battery ? BatteryLow : WifiOff;
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="sm:max-w-xl">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2"><Icon className="w-5 h-5" />{battery ? "Senzory se slabou baterií" : "Senzory offline"}</DialogTitle>
        <DialogDescription>{battery ? "Senzory s baterií na úrovni 1/4 a méně." : "Senzory bez dat déle než 12 hodin."} Výběrem senzoru otevřete vibrační kartu jeho stroje.</DialogDescription>
      </DialogHeader>
      <div className="max-h-[60vh] overflow-y-auto space-y-2">
        {sensors.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">{battery ? "Žádné senzory nemají slabou baterii." : "Žádné senzory nejsou offline."}</p>}
        {sensors.map(sensor => {
          const machine = machines.find(item => item.id === sensor.machine_id);
          const content = <><Icon className="w-4 h-4 shrink-0 text-muted-foreground mt-1" />
            <div className="min-w-0 flex-1"><p className="text-sm font-semibold break-words">{sensor.name || sensor.sensor_id}</p>
              {sensor.name && <p className="text-xs text-muted-foreground break-all">{sensor.sensor_id}</p>}
              <p className="text-sm mt-1 break-words">{machine?.name || "Stroj není přiřazen"}</p>
              {battery && <p className="text-xs text-muted-foreground mt-1">Baterie: {sensor.last_battery_level}/4</p>}
              <p className="text-xs text-muted-foreground mt-1">{sensor.last_seen ? `Poslední data ${formatDistanceToNow(new Date(sensor.last_seen), { addSuffix: true, locale: cs })}` : "Dosud nebyla přijata žádná data"}</p>
            </div>{machine && <ChevronRight className="w-4 h-4 shrink-0 self-center text-muted-foreground" />}</>;
          const className = "flex items-start gap-3 rounded-lg border border-border bg-card p-3";
          return machine ? <Link key={sensor.id || sensor.sensor_id} to={`/Machine?id=${encodeURIComponent(machine.id)}#vibration`} onClick={() => onOpenChange(false)} className={`${className} hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`}>{content}</Link>
            : <div key={sensor.id || sensor.sensor_id} className={className}>{content}</div>;
        })}
      </div>
    </DialogContent>
  </Dialog>;
}