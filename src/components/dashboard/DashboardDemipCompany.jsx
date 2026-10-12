import React from "react";
import { Link } from "react-router-dom";
import { ChevronDown } from "lucide-react";
import DashboardDemipLine from "@/components/dashboard/DashboardDemipLine";

export default function DashboardDemipCompany({ company, lines, machines, points, getPointStatus, admin, collapsible }) {
  const companyLines = lines.filter(line => line.company_id === company.id);
  const Container = collapsible ? "details" : "section";
  const Heading = collapsible ? "summary" : "header";
  return <Container className="dashboard-company space-y-3">
    <Heading className={`flex items-center justify-between gap-3 ${collapsible ? "cursor-pointer list-none" : ""}`}>
      <div className="min-w-0 flex-1"><h3 className="text-lg font-bold break-words">{company.name}</h3><p className="text-sm text-muted-foreground">{companyLines.length} linek</p></div>
      {admin && <Link to="/Admin" onClick={event => event.stopPropagation()} className="text-sm text-dashboard-accent shrink-0">Spravovat</Link>}
      {collapsible && <ChevronDown className="dashboard-company-chevron w-4 h-4 shrink-0 text-muted-foreground" />}
    </Heading>
    <div className="space-y-3">
      {companyLines.length === 0 && <p className="text-sm text-muted-foreground">Zatím nejsou žádné linky.</p>}
      {companyLines.map(line => {
        const lineMachines = machines.filter(machine => machine.line_id === line.id && points.some(point => point.machine_id === machine.id));
        const linePoints = points.filter(point => lineMachines.some(machine => machine.id === point.machine_id));
        return <DashboardDemipLine key={line.id} line={line} machines={lineMachines} points={linePoints} getPointStatus={getPointStatus} compact={admin} />;
      })}
    </div>
  </Container>;
}