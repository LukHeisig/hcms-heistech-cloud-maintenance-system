import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { throttled } from "@/lib/requestQueue";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Cpu } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { format } from "date-fns";
import VseWebhookInfo from "@/components/vse/VseWebhookInfo";
import VseUnitCard from "@/components/vse/VseUnitCard";
import VseUnitSelect from "@/components/vse/VseUnitSelect";
import VseValuesTable from "@/components/vse/VseValuesTable";
import VseReadingsHistory from "@/components/vse/VseReadingsHistory";

export default function VseUnits() {
  const navigate = useNavigate();
  const [selectedId, setSelectedId] = useState(null);

  const { data: units = [], isLoading } = useQuery({
    queryKey: ["vseUnits"],
    queryFn: () => throttled(() => base44.entities.VseUnit.list("-last_seen", 200)),
    refetchInterval: 60000,
  });

  const selected = units.find((u) => u.id === selectedId) || units[0] || null;

  const { data: readings = [], isLoading: readingsLoading } = useQuery({
    queryKey: ["vseReadings", selected?.unit_id],
    queryFn: () => throttled(() => base44.entities.VseReading.filter({ unit_id: selected.unit_id }, "-recorded_at", 50)),
    enabled: !!selected,
    refetchInterval: 60000,
  });

  return (
    <div className="p-4 md:p-8 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <Button variant="ghost" size="sm" className="mb-4" onClick={() => navigate(createPageUrl("Settings"))}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Nastavení
        </Button>
        <h1 className="text-3xl font-bold text-slate-900 mb-2 flex items-center gap-3">
          <Cpu className="w-8 h-8 text-teal-600" /> VSE jednotky
        </h1>
        <p className="text-slate-500 mb-8">Data z ifm VSE jednotek přijímaná přes OPC UA bridge</p>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="space-y-3">
            {isLoading && <p className="text-sm text-slate-500">Načítám jednotky…</p>}
            {!isLoading && units.length === 0 && (
              <Card><CardContent className="p-6 text-center text-sm text-slate-500">
                Zatím nebyla přijata žádná data. Nastavte OPC UA bridge podle instrukcí níže.
              </CardContent></Card>
            )}
            {units.length > 0 && (
              <>
                <VseUnitSelect units={units} selectedId={selected?.id} onChange={setSelectedId} />
                {selected && <VseUnitCard unit={selected} selected />}
              </>
            )}
            <VseWebhookInfo />
          </div>

          <div className="lg:col-span-2 space-y-6">
            {selected && (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base text-slate-800">
                      Aktuální hodnoty — {selected.name || selected.unit_id}
                      {selected.last_seen && (
                        <span className="ml-2 text-xs font-normal text-slate-500">
                          {format(new Date(selected.last_seen), "d. M. yyyy HH:mm:ss")}
                        </span>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent><VseValuesTable valuesJson={selected.last_values_json} /></CardContent>
                </Card>
                <Card>
                  <CardHeader><CardTitle className="text-base text-slate-800">Historie (posledních 50)</CardTitle></CardHeader>
                  <CardContent><VseReadingsHistory readings={readings} isLoading={readingsLoading} /></CardContent>
                </Card>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}