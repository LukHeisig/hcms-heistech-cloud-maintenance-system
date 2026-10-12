import React from "react";
import { Link } from "react-router-dom";
import { Building2, Droplet, AlertTriangle, ClipboardCheck, Loader2 } from "lucide-react";
import DashboardSummary from "@/components/dashboard/DashboardSummary";
import DashboardDemipCompany from "@/components/dashboard/DashboardDemipCompany";
import DashboardActivity from "@/components/dashboard/DashboardActivity";

export default function DashboardDemip({ companies, lines, machines, points, records, issues, getPointStatus, getUserDisplayName, overdue, monthlyRecords, admin, superAdmin, loading }) {
  const summaries = [
    ...(admin ? [{ label: "Aktivní podniky", value: companies.length, icon: Building2 }] : []),
    { label: "Kontrolní body", value: points.length, icon: Droplet },
    { label: "Po termínu", value: overdue, icon: AlertTriangle, danger: overdue > 0 },
    { label: "Záznamů tento měsíc", value: monthlyRecords, icon: ClipboardCheck },
  ];
  return <>
    <div className="op-layout">
      <DashboardSummary items={summaries} />
      <section className="op-work">
        <header className="op-wh">
          <h2 className="text-xl font-semibold">Přehled výroby - Linky</h2>
          {superAdmin && <Link to="/Admin" className="text-sm font-medium text-dashboard-accent">Správa struktury</Link>}
        </header>
        <div className="op-companies">
          {loading ? <Loader2 className="w-6 h-6 animate-spin mx-auto" aria-label="Načítání linek" /> : companies.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">Žádné aktivní podniky s modulem DEMIP.</p> : companies.map(company => (
            <DashboardDemipCompany key={company.id} company={company} lines={lines} machines={machines} points={points} getPointStatus={getPointStatus} admin={admin} collapsible={companies.length > 1} />
          ))}
        </div>
      </section>
    </div>
    <DashboardActivity records={records} issues={issues} points={points} getUserDisplayName={getUserDisplayName} />
  </>;
}