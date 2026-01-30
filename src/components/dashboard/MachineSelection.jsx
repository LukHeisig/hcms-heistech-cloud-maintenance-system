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
  const urlParams = new URLSearchParams(window.location.search);
  const categoryParam = urlParams.get('category') || 'lubrication';
  const [maintenanceFilter, setMaintenanceFilter] = useState(categoryParam);

  const filteredMachines = useMemo(() => {
    let filtered = [];
    if (maintenanceFilter === "lubrication") {
      filtered = lineMachines.filter(m => {
        const machinePoints = demipControlPoints.filter(p => p.machine_id === m.id);
        return machinePoints.some(p => ['lubrication', 'inspection', 'auto_lubricator'].includes(p.type));
      });
    } else if (maintenanceFilter === "prevention") {
      filtered = lineMachines.filter(m => {
        const machinePoints = demipControlPoints.filter(p => p.machine_id === m.id);
        return machinePoints.some(p => p.type === 'prevention');
      });
    }
    return filtered.sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
  }, [lineMachines, demipControlPoints, maintenanceFilter]);

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
            const machineOverdue = machinePoints.filter(p => {
              const s = getPointStatus(p);
              return s === "overdue" || s === "critical";
            }).length;
            const machineWarning = machinePoints.filter(p => getPointStatus(p) === "warning").length;

            let iconBg = "from-green-500 to-green-600";
            let statusBadge = null;

            if (machineOverdue > 0) {
              iconBg = "from-red-500 to-red-600";
              statusBadge = (
                <div className="flex items-center justify-center px-2 py-1 bg-red-100 rounded-full">
                  <span className="text-xs font-bold text-red-600">{machineOverdue} !</span>
                </div>
              );
            } else if (machineWarning > 0) {
              iconBg = "from-yellow-500 to-yellow-600";
              statusBadge = (
                <div className="flex items-center justify-center px-2 py-1 bg-yellow-100 rounded-full">
                  <span className="text-xs font-bold text-yellow-700">{machineWarning}</span>
                </div>
              );
            }

            return (
              <div
                key={machine.id}
                className="group relative bg-white rounded-2xl p-4 shadow-sm border border-slate-100 active:scale-[0.98] transition-all cursor-pointer"
                onClick={() => {
                  const url = selectedCompany
                    ? `Dashboard?company=${selectedCompany}&line=${selectedLine}&machine=${machine.id}&category=${maintenanceFilter}`
                    : `Dashboard?line=${selectedLine}&machine=${machine.id}&category=${maintenanceFilter}`;
                  navigate(createPageUrl(url));
                }}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${iconBg} flex items-center justify-center shadow-lg text-white`}>
                    {maintenanceFilter === "lubrication" ? (
                      <Droplet className="w-6 h-6" />
                    ) : (
                      <ClipboardCheck className="w-6 h-6" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center mb-1">
                      <h3 className="font-bold text-slate-900 text-lg">{machine.name}</h3>
                      {statusBadge}
                    </div>
                    <p className="text-sm text-slate-500 font-medium">{currentLine?.name || "Linka"}</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-slate-500 transition-colors" />
                </div>
              </div>
            );
        })
        )}
      </div>
    </div>
  );
}