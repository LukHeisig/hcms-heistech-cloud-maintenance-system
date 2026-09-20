import React from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, LayoutDashboard } from "lucide-react";
import { VSE_TEMPLATES, parseVseDefinition } from "@/components/vibration/vseTemplates";
import VseSpindleEnergyPanel from "@/components/vse/VseSpindleEnergyPanel";

export default function VseVibrationCard({ machine }) {
  const schemaId = machine?.vibration_schema_id;

  const { data: schema, isLoading } = useQuery({
    queryKey: ["vibrationSchema", schemaId],
    queryFn: () => base44.entities.VibrationSchema.get(schemaId),
    enabled: !!schemaId,
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
      <TabsList className="bg-white shadow-sm">
        <TabsTrigger value={definition.template} className="gap-2">
          <LayoutDashboard className="w-4 h-4" /> {template.label}
        </TabsTrigger>
      </TabsList>
      <TabsContent value="spindle_energy">
        <VseSpindleEnergyPanel definition={definition} />
      </TabsContent>
    </Tabs>
  );
}