import React from "react";
import { Link } from "react-router-dom";
import { Activity, ChevronRight } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function MonitoredMachinesDialog({ open, onOpenChange, machines, lines, companies, loading }) {
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="sm:max-w-xl">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2"><Activity className="w-5 h-5" />Sledované stroje</DialogTitle>
        <DialogDescription>Výběrem stroje otevřete jeho vibrační kartu.</DialogDescription>
      </DialogHeader>
      <div className="max-h-[60vh] overflow-y-auto space-y-2">
        {loading ? <p role="status" className="text-sm text-muted-foreground text-center py-8">Načítání strojů…</p> : machines.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">Zatím nejsou žádné sledované stroje.</p> : machines.map(machine => {
          const line = lines.find(item => item.id === machine.line_id);
          const company = companies.find(item => item.id === line?.company_id);
          return <Link key={machine.id} to={`/Machine?id=${encodeURIComponent(machine.id)}#vibration`} onClick={() => onOpenChange(false)} className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Activity className="w-4 h-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold break-words">{machine.name}</p>
              {(company || line) && <p className="text-xs text-muted-foreground mt-1 break-words">{company?.name}{company && line ? " · " : ""}{line?.name}</p>}
            </div>
            <ChevronRight className="w-4 h-4 shrink-0 text-muted-foreground" />
          </Link>;
        })}
      </div>
    </DialogContent>
  </Dialog>;
}