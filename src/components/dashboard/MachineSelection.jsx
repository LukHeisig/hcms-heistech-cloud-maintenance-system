import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Activity, Clock, ChevronRight, ArrowLeft, Droplet, ClipboardCheck, Factory } from "lucide-react";

export default function MachineSelection({
  selectedCompany,
  selectedLine,
  currentLine,
  lineMachines,
  demipControlPoints,
  getPointStatus,
}) {
  const navigate = useNavigate();
  const [maintenanceFilter, setMaintenanceFilter] = useState("lubrication");

  const filteredMachines = useMemo(() => {
    return lineMachines.filter(m => m.maintenance_category === maintenanceFilter);
  }, [lineMachines, maintenanceFilter]);

  return (
    <div className="max-w-4xl mx-auto">
      <Button
        variant="ghost"
        onClick={() => {
          const url = selectedCompany
            ? `Dashboard?company=${selectedCompany}`
            : "Dashboard";
          navigate(createPageUrl(url));
        }}
        className="mb-4"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Zpět na linky
      </Button>
      <h1 className="text-3xl font-bold text-slate-900 mb-2">Výběr stroje - DEMIP</h1>
      {currentLine && <p className="text-slate-600 mb-4">{currentLine.name}</p>}
      
      <Tabs value={maintenanceFilter} onValueChange={setMaintenanceFilter} className="mb-6">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="lubrication" className="gap-2">
            <Droplet className="w-4 h-4" />
            Mazání
          </TabsTrigger>
          <TabsTrigger value="prevention" className="gap-2">
            <ClipboardCheck className="w-4 h-4" />
            Prevence
          </TabsTrigger>
        </TabsList>
      </Tabs>
      <div className="space-y-2">
        {filteredMachines.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Factory className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">
                Žádné stroje v kategorii "{maintenanceFilter === "lubrication" ? "Mazání" : "Prevence"}"
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredMachines.map((machine) => {
          const machinePoints = demipControlPoints.filter(p => p.machine_id === machine.id);
          const machineOverdue = machinePoints.filter(p => getPointStatus(p) === "overdue").length;

          return (
            <Card
              key={machine.id}
              className="cursor-pointer transition-all hover:shadow-md border-l-4 border-l-blue-500"
              onClick={() => {
                const url = selectedCompany
                  ? `Dashboard?company=${selectedCompany}&line=${selectedLine}&machine=${machine.id}`
                  : `Dashboard?line=${selectedLine}&machine=${machine.id}`;
                navigate(createPageUrl(url));
              }}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 flex-1">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-blue-100">
                      <Activity className="w-5 h-5 text-blue-700" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold text-slate-900 text-base">{machine.name}</h3>
                        {machineOverdue > 0 && (
                          <Badge variant="destructive" className="gap-1">
                            <Clock className="w-3 h-3" />
                            {machineOverdue}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-slate-600">{machinePoints.length} kontrolních bodů</p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-400" />
                </div>
              </CardContent>
            </Card>
          );
          })
        )}
      </div>
    </div>
  );
}