import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { cs } from "date-fns/locale";
import { Activity, RefreshCw, ArrowUpRight, Search, PlayCircle, Send } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function VibroTest() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTestMachine, setSelectedTestMachine] = useState("");
  const { toast } = useToast();

  const { data: measurements = [], isLoading, refetch } = useQuery({
    queryKey: ["vibrationMeasurementsTest"],
    queryFn: () => base44.entities.VibrationMeasurement.list("-measurement_date", 50),
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  const { data: machines = [] } = useQuery({
    queryKey: ["machines"],
    queryFn: () => base44.entities.Machine.list(),
  });

  // Filtrovat stroje, které mají nastavené sensor_id
  const machinesWithSensors = machines.filter(m => m.sensor_id);

  const testConnectionMutation = useMutation({
    mutationFn: async (machineId) => {
      const machine = machines.find(m => m.id === machineId);
      if (!machine || !machine.sensor_id) throw new Error("Stroj nemá Sensor ID");

      // Simulace dat
      const payload = {
        device_id: machine.sensor_id,
        timestamp: new Date().toISOString(),
        values: {
          vel_rms_x: Math.random() * 5,
          vel_rms_y: Math.random() * 5,
          vel_rms_z: Math.random() * 5,
          acc_rms_x: Math.random() * 2,
          acc_rms_y: Math.random() * 2,
          acc_rms_z: Math.random() * 2,
          temp: 40 + Math.random() * 20
        }
      };

      return base44.functions.invoke("ingestVibration", payload);
    },
    onSuccess: () => {
      toast({
        title: "Test odeslán",
        description: "Simulovaná data byla úspěšně odeslána na endpoint.",
        variant: "success",
      });
      setTimeout(() => refetch(), 1000); // Přenačíst data chvíli po odeslání
    },
    onError: (error) => {
      console.error("Chyba testu:", error);
      toast({
        title: "Chyba testu",
        description: `Nepodařilo se odeslat data: ${error.response?.data?.error || error.message}`,
        variant: "destructive",
      });
    }
  });

  const getMachineName = (id) => {
    const machine = machines.find((m) => m.id === id);
    return machine ? machine.name : "Neznámý stroj";
  };

  const getConditionColor = (condition) => {
    switch (condition) {
      case "good": return "bg-green-100 text-green-800";
      case "acceptable": return "bg-blue-100 text-blue-800";
      case "unsatisfactory": return "bg-orange-100 text-orange-800";
      case "unacceptable": return "bg-red-100 text-red-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const getConditionLabel = (condition) => {
    switch (condition) {
      case "good": return "Dobrý";
      case "acceptable": return "Přijatelný";
      case "unsatisfactory": return "Neuspokojivý";
      case "unacceptable": return "Nepřípustný";
      default: return condition;
    }
  };

  const filteredMeasurements = measurements.filter(m => {
    const machineName = getMachineName(m.machine_id).toLowerCase();
    return machineName.includes(searchTerm.toLowerCase()) || 
           (m.measuring_point && m.measuring_point.toLowerCase().includes(searchTerm.toLowerCase()));
  });

  return (
    <div className="p-4 md:p-8 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
              <Activity className="w-8 h-8 text-purple-600" />
              Vibro Test API
            </h1>
            <p className="text-slate-600 mt-1">
              Živý náhled dat přijatých z externího API (posledních 50 záznamů)
            </p>
          </div>
          <div className="flex gap-2">
             <Button onClick={() => refetch()} variant="outline" className="gap-2">
               <RefreshCw className="w-4 h-4" />
               Obnovit
             </Button>
          </div>
        </div>

        {/* Testovací sekce */}
        <Card className="mb-6 border-blue-200 bg-blue-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2 text-blue-800">
              <PlayCircle className="w-5 h-5" />
              Test spojení a simulace dat
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row gap-4 items-end">
              <div className="flex-1 w-full">
                <label className="text-sm font-medium text-blue-900 mb-1 block">
                  Vyberte stroj pro simulaci (musí mít Sensor ID)
                </label>
                <Select value={selectedTestMachine} onValueChange={setSelectedTestMachine}>
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder="Vyberte stroj..." />
                  </SelectTrigger>
                  <SelectContent>
                    {machinesWithSensors.length === 0 ? (
                      <SelectItem value="none" disabled>Žádné stroje se Sensor ID</SelectItem>
                    ) : (
                      machinesWithSensors.map(m => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.name} (Sensor: {m.sensor_id})
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              <Button 
                onClick={() => testConnectionMutation.mutate(selectedTestMachine)}
                disabled={!selectedTestMachine || testConnectionMutation.isPending}
                className="bg-blue-600 hover:bg-blue-700 text-white min-w-[150px]"
              >
                {testConnectionMutation.isPending ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Odesílám...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Simulovat data
                  </>
                )}
              </Button>
            </div>
            <p className="text-xs text-blue-600 mt-2">
              Tímto tlačítkem odešlete testovací data na endpoint <code>ingestVibration</code>. Pokud se data objeví v tabulce níže, endpoint a databáze fungují správně a problém je pravděpodobně v konfiguraci odesílací aplikace (URL nebo token).
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle>Přijatá měření</CardTitle>
              <div className="relative w-64">
                <Search className="absolute left-2 top-2.5 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Hledat stroj..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">Načítám data...</div>
            ) : filteredMeasurements.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                Zatím nebyla přijata žádná data z API.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Datum a čas</TableHead>
                      <TableHead>Stroj</TableHead>
                      <TableHead>Místo měření</TableHead>
                      <TableHead className="text-right">Rychlost RMS (mm/s)</TableHead>
                      <TableHead className="text-right">Zrychlení RMS (m/s²)</TableHead>
                      <TableHead className="text-right">Teplota (°C)</TableHead>
                      <TableHead>Stav</TableHead>
                      <TableHead>Osy (Vel RMS)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredMeasurements.map((m) => (
                      <TableRow key={m.id} className="hover:bg-slate-50">
                        <TableCell className="font-medium">
                          {format(new Date(m.measurement_date), "d. M. yyyy HH:mm:ss", { locale: cs })}
                        </TableCell>
                        <TableCell>{getMachineName(m.machine_id)}</TableCell>
                        <TableCell>{m.measuring_point}</TableCell>
                        <TableCell className="text-right font-bold font-mono">
                          {m.v_rms?.toFixed(2) ?? "-"}
                        </TableCell>
                        <TableCell className="text-right font-mono text-slate-600">
                          {m.a_rms?.toFixed(2) ?? "-"}
                        </TableCell>
                        <TableCell className="text-right font-mono text-slate-600">
                          {m.temperature?.toFixed(1) ?? "-"}
                        </TableCell>
                        <TableCell>
                          <Badge className={getConditionColor(m.condition_rating)}>
                            {getConditionLabel(m.condition_rating)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-slate-500 font-mono">
                          X: {m.vel_rms_x?.toFixed(1) ?? "-"} | 
                          Y: {m.vel_rms_y?.toFixed(1) ?? "-"} | 
                          Z: {m.vel_rms_z?.toFixed(1) ?? "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}