import React, { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, LayoutDashboard } from "lucide-react";
import { VSE_TEMPLATES, parseVseDefinition } from "@/components/vibration/vseTemplates";
import VseSpindleEnergyPanel from "@/components/vse/VseSpindleEnergyPanel";

function parseJson(raw, fallback) {
  try { return JSON.parse(raw || "null") ?? fallback; } catch { return fallback; }
}

export default function VseVibrationCard({ machine, canConfigure = false }) {
  const schemaId = machine?.vibration_schema_id;
  const queryClient = useQueryClient();

  const { data: schema, isLoading } = useQuery({
    queryKey: ["vibrationSchema", schemaId],
    queryFn: () => base44.entities.VibrationSchema.get(schemaId),
    enabled: !!schemaId,
  });

  const { data: units = [] } = useQuery({
    queryKey: ["vseUnitsForMapping"],
    queryFn: () => base44.entities.VseUnit.list("unit_id", 200),
    enabled: !!schemaId,
    staleTime: 60000,
  });

  const options = useMemo(() => {
    const out = [];
    units.forEach((u) => {
      const unitLabel = u.name || u.unit_id;
      parseJson(u.last_values_json, []).forEach((v) => {
        out.push({
          value: `${u.unit_id}|${v.node_id}`,
          label: `${unitLabel} – ${v.name}`,
          unit_id: u.unit_id,
          unit_label: unitLabel,
          node_id: v.node_id,
          name: v.name,
          value_display: typeof v.value === "number"
            ? `${v.value.toLocaleString("cs-CZ", { maximumFractionDigits: 3 })}${v.unit ? " " + v.unit : ""}`
            : String(v.value ?? "—"),
        });
      });
    });
    return out;
  }, [units]);

  const mapping = parseJson(machine?.vse_counter_map, {});

  const saveMapping = useMutation({
    mutationFn: (next) => base44.entities.Machine.update(machine.id, { vse_counter_map: JSON.stringify(next) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["machine", machine.id] });
      queryClient.invalidateQueries({ queryKey: ["allMachines"] });
    },
  });

  const handleAssign = (slot, option) => {
    const next = { ...mapping };
    if (!option) delete next[slot];
    else next[slot] = { unit_id: option.unit_id, unit_label: option.unit_label, node_id: option.node_id, name: option.name };
    saveMapping.mutate(next);
  };

  if (!schemaId) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <LayoutDashboard className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">Stroji není přiřazena žádná šablona vizualizace VSE. Nastavte ji v úpravě stroje.</p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return <div className="flex justify-center p-12"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;
  }

  const definition = parseVseDefinition(schema?.rows_definition);
  if (!definition) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-slate-500">
          Šablona „{schema?.name}" má neplatnou definici. Otevřete ji v nastavení vibrodiagnostiky a uložte znovu.
        </CardContent>
      </Card>
    );
  }

  const template = VSE_TEMPLATES[definition.template];

  return (
    <Tabs defaultValue={definition.template} className="space-y-4">
      <TabsList className="bg-white shadow-sm">
        <TabsTrigger value={definition.template} className="gap-2">
          <LayoutDashboard className="w-4 h-4" /> {template.label}
        </TabsTrigger>
      </TabsList>
      <TabsContent value="spindle_energy">
        <VseSpindleEnergyPanel
          definition={definition}
          mapping={mapping}
          options={options}
          canConfigure={canConfigure}
          onAssign={handleAssign}
        />
      </TabsContent>
    </Tabs>
  );
}