import React from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import DemipPointRow from "@/components/dashboard/DemipPointRow";
import "@/components/dashboard/equipmentNavigation.css";

export default function PointsList({
  selectedCompany,
  selectedLine,
  selectedMachine,
  currentLine,
  currentMachine,
  machinePoints,
  activeTab,
  setActiveTab,
  records,
  demipIssues,
  getPointStatus,
  getNextControlDate,
}) {
  const navigate = useNavigate();
  const urlParams = new URLSearchParams(window.location.search);
  const categoryParam = urlParams.get('category') || (currentMachine?.maintenance_category || 'lubrication');

  const lubricationPoints = machinePoints.filter(p => p.type === "lubrication").sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
  const inspectionPoints = machinePoints.filter(p => p.type === "inspection").sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
  const preventionPoints = machinePoints.filter(p => p.type === "prevention").sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
  const lubricatorPoints = machinePoints.filter(p => p.type === "auto_lubricator").sort((a, b) => (a.order_index || 0) - (b.order_index || 0));

  const getDisplayPoints = () => {
    switch (activeTab) {
      case "lubrication": return lubricationPoints;
      case "inspection": return inspectionPoints;
      case "prevention": return preventionPoints;
      case "lubricator": return lubricatorPoints;
      default: return categoryParam === "prevention" ? preventionPoints : lubricationPoints;
      }
      };

      const displayPoints = getDisplayPoints();

      return (
      <div className="equipment-navigation equipment-selection-panel mx-auto w-full min-w-0 max-w-xl md:max-w-screen-2xl">
      <Button
        variant="ghost"
        onClick={() => {
          const category = categoryParam;
          const url = selectedCompany
            ? `Dashboard?company=${selectedCompany}&line=${selectedLine}&category=${category}`
            : `Dashboard?line=${selectedLine}&category=${category}`;
          navigate(createPageUrl(url));
        }}
        className="mb-3 h-9 px-2 text-sm"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Zpět na stroje
      </Button>

      <h1 className="equipment-selection-title mb-2 text-xl font-bold text-foreground [overflow-wrap:anywhere]">
        {currentMachine?.name || "Stroj"}
      </h1>
      <p className="mb-4 text-sm text-muted-foreground [overflow-wrap:anywhere]">{currentLine?.name || "Linka"}</p>

      <div className="mb-4 grid min-w-0 grid-cols-3 gap-1">
        {categoryParam === "prevention" ? (
          <Button
            onClick={() => setActiveTab("prevention")}
            variant={activeTab === "prevention" ? "default" : "outline"}
            className={`col-span-3 min-w-0 px-1 text-xs md:px-4 md:text-sm md:h-10 ${activeTab === "prevention" ? "bg-demip-brand text-demip-brand-foreground" : ""}`}
          >
            Prevence ({preventionPoints.length})
          </Button>
        ) : (
          <>
            <Button
              onClick={() => setActiveTab("lubrication")}
              variant={activeTab === "lubrication" ? "default" : "outline"}
              className={`min-w-0 px-1 text-xs md:px-4 md:text-sm md:h-10 ${activeTab === "lubrication" ? "bg-demip-brand text-demip-brand-foreground" : ""}`}
            >
              Mazání ({lubricationPoints.length})
            </Button>
            <Button
              onClick={() => setActiveTab("inspection")}
              variant={activeTab === "inspection" ? "default" : "outline"}
              className={`min-w-0 px-1 text-xs md:px-4 md:text-sm md:h-10 ${activeTab === "inspection" ? "bg-demip-brand text-demip-brand-foreground" : ""}`}
            >
              Inspekce ({inspectionPoints.length})
            </Button>
            <Button
              onClick={() => setActiveTab("lubricator")}
              variant={activeTab === "lubricator" ? "default" : "outline"}
              className={`min-w-0 px-1 text-xs md:px-4 md:text-sm md:h-10 ${activeTab === "lubricator" ? "bg-demip-brand text-demip-brand-foreground" : ""}`}
            >
              Maznice ({lubricatorPoints.length})
            </Button>
          </>
        )}
      </div>

      <div className="min-w-0">
          {displayPoints.length === 0 ? (
            <p className="rounded-lg border border-border bg-card p-4 text-center text-sm text-muted-foreground">Žádné body v této kategorii</p>
          ) : (
            <div className="equipment-selection-list space-y-2">
              {displayPoints.map((point) => {
                const pointRecords = records
                  .filter(r => r.control_point_id === point.id)
                  .sort((a, b) => new Date(b.performed_at) - new Date(a.performed_at));
                const lastRecord = pointRecords[0];

                const status = getPointStatus(point);
                const nextDate = getNextControlDate(point, pointRecords);
                const pointIssues = demipIssues.filter(i => i.control_point_id === point.id);
                return (
                  <DemipPointRow key={point.id} point={point} lastRecord={lastRecord} nextDate={nextDate}
                    status={status} hasIssues={pointIssues.length > 0}
                    onSelect={id => {
                      const url = selectedCompany
                        ? `Dashboard?company=${selectedCompany}&line=${selectedLine}&machine=${selectedMachine}&point=${id}&category=${categoryParam}`
                        : `Dashboard?line=${selectedLine}&machine=${selectedMachine}&point=${id}&category=${categoryParam}`;
                      navigate(createPageUrl(url));
                    }} />
                );
                })}
            </div>
          )}
      </div>
    </div>
  );
}