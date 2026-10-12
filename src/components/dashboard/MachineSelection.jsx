import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import DemipMachineRow from "@/components/dashboard/DemipMachineRow";
import "@/components/dashboard/equipmentNavigation.css";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Droplet, ClipboardCheck } from "lucide-react";

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
    <div className="equipment-navigation equipment-selection-panel mx-auto w-full max-w-xl md:max-w-screen-2xl">
      <Button
        variant="ghost"
        onClick={() => {
          const url = selectedCompany
            ? `Dashboard?company=${selectedCompany}`
            : "Dashboard";
          navigate(createPageUrl(url));
        }}
        className="mb-3 h-9 px-2 text-sm"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Zpět na linky
      </Button>
      <h1 className="equipment-selection-title mb-2 text-xl font-bold text-foreground">Výběr stroje - DEMIP</h1>
      {currentLine && <p className="equipment-selection-description mb-4 text-sm text-muted-foreground">{currentLine.name}</p>}
      
      <Tabs value={maintenanceFilter} onValueChange={setMaintenanceFilter} className="mb-4">
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
      <div className="equipment-selection-list space-y-2">
        {filteredMachines.length === 0 ? (
          <p className="rounded-lg border border-border bg-card p-4 text-center text-sm text-muted-foreground">
            Žádné stroje v kategorii "{maintenanceFilter === "lubrication" ? "Mazání" : "Prevence"}"
          </p>
        ) : (
          filteredMachines.map(machine => (
            <DemipMachineRow key={machine.id} machine={machine} lineName={currentLine?.name}
              points={demipControlPoints} getPointStatus={getPointStatus}
              onSelect={id => {
                const url = selectedCompany
                  ? `Dashboard?company=${selectedCompany}&line=${selectedLine}&machine=${id}&category=${maintenanceFilter}`
                  : `Dashboard?line=${selectedLine}&machine=${id}&category=${maintenanceFilter}`;
                navigate(createPageUrl(url));
              }} />
          ))
        )}
      </div>
    </div>
  );
}