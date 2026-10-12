import React from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import DemipCompanyRow from "@/components/dashboard/DemipCompanyRow";

export default function DemipCompanySelection({ companies, lines, machines, loading }) {
  const navigate = useNavigate();
  return (
    <section className="mx-auto w-full max-w-xl" aria-labelledby="demip-companies-title">
      <h1 id="demip-companies-title" className="mb-4 text-xl font-bold text-foreground">Výběr podniku - DEMIP</h1>
      {loading ? (
        <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground" role="status">
          <Loader2 className="h-5 w-5 animate-spin" /> Načítání podniků…
        </div>
      ) : companies.length === 0 ? (
        <p className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">Žádné dostupné podniky s povoleným modulem DEMIP.</p>
      ) : (
        <div className="space-y-2">
          {companies.map(company => (
            <DemipCompanyRow key={company.id} company={company} lines={lines} machines={machines}
              onSelect={id => navigate(`/Dashboard?company=${encodeURIComponent(id)}`)} />
          ))}
        </div>
      )}
    </section>
  );
}