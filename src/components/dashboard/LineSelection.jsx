import React from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Factory, Clock, ChevronRight, ArrowLeft } from "lucide-react";

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
    <div className="max-w-4xl mx-auto">
      {(user?.user_type === "admin" || user?.user_type === "superAdmin") && (
        <Button
          variant="ghost"
          onClick={() => navigate(createPageUrl("Dashboard"))}
          className="mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Zpět na podniky
        </Button>
      )}
      <h1 className="text-3xl font-bold text-slate-900 mb-2">Výběr linky - DEMIP</h1>
      {currentCompany && <p className="text-slate-600 mb-6">{currentCompany.name}</p>}
      <div className="space-y-2">
        {companyLines.map((line) => {
          const lineMachines = demipMachines.filter(m => m.line_id === line.id);
          const lineMachineIds = lineMachines.map(m => m.id);
          const linePoints = demipControlPoints.filter(p => lineMachineIds.includes(p.machine_id));
          const lineOverdue = linePoints.filter(p => {
            const s = getPointStatus(p);
            return s === "overdue" || s === "critical";
          }).length;
          const lineWarning = linePoints.filter(p => getPointStatus(p) === "warning").length;

          let statusColor = "border-l-green-500";
          let bgClass = "bg-white";
          let iconBg = "bg-green-100";
          let iconColor = "text-green-700";

          if (lineOverdue > 0) {
            statusColor = "border-l-red-500";
            bgClass = "bg-red-50/30";
            iconBg = "bg-red-100";
            iconColor = "text-red-700";
          } else if (lineWarning > 0) {
            statusColor = "border-l-yellow-500";
            bgClass = "bg-yellow-50/30";
            iconBg = "bg-yellow-100";
            iconColor = "text-yellow-700";
          }

          return (
            <Card
              key={line.id}
              className={`cursor-pointer transition-all hover:shadow-md border-l-4 ${statusColor} ${bgClass}`}
              onClick={() => {
                const url = selectedCompany
                  ? `Dashboard?company=${selectedCompany}&line=${line.id}`
                  : `Dashboard?line=${line.id}`;
                navigate(createPageUrl(url));
              }}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 flex-1">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${iconBg}`}>
                      <Factory className={`w-5 h-5 ${iconColor}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold text-slate-900 text-base">{line.name}</h3>
                        {lineOverdue > 0 && (
                          <Badge variant="destructive" className="gap-1">
                            <Clock className="w-3 h-3" />
                            {lineOverdue}
                          </Badge>
                        )}
                        {lineWarning > 0 && lineOverdue === 0 && (
                          <Badge className="gap-1 bg-yellow-500 hover:bg-yellow-600 text-white">
                            <Clock className="w-3 h-3" />
                            {lineWarning}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-slate-600">
                        <span>{lineMachines.length} strojů</span>
                        <span>·</span>
                        <span>{linePoints.length} bodů</span>
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-400" />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}