import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Building2, ChevronRight } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { countInChunks } from "@/lib/countInChunks";

export default function DemipCompanyRow({ company, lines, machines, onSelect }) {
  const lineIds = lines.filter(line => line.company_id === company.id).map(line => line.id);
  const machineIds = machines.filter(machine => lineIds.includes(machine.line_id)).map(machine => machine.id);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["demipCompanyCounts", company.id, machineIds],
    queryFn: async () => ({
      lineCount: lineIds.length,
      pointCount: await countInChunks(base44.entities.ControlPoint, "machine_id", machineIds),
    }),
    staleTime: 300000,
  });
  return (
    <button type="button" onClick={() => onSelect(company.id)}
      className="flex min-h-16 w-full items-center gap-3 rounded-lg border border-border bg-card px-3 py-3 text-left text-card-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-demip-brand text-demip-brand-foreground">
        <Building2 className="h-5 w-5" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold leading-snug sm:text-base">{company.name}</span>
        <span className="mt-1 block text-xs text-muted-foreground" aria-live="polite">
          {isLoading ? "Načítání počtů…" : isError ? "Počty nejsou dostupné" : `${data.lineCount} linek · ${data.pointCount} bodů`}
        </span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
    </button>
  );
}