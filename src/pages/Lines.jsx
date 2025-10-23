
import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, Link } from "react-router-dom"; // Added useNavigate
import { createPageUrl } from "@/utils";
import {
  Factory,
  Droplet,
  Clock,
  AlertTriangle,
  ChevronRight,
  Filter,
  Building2,
  ClipboardCheck // Added ClipboardCheck icon
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"; // Added Dialog components
import { format } from "date-fns"; // Added format for date formatting
import { cs } from "date-fns/locale"; // Added Czech locale

export default function Lines() {
  const [user, setUser] = useState(null);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [selectedLine, setSelectedLine] = useState(null);
  const [filterStatus, setFilterStatus] = useState("all");
  const [selectedMachine, setSelectedMachine] = useState(null); // New state for selected machine in dialog
  const [showMachineDialog, setShowMachineDialog] = useState(false); // New state for dialog visibility

  const navigate = useNavigate(); // Initialize useNavigate

  useEffect(() => {
    loadUser();
    const urlParams = new URLSearchParams(window.location.search);
    const companyParam = urlParams.get("company");
    const lineParam = urlParams.get("line");
    if (companyParam) setSelectedCompany(companyParam);
    if (lineParam) setSelectedLine(lineParam);
  }, []);

  const loadUser = async () => {
    const currentUser = await base44.auth.me();
    setUser(currentUser);
    
    // Pro non-admin uživatele nastavit company_id automaticky
    if (currentUser && currentUser.company_id && currentUser.user_type !== "admin") {
      setSelectedCompany(currentUser.company_id);
    }
  };

  // Pro admina načíst všechny podniky
  const { data: companies = [] } = useQuery({
    queryKey: ["companies"],
    queryFn: () => base44.entities.Company.list("name"),
    enabled: user?.user_type === "admin",
  });

  // Načíst VŠECHNY linky pro admina (pro statistiky)
  const { data: allLines = [] } = useQuery({
    queryKey: ["allLines"],
    queryFn: () => base44.entities.Line.list(),
    enabled: user?.user_type === "admin",
  });

  // Linky pro vybraný podnik
  const { data: lines = [] } = useQuery({
    queryKey: ["lines", selectedCompany],
    queryFn: () =>
      selectedCompany
        ? base44.entities.Line.filter({ company_id: selectedCompany }, "order_index")
        : [],
    enabled: !!selectedCompany,
  });

  const { data: allMachines = [] } = useQuery({
    queryKey: ["allMachines"],
    queryFn: () => base44.entities.Machine.list("order_index"),
  });

  const machines = selectedLine 
    ? allMachines.filter(m => m.line_id === selectedLine)
    : [];

  const { data: controlPoints = [] } = useQuery({
    queryKey: ["controlPoints"],
    queryFn: () => base44.entities.ControlPoint.list(),
  });

  const { data: records = [] } = useQuery({
    queryKey: ["records"],
    queryFn: () => base44.entities.ControlRecord.list("-performed_at"),
  });

  const { data: issues = [] } = useQuery({
    queryKey: ["issues"],
    queryFn: () => base44.entities.Issue.filter({ status: "reported" }),
  });

  const getPointStatus = (point) => {
    const pointRecords = records.filter((r) => r.control_point_id === point.id);
    if (pointRecords.length === 0) return "overdue";

    const latestRecord = pointRecords[0];
    const lastPerformed = new Date(latestRecord.performed_at);
    const now = new Date();
    const hoursSince = (now - lastPerformed) / (1000 * 60 * 60);

    return hoursSince > point.interval_hours ? "overdue" : "ok";
  };

  const getMachineStatus = (machine) => {
    const machinePoints = controlPoints.filter((p) => p.machine_id === machine.id);
    // Removed the "issue" status as per requirement to not color based on it
    const overdue = machinePoints.some((p) => getPointStatus(p) === "overdue");
    return overdue ? "overdue" : "ok";
  };

  const filteredMachines = machines.filter((machine) => {
    if (filterStatus === "all") return true;
    // The `issue` status is no longer returned by getMachineStatus, so this implicitly handles it.
    // If a machine has issues but is not overdue, its status will be 'ok'.
    return getMachineStatus(machine) === filterStatus;
  });

  // Admin - výběr podniku
  if (user?.user_type === "admin" && !selectedCompany) {
    return (
      <div className="p-4 md:p-8 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold text-slate-900 mb-6">Výběr podniku</h1>
          <div className="space-y-4">
            {companies.map((company) => {
              // Použít allLines místo lines
              const companyLines = allLines.filter((l) => l.company_id === company.id);
              const companyLineIds = companyLines.map(l => l.id);
              
              // Stroje z těchto linek
              const companyMachines = allMachines.filter((m) =>
                companyLineIds.includes(m.line_id)
              );
              const companyMachineIds = companyMachines.map(m => m.id);
              
              // Kontrolní body z těchto strojů
              const companyPoints = controlPoints.filter((p) =>
                companyMachineIds.includes(p.machine_id)
              );
              
              // Počítat po termínu
              const companyOverdue = companyPoints.filter(
                (p) => getPointStatus(p) === "overdue"
              ).length;
              
              // Počítat závady
              const companyIssues = issues.filter((issue) =>
                companyPoints.some((p) => p.id === issue.control_point_id)
              ).length;

              // Určit celkový stav podniku (bez oranžové) - keeping original logic for company status
              const hasOverdue = companyOverdue > 0;
              const companyStatus = hasOverdue ? "overdue" : "ok";

              return (
                <Card
                  key={company.id}
                  className={`hover:shadow-lg transition-all cursor-pointer border-2 ${
                    companyStatus === "overdue"
                      ? "border-yellow-300 bg-yellow-50 hover:border-yellow-400"
                      : "border-transparent hover:border-red-200"
                  }`}
                  onClick={() => setSelectedCompany(company.id)}
                >
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 flex-1">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0 ${
                          companyStatus === "overdue"
                            ? "bg-gradient-to-br from-yellow-600 to-yellow-700"
                            : "bg-gradient-to-br from-red-600 to-red-700"
                        }`}>
                          <Building2 className="w-7 h-7 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-xl font-bold text-slate-900">
                              {company.name}
                            </h3>
                            {companyOverdue > 0 && (
                              <Badge variant="destructive" className="gap-1">
                                <Clock className="w-3 h-3" />
                                {companyOverdue}
                              </Badge>
                            )}
                            {companyIssues > 0 && (
                              <Badge className="bg-orange-500 text-white gap-1">
                                <AlertTriangle className="w-3 h-3" />
                                {companyIssues}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-4 text-sm text-slate-600">
                            <span className="flex items-center gap-1">
                              <Factory className="w-4 h-4" />
                              {companyLines.length} linek
                            </span>
                            <span className="flex items-center gap-1">
                              <Factory className="w-4 h-4" />
                              {companyMachines.length} strojů
                            </span>
                            <span className="flex items-center gap-1">
                              <Droplet className="w-4 h-4" />
                              {companyPoints.length} bodů
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className={`w-4 h-4 rounded-full ${
                          companyStatus === "overdue"
                            ? "bg-yellow-500"
                            : "bg-green-500"
                        }`} />
                        <ChevronRight className="w-6 h-6 text-slate-400" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // Výběr linky (pro všechny po výběru podniku)
  if (!selectedLine) {
    const currentCompany = companies.find((c) => c.id === selectedCompany);
    
    return (
      <div className="p-4 md:p-8 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
        <div className="max-w-4xl mx-auto">
          {user?.user_type === "admin" && (
            <Button
              variant="ghost"
              onClick={() => setSelectedCompany(null)}
              className="mb-4"
            >
              ← Zpět na podniky
            </Button>
          )}
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Výběr linky</h1>
          {currentCompany && (
            <p className="text-slate-600 mb-6">{currentCompany.name}</p>
          )}
          <div className="space-y-4">
            {lines.map((line) => {
              const lineMachines = allMachines.filter((m) => m.line_id === line.id);
              const lineMachineIds = lineMachines.map(m => m.id);
              
              const linePoints = controlPoints.filter((p) =>
                lineMachineIds.includes(p.machine_id)
              );
              
              const hasOverdue = linePoints.some((p) => getPointStatus(p) === "overdue");
              const lineIssuesCount = issues.filter((issue) =>
                linePoints.some((p) => p.id === issue.control_point_id)
              ).length;

              // Určit stav linky podle bodů - lineStatus only reflects overdue or ok, not issues
              const lineStatus = hasOverdue ? "overdue" : "ok";

              return (
                <Card
                  key={line.id}
                  className={`hover:shadow-lg transition-all cursor-pointer border-2 ${
                    lineStatus === "overdue"
                      ? "border-yellow-300 bg-yellow-50 hover:border-yellow-400"
                      : "border-transparent hover:border-red-200"
                  }`}
                  onClick={() => setSelectedLine(line.id)}
                >
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 flex-1">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0 ${
                          lineStatus === "overdue"
                            ? "bg-gradient-to-br from-yellow-600 to-yellow-700"
                            : "bg-gradient-to-br from-red-600 to-red-700"
                        }`}>
                          <Factory className="w-7 h-7 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <h3 className="text-xl font-bold text-slate-900">
                              {line.name}
                            </h3>
                            {hasOverdue && (
                              <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-300">
                                <Clock className="w-3 h-3 mr-1" />
                                Po termínu
                              </Badge>
                            )}
                            {lineIssuesCount > 0 && ( // Issue badge remains
                              <Badge className="bg-orange-500 text-white">
                                <AlertTriangle className="w-3 h-3 mr-1" />
                                {lineIssuesCount}
                              </Badge>
                            )}
                          </div>
                          {line.description && (
                            <p className="text-sm text-slate-600 mb-2">
                              {line.description}
                            </p>
                          )}
                          <div className="flex items-center gap-4 text-sm text-slate-600">
                            <span className="flex items-center gap-1">
                              <Factory className="w-4 h-4" />
                              {lineMachines.length} strojů
                            </span>
                            <span className="flex items-center gap-1">
                              <Droplet className="w-4 h-4" />
                              {linePoints.length} bodů
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className={`w-4 h-4 rounded-full ${
                          lineStatus === "overdue"
                            ? "bg-yellow-500"
                            : "bg-green-500"
                        }`} />
                        <ChevronRight className="w-6 h-6 text-slate-400 flex-shrink-0" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  const currentLine = lines.find((l) => l.id === selectedLine);

  return (
    <div className="p-4 md:p-8 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <Button
              variant="ghost"
              onClick={() => setSelectedLine(null)}
              className="mb-2"
            >
              ← Zpět na linky
            </Button>
            <h1 className="text-3xl font-bold text-slate-900">
              {currentLine?.name}
            </h1>
            <p className="text-slate-600 mt-1">
              {filteredMachines.length} strojů
            </p>
          </div>

          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-48">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Vše</SelectItem>
              <SelectItem value="overdue">Po termínu</SelectItem>
              {/* Removed "Se závadou" filter option as card styling no longer depends on it directly */}
              <SelectItem value="ok">V pořádku</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Stroje - miniaturní zobrazení */}
        <div className="space-y-2">
          {filteredMachines.map((machine) => {
            const machinePoints = controlPoints.filter(
              (p) => p.machine_id === machine.id
            );
            const status = getMachineStatus(machine);
            const overdueCount = machinePoints.filter(
              (p) => getPointStatus(p) === "overdue"
            ).length;
            const issueCount = issues.filter((issue) =>
              machinePoints.some((p) => p.id === issue.control_point_id)
            ).length;

            return (
              <Card
                key={machine.id}
                className={`cursor-pointer transition-all hover:shadow-md border-l-4 ${
                  status === "overdue" 
                    ? "border-l-yellow-500 bg-yellow-50/50"
                    : "border-l-green-500 bg-green-50/50"
                }`}
                onClick={() => {
                  setSelectedMachine(machine);
                  setShowMachineDialog(true);
                }}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 flex-1">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        status === "overdue" ? "bg-yellow-100" : "bg-green-100"
                      }`}>
                        <Factory className={`w-5 h-5 ${status === "overdue" ? "text-yellow-700" : "text-green-700"}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-bold text-slate-900 text-base">
                            {machine.name}
                          </h3>
                          {overdueCount > 0 && (
                            <Badge variant="destructive" className="gap-1">
                              <Clock className="w-3 h-3" />
                              {overdueCount}
                            </Badge>
                          )}
                          {issueCount > 0 && (
                            <Badge className="bg-orange-500 text-white gap-1">
                              <AlertTriangle className="w-3 h-3" />
                              {issueCount}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-slate-600">
                          <span className="flex items-center gap-1">
                            <Droplet className="w-4 h-4" />
                            {machinePoints.filter((p) => p.type === "lubrication").length} mazání
                          </span>
                          <span className="flex items-center gap-1">
                            <Droplet className="w-4 h-4" />
                            {machinePoints.filter((p) => p.type === "inspection").length} inspekcí
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${
                        status === "overdue" ? "bg-yellow-500" : "bg-green-500"
                      }`} />
                      <ChevronRight className="w-5 h-5 text-slate-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Dialog s detailem stroje */}
        <Dialog open={showMachineDialog} onOpenChange={setShowMachineDialog}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            {selectedMachine && (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-3 text-2xl">
                    <Factory className="w-6 h-6" />
                    {selectedMachine.name}
                  </DialogTitle>
                  {selectedMachine.description && (
                    <DialogDescription className="text-base">
                      {selectedMachine.description}
                    </DialogDescription>
                  )}
                </DialogHeader>

                <div className="space-y-6 py-4">
                  {/* Kontrolní body stroje */}
                  {(() => {
                    const machinePoints = controlPoints.filter(
                      (p) => p.machine_id === selectedMachine.id
                    );
                    const lubricationPoints = machinePoints.filter(p => p.type === "lubrication");
                    const inspectionPoints = machinePoints.filter(p => p.type === "inspection");
                    const lubricatorPoints = machinePoints.filter(p => p.type === "auto_lubricator");

                    return (
                      <>
                        {/* Mazací body */}
                        {lubricationPoints.length > 0 && (
                          <div>
                            <h3 className="text-lg font-semibold text-slate-900 mb-3 flex items-center gap-2">
                              <Droplet className="w-5 h-5 text-blue-600" />
                              Mazání ({lubricationPoints.length})
                            </h3>
                            <div className="space-y-2">
                              {lubricationPoints.map((point) => {
                                const status = getPointStatus(point);
                                const pointRecords = records.filter(r => r.control_point_id === point.id);
                                const pointIssues = issues.filter(i => i.control_point_id === point.id && i.status === "reported");

                                return (
                                  <div
                                    key={point.id}
                                    className={`p-3 rounded-lg border-l-4 ${
                                      status === "overdue" 
                                        ? "border-l-yellow-500 bg-yellow-50"
                                        : "border-l-green-500 bg-green-50"
                                    }`}
                                  >
                                    <div className="flex items-start justify-between">
                                      <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                          <p className="font-semibold text-slate-900">
                                            {point.number && `${point.number} - `}{point.name}
                                          </p>
                                          {status === "overdue" && (
                                            <Badge variant="outline" className="gap-1 bg-yellow-100 text-yellow-800 border-yellow-300 text-xs">
                                              <Clock className="w-3 h-3" />
                                              Po termínu
                                            </Badge>
                                          )}
                                          {pointIssues.length > 0 && (
                                            <Badge className="bg-orange-500 gap-1 text-xs">
                                              <AlertTriangle className="w-3 h-3" />
                                              {pointIssues.length}
                                            </Badge>
                                          )}
                                        </div>
                                        <div className="flex items-center gap-3 text-xs text-slate-600">
                                          {point.lubricant_type && (
                                            <span>Mazivo: {point.lubricant_type}</span>
                                          )}
                                          {point.lubricant_amount && (
                                            <span>· {point.lubricant_amount}g</span>
                                          )}
                                          {point.interval_hours && (
                                            <span>· {point.interval_hours}h</span>
                                          )}
                                        </div>
                                        {pointRecords.length > 0 && (
                                          <p className="text-xs text-slate-500 mt-1">
                                            Poslední: {format(new Date(pointRecords[0].performed_at), "d.M. HH:mm", { locale: cs })}
                                          </p>
                                        )}
                                      </div>
                                      <div className={`w-3 h-3 rounded-full flex-shrink-0 ${
                                        status === "overdue" ? "bg-yellow-500" : "bg-green-500"
                                      }`} />
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Inspekční body */}
                        {inspectionPoints.length > 0 && (
                          <div>
                            <h3 className="text-lg font-semibold text-slate-900 mb-3 flex items-center gap-2">
                              <ClipboardCheck className="w-5 h-5 text-purple-600" />
                              Inspekce ({inspectionPoints.length})
                            </h3>
                            <div className="space-y-2">
                              {inspectionPoints.map((point) => {
                                const status = getPointStatus(point);
                                const pointRecords = records.filter(r => r.control_point_id === point.id);
                                const pointIssues = issues.filter(i => i.control_point_id === point.id && i.status === "reported");

                                return (
                                  <div
                                    key={point.id}
                                    className={`p-3 rounded-lg border-l-4 ${
                                      status === "overdue" 
                                        ? "border-l-yellow-500 bg-yellow-50"
                                        : "border-l-green-500 bg-green-50"
                                    }`}
                                  >
                                    <div className="flex items-start justify-between">
                                      <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                          <p className="font-semibold text-slate-900">
                                            {point.number && `${point.number} - `}{point.name}
                                          </p>
                                          {status === "overdue" && (
                                            <Badge variant="outline" className="gap-1 bg-yellow-100 text-yellow-800 border-yellow-300 text-xs">
                                              <Clock className="w-3 h-3" />
                                              Po termínu
                                            </Badge>
                                          )}
                                          {pointIssues.length > 0 && (
                                            <Badge className="bg-orange-500 gap-1 text-xs">
                                              <AlertTriangle className="w-3 h-3" />
                                              {pointIssues.length}
                                            </Badge>
                                          )}
                                        </div>
                                        {point.interval_hours && (
                                          <p className="text-xs text-slate-600">
                                            Interval: {point.interval_hours}h
                                          </p>
                                        )}
                                        {pointRecords.length > 0 && (
                                          <p className="text-xs text-slate-500 mt-1">
                                            Poslední: {format(new Date(pointRecords[0].performed_at), "d.M. HH:mm", { locale: cs })}
                                          </p>
                                        )}
                                      </div>
                                      <div className={`w-3 h-3 rounded-full flex-shrink-0 ${
                                        status === "overdue" ? "bg-yellow-500" : "bg-green-500"
                                      }`} />
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Maznice */}
                        {lubricatorPoints.length > 0 && (
                          <div>
                            <h3 className="text-lg font-semibold text-slate-900 mb-3 flex items-center gap-2">
                              <Droplet className="w-5 h-5 text-indigo-600" />
                              Automatické maznice ({lubricatorPoints.length})
                            </h3>
                            <div className="space-y-2">
                              {lubricatorPoints.map((point) => {
                                const status = getPointStatus(point);
                                const pointRecords = records.filter(r => r.control_point_id === point.id);

                                return (
                                  <div
                                    key={point.id}
                                    className={`p-3 rounded-lg border-l-4 ${
                                      status === "overdue" 
                                        ? "border-l-yellow-500 bg-yellow-50"
                                        : "border-l-green-500 bg-green-50"
                                    }`}
                                  >
                                    <div className="flex items-start justify-between">
                                      <div className="flex-1">
                                        <p className="font-semibold text-slate-900 mb-1">
                                          {point.number && `${point.number} - `}{point.name}
                                        </p>
                                        {pointRecords.length > 0 && (
                                          <p className="text-xs text-slate-500">
                                            Poslední výměna: {format(new Date(pointRecords[0].performed_at), "d.M. yyyy", { locale: cs })}
                                          </p>
                                        )}
                                      </div>
                                      <div className={`w-3 h-3 rounded-full flex-shrink-0 ${
                                        status === "overdue" ? "bg-yellow-500" : "bg-green-500"
                                      }`} />
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>

                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setShowMachineDialog(false)}
                  >
                    Zavřít
                  </Button>
                  <Button
                    onClick={() => {
                      navigate(createPageUrl(`Machine?id=${selectedMachine.id}`));
                    }}
                    className="bg-gradient-to-r from-red-600 to-red-700"
                  >
                    <Factory className="w-4 h-4 mr-2" />
                    Detail stroje
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
