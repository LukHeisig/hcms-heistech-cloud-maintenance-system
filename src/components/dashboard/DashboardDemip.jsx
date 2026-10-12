import React from "react";
import { Link } from "react-router-dom";
import { Building2, Droplet, AlertTriangle, ClipboardCheck, Loader2 } from "lucide-react";
import DashboardSummary from "@/components/dashboard/DashboardSummary";
import DashboardDemipLine from "@/components/dashboard/DashboardDemipLine";
import DashboardActivity from "@/components/dashboard/DashboardActivity";

export default function DashboardDemip({ companies, lines, machines, points, records, issues, getPointStatus, getUserDisplayName, overdue, monthlyRecords, admin, superAdmin, loading }) {
  const summaries = [
    ...(admin ? [{ label: "Aktivní podniky", value: companies.length, icon: Building2 }] : []),
    { label: "Kontrolní body", value: points.length, icon: Droplet },
    { label: "Po termínu", value: overdue, icon: AlertTriangle, danger: overdue > 0 },
    { label: "Záznamů tento měsíc", value: monthlyRecords, icon: ClipboardCheck },
  ];
  return <>
    <DashboardSummary items={summaries} />
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
      <section className="lg:col-span-2 bg-card border border-border rounded-xl shadow-sm min-w-0">
        <header className="flex flex-wrap items-center justify-between gap-3 p-4 md:p-6 border-b border-border">
          <h2 className="text-xl font-semibold">Přehled výroby - Linky</h2>
          {superAdmin && <Link to="/Admin" className="text-sm font-medium text-dashboard-accent">Správa struktury</Link>}
        </header>
        <div className="p-4 md:p-6 space-y-6">
          {loading ? <Loader2 className="w-6 h-6 animate-spin mx-auto" aria-label="Načítání linek" /> : companies.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">Žádné aktivní podniky s modulem DEMIP.</p> : companies.map(company => {
            const companyLines = lines.filter(line => line.company_id === company.id);
            return <section key={company.id} className="space-y-3">
              <header className="flex items-center justify-between gap-3"><div className="min-w-0"><h3 className="text-lg font-bold break-words">{company.name}</h3><p className="text-sm text-muted-foreground">{companyLines.length} linek</p></div>{admin && <Link to="/Admin" className="text-sm text-dashboard-accent shrink-0">Spravovat</Link>}</header>
              {companyLines.length === 0 && <p className="text-sm text-muted-foreground">Zatím nejsou žádné linky.</p>}
              {companyLines.map(line => {
                const lineMachines = machines.filter(machine => machine.line_id === line.id);
                const linePoints = points.filter(point => lineMachines.some(machine => machine.id === point.machine_id));
                return <DashboardDemipLine key={line.id} line={line} machines={lineMachines} points={linePoints} getPointStatus={getPointStatus} compact={admin} />;
              })}
            </section>;
          })}
        </div>
      </section>
      <DashboardActivity records={records} issues={issues} points={points} getUserDisplayName={getUserDisplayName} />
    </div>
  </>;
}