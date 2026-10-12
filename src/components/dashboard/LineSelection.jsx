import React from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import DemipLineRow from "@/components/dashboard/DemipLineRow";
import "@/components/dashboard/equipmentNavigation.css";

export default function LineSelection({
  user,
  selectedCompany,
  currentCompany,
  companyLines,
  demipMachines,
  demipControlPoints,
  getPointStatus,
}) {
  const navigate = useNavigate();

  return (
    <div className="equipment-navigation equipment-selection-panel mx-auto w-full max-w-xl md:max-w-screen-2xl">
      {(user?.user_type === "admin" || user?.user_type === "superAdmin") && (
        <Button
          variant="ghost"
          onClick={() => navigate(createPageUrl("Dashboard"))}
          className="mb-3 h-9 px-2 text-sm"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Zpět na podniky
        </Button>
      )}
      <h1 className="equipment-selection-title mb-2 text-xl font-bold text-foreground">Výběr linky - DEMIP</h1>
      {currentCompany && <p className="equipment-selection-description mb-4 text-sm text-muted-foreground">{currentCompany.name}</p>}
      <div className="equipment-selection-list space-y-2">
        {companyLines.map(line => (
          <DemipLineRow key={line.id} line={line} machines={demipMachines} points={demipControlPoints}
            getPointStatus={getPointStatus}
            onSelect={id => navigate(createPageUrl(selectedCompany
              ? `Dashboard?company=${selectedCompany}&line=${id}`
              : `Dashboard?line=${id}`))} />
        ))}
      </div>
    </div>
  );
}