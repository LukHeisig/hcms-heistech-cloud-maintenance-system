import React from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Droplet, ClipboardCheck, AlertTriangle, ArrowLeft } from "lucide-react";
import { format } from "date-fns";
import { cs } from "date-fns/locale";

export default function PointsList({
  selectedCompany,
  selectedLine,
  selectedMachine,
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

  const lubricationPoints = machinePoints.filter(p => p.type === "lubrication");
  const inspectionPoints = machinePoints.filter(p => p.type === "inspection");
  const preventionPoints = machinePoints.filter(p => p.type === "prevention");
  const lubricatorPoints = machinePoints.filter(p => p.type === "auto_lubricator");

  const getDisplayPoints = () => {
    switch (activeTab) {
      case "lubrication": return lubricationPoints;
      case "inspection": return inspectionPoints;
      case "prevention": return preventionPoints;
      case "lubricator": return lubricatorPoints;
      default: return currentMachine?.maintenance_category === "prevention" ? preventionPoints : lubricationPoints;
    }
  };

  const displayPoints = getDisplayPoints();

  return (
    <div className="max-w-5xl mx-auto">
      <Button
        variant="ghost"
        onClick={() => {
          const category = currentMachine?.maintenance_category || 'lubrication';
          const url = selectedCompany
            ? `Dashboard?company=${selectedCompany}&line=${selectedLine}&category=${category}`
            : `Dashboard?line=${selectedLine}&category=${category}`;
          navigate(createPageUrl(url));
        }}
        className="mb-4"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Zpět na stroje
      </Button>

      <h1 className="text-3xl font-bold text-slate-900 mb-2">
        {currentMachine?.name || "Stroj"}
      </h1>
      <p className="text-slate-600 mb-6">{machinePoints.length} kontrolních bodů</p>

      <div className="flex gap-2 mb-6 overflow-x-auto">
        {currentMachine?.maintenance_category === "prevention" ? (
          <Button
            onClick={() => setActiveTab("prevention")}
            variant={activeTab === "prevention" ? "default" : "outline"}
            className={activeTab === "prevention" ? "bg-blue-600 text-white" : ""}
          >
            Prevence ({preventionPoints.length})
          </Button>
        ) : (
          <>
            <Button
              onClick={() => setActiveTab("lubrication")}
              variant={activeTab === "lubrication" ? "default" : "outline"}
              className={activeTab === "lubrication" ? "bg-blue-600 text-white" : ""}
            >
              Mazání ({lubricationPoints.length})
            </Button>
            <Button
              onClick={() => setActiveTab("inspection")}
              variant={activeTab === "inspection" ? "default" : "outline"}
              className={activeTab === "inspection" ? "bg-blue-600 text-white" : ""}
            >
              Inspekce ({inspectionPoints.length})
            </Button>
            <Button
              onClick={() => setActiveTab("lubricator")}
              variant={activeTab === "lubricator" ? "default" : "outline"}
              className={activeTab === "lubricator" ? "bg-blue-600 text-white" : ""}
            >
              Maznice ({lubricatorPoints.length})
            </Button>
          </>
        )}
      </div>

      <Card className="shadow-lg">
        <CardContent className="p-0">
          {displayPoints.length === 0 ? (
            <div className="p-12 text-center">
              <Droplet className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">Žádné body v této kategorii</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {displayPoints.map((point) => {
                const status = getPointStatus(point);
                const nextDate = getNextControlDate(point);
                const isOverdue = status === "overdue";
                const pointRecords = records.filter(r => r.control_point_id === point.id);
                const lastRecord = pointRecords[0];
                const pointIssues = demipIssues.filter(i => i.control_point_id === point.id);

                return (
                  <div
                    key={point.id}
                    className={`p-4 hover:bg-slate-50 transition-colors cursor-pointer ${
                      isOverdue ? "bg-yellow-50/50" : ""
                    }`}
                    onClick={() => {
                      const url = selectedCompany
                        ? `Dashboard?company=${selectedCompany}&line=${selectedLine}&machine=${selectedMachine}&point=${point.id}`
                        : `Dashboard?line=${selectedLine}&machine=${selectedMachine}&point=${point.id}`;
                      navigate(createPageUrl(url));
                    }}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                          isOverdue ? "bg-yellow-100" : "bg-green-100"
                        }`}>
                          {point.type === "inspection" || point.type === "prevention" ? (
                            <ClipboardCheck className={`w-4 h-4 ${isOverdue ? "text-yellow-700" : "text-green-700"}`} />
                          ) : (
                            <Droplet className={`w-4 h-4 ${isOverdue ? "text-yellow-700" : "text-green-700"}`} />
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-slate-900 text-sm">
                              {point.number && `${point.number} - `}{point.name}
                            </h3>
                            {pointIssues.length > 0 && (
                              <Badge className="bg-orange-500 text-white text-xs">
                                <AlertTriangle className="w-3 h-3 mr-1" />
                                Závada
                              </Badge>
                            )}
                          </div>

                          <div className="flex items-center gap-4 text-xs text-slate-600">
                            {point.interval_hours && (
                              <span>Interval: {point.interval_hours}h</span>
                            )}
                            {lastRecord && (
                              <>
                                <span>·</span>
                                <span>Poslední: {format(new Date(lastRecord.performed_at), "d.M. HH:mm", { locale: cs })}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {nextDate && (
                          <div className="text-right">
                            <p className="text-xs text-slate-500 mb-1">Následující kontrola</p>
                            <p className={`text-sm font-bold ${isOverdue ? "text-yellow-700" : "text-green-700"}`}>
                              {format(nextDate, "d.M. yyyy", { locale: cs })}
                            </p>
                          </div>
                        )}

                        <div className={`w-3 h-3 rounded-full flex-shrink-0 ${
                          isOverdue ? "bg-yellow-500" : "bg-green-500"
                        }`} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}