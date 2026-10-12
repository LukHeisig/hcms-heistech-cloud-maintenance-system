import React from "react";
import { ChevronDown } from "lucide-react";
import VibrationLineMachines from "@/components/dashboard/VibrationLineMachines";

export default function DashboardVibrationCompany({ company, lines, machines, byMachine, loading }) {
  return <details className="dashboard-company group">
    <summary className="flex items-center justify-between gap-3 cursor-pointer list-none rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
      <h3 className="text-lg font-bold break-words min-w-0">{company.name}</h3>
      <ChevronDown className="w-4 h-4 shrink-0 text-muted-foreground group-open:rotate-180" />
    </summary>
    <div className="op-lines">
      {lines.map(line => <div key={line.id}>
        <h4 className="text-sm font-semibold break-words">{line.name}</h4>
        <VibrationLineMachines machines={machines.filter(machine => machine.line_id === line.id)} byMachine={byMachine} loading={loading} />
      </div>)}
    </div>
  </details>;
}