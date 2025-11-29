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

          let iconBg = "from-green-500 to-green-600";
          let statusBadge = null;

          if (lineOverdue > 0) {
            iconBg = "from-red-500 to-red-600";
            statusBadge = (
              <div className="flex items-center justify-center px-2 py-1 bg-red-100 rounded-full">
                <span className="text-xs font-bold text-red-600">{lineOverdue} !</span>
              </div>
            );
          } else if (lineWarning > 0) {
            iconBg = "from-yellow-500 to-yellow-600";
            statusBadge = (
              <div className="flex items-center justify-center px-2 py-1 bg-yellow-100 rounded-full">
                <span className="text-xs font-bold text-yellow-700">{lineWarning}</span>
              </div>
            );
          }

          return (
            <div
              key={line.id}
              className="group relative bg-white rounded-2xl p-4 shadow-sm border border-slate-100 active:scale-[0.98] transition-all cursor-pointer"
              onClick={() => {
                const url = selectedCompany
                  ? `Dashboard?company=${selectedCompany}&line=${line.id}`
                  : `Dashboard?line=${line.id}`;
                navigate(createPageUrl(url));
              }}
            >
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${iconBg} flex items-center justify-center shadow-lg text-white`}>
                  <Factory className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center mb-1">
                    <h3 className="font-bold text-slate-900 text-lg">{line.name}</h3>
                    {statusBadge}
                  </div>
                  <p className="text-sm text-slate-500 font-medium">
                    {lineMachines.length} strojů • {linePoints.length} bodů
                  </p>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-slate-500 transition-colors" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}