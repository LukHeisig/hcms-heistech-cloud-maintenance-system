import React, { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, LayoutDashboard, Settings } from "lucide-react";
import { VSE_TEMPLATES, parseVseDefinition } from "@/components/vibration/vseTemplates";
import VseSpindleEnergyPanel from "@/components/vse/VseSpindleEnergyPanel";
import VseCounterMappingDialog from "@/components/vse/VseCounterMappingDialog";

function parseJson(raw, fallback) {
  try { return JSON.parse(raw || "null") ?? fallback; } catch { return fallback; }
}

export default function VseVibrationCard({ machine, canConfigure = false }) {
  const schemaId = machine?.vibration_schema_id;
  const queryClient = useQueryClient();
  const [showDialog, setShowDialog] = useState(false);

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

  const values = useMemo(() => {
    const out = {};
    units.forEach((u) => {
      parseJson(u.last_values_json, []).forEach((v) => {
        out[`${u.unit_id}|${v.node_id}`] = typeof v.value === "number"
          ? `${v.value.toLocaleString("cs-CZ", { maximumFractionDigits: 3 })}${v.unit ? " " + v.unit : ""}`
          : String(v.value ?? "—");
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
      setShowDialog(false);
    },
  });

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
      <div className="flex items-center justify-between gap-3">
        <TabsList className="bg-white shadow-sm">
          <TabsTrigger value={definition.template} className="gap-2">
            <LayoutDashboard className="w-4 h-4" /> {template.label}
          </TabsTrigger>
        </TabsList>
        {canConfigure && (
          <Button variant="outline" size="sm" className="gap-2" onClick={() => setShowDialog(true)}>
            <Settings className="w-4 h-4" /> Nastavit
          </Button>
        )}
      </div>
      <TabsContent value="spindle_energy">
        <VseSpindleEnergyPanel definition={definition} mapping={mapping} values={values} />
      </TabsContent>

      {canConfigure && (
        <VseCounterMappingDialog
          open={showDialog}
          onOpenChange={setShowDialog}
          definition={definition}
          units={units}
          mapping={mapping}
          onSave={(next) => saveMapping.mutate(next)}
          isSaving={saveMapping.isPending}
        />
      )}
    </Tabs>
  );
}