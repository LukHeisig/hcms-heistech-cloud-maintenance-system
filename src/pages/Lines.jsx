import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useViewMode } from "@/components/ViewModeContext";
import {
  Factory,
  Droplet,
  Clock,
  AlertTriangle,
  ChevronRight,
  Filter,
  Building2,
  Loader2,
  Info,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format } from "date-fns";
import { cs } from "date-fns/locale";

export default function Lines() {
  const [user, setUser] = useState(null);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [selectedLine, setSelectedLine] = useState(null);
  const [filterStatus, setFilterStatus] = useState("all");
  const { viewMode } = useViewMode();

  const navigate = useNavigate();

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
    if (currentUser && currentUser.company_id && currentUser.user_type !== "admin" && currentUser.user_type !== "superAdmin") {
      setSelectedCompany(currentUser.company_id);
    }
  };

  // Pro admina načíst všechny podniky
  const { data: allCompanies = [] } = useQuery({
    queryKey: ["companies"],
    queryFn: () => base44.entities.Company.list("name"),
    enabled: user?.user_type === "admin" || user?.user_type === "superAdmin",
  });

  // Filtrovat podniky podle přístupových práv
  const companies = useMemo(() => {
    if (!user) return [];
    if (user.user_type === "superAdmin") return allCompanies;
    if (user.user_type === "admin") {
      return allCompanies.filter(c => 
        user.assigned_company_ids?.includes(c.id)
      );
    }
    return [];
  }, [allCompanies, user]);

  // Načíst VŠECHNY linky pro admina (pro statistiky)
  const { data: allLines = [] } = useQuery({
    queryKey: ["allLines"],
    queryFn: () => base44.entities.Line.list("order_index", 1000),
    enabled: user?.user_type === "admin" || user?.user_type === "superAdmin",
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
    const overdue = machinePoints.some((p) => getPointStatus(p) === "overdue");
    return overdue ? "overdue" : "ok";
  };

  const filteredMachines = machines.filter((machine) => {
    if (filterStatus === "all") return true;
    return getMachineStatus(machine) === filterStatus;
  });

  const handleLineClick = (line) => {
    if (viewMode === 'maintenance') {
      // V režimu údržba jít rovnou na kartu linky
      navigate(createPageUrl(`LineDetail?id=${line.id}${selectedCompany ? `&company=${selectedCompany}` : ''}`));
    } else {
      // V režimu DEMIP zobrazit hierarchii strojů
      setSelectedLine(line.id);
    }
  };

  // Admin - výběr podniku
  if ((user?.user_type === "admin" || user?.user_type === "superAdmin") && !selectedCompany) {
    return (
      <div className="p-4 md:p-8 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold text-slate-900 mb-6">Výběr podniku</h1>
          <div className="space-y-2">
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

              // Určit celkový stav podniku
              const hasOverdue = companyOverdue > 0;
              const companyStatus = hasOverdue ? "overdue" : "ok";

              return (
                <Card
                  key={company.id}
                  className={`cursor-pointer transition-all hover:shadow-md border-l-4 ${
                    companyStatus === "overdue"
                      ? "border-l-yellow-500 bg-yellow-50/50"
                      : "border-l-green-500 bg-green-50/50"
                  }`}
                  onClick={() => setSelectedCompany(company.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 flex-1">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                          companyStatus === "overdue" ? "bg-yellow-100" : "bg-green-100"
                        }`}>
                          <Building2 className={`w-5 h-5 ${companyStatus === "overdue" ? "text-yellow-700" : "text-green-700"}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-bold text-slate-900 text-base">
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
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${
                          companyStatus === "overdue"
                            ? "bg-yellow-500"
                            : "bg-green-500"
                        }`} />
                        <ChevronRight className="w-5 h-5 text-slate-400" />
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
  if (!selectedLine || viewMode === 'maintenance') {
    const currentCompany = companies.find((c) => c.id === selectedCompany);
    
    return (
      <div className="p-4 md:p-8 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
        <div className="max-w-4xl mx-auto">
          {(user?.user_type === "admin" || user?.user_type === "superAdmin") && (
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

          <div className="space-y-2">
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

              // Určit stav linky podle bodů
              const lineStatus = hasOverdue ? "overdue" : "ok";

              return (
                <Card
                  key={line.id}
                  className={`transition-all hover:shadow-md border-l-4 cursor-pointer ${
                    lineStatus === "overdue"
                      ? "border-l-yellow-500 bg-yellow-50/50"
                      : "border-l-green-500 bg-green-50/50"
                  }`}
                  onClick={() => handleLineClick(line)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 flex-1">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                          lineStatus === "overdue" ? "bg-yellow-100" : "bg-green-100"
                        }`}>
                          <Factory className={`w-5 h-5 ${lineStatus === "overdue" ? "text-yellow-700" : "text-green-700"}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <h3 className="font-bold text-slate-900 text-base">
                              {line.name}
                            </h3>
                            {hasOverdue && (
                              <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-300">
                                <Clock className="w-3 h-3 mr-1" />
                                Po termínu
                              </Badge>
                            )}
                            {lineIssuesCount > 0 && (
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
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${
                          lineStatus === "overdue"
                            ? "bg-yellow-500"
                            : "bg-green-500"
                        }`} />
                        <ChevronRight className="w-5 h-5 text-slate-400 flex-shrink-0" />
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

  // Seznam strojů (pouze v režimu DEMIP)
  const currentLine = lines.find((l) => l.id === selectedLine);
  const currentCompany = companies.find((c) => c.id === selectedCompany);

  return (
    <div className="p-4 md:p-8 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => setSelectedLine(null)}
            className="mb-4"
          >
            ← Zpět na linky
          </Button>

          {/* Breadcrumbs */}
          <div className="flex items-center gap-2 text-sm text-slate-600 mb-4 flex-wrap">
            <Building2 className="w-4 h-4" />
            <button
              onClick={() => {
                setSelectedLine(null);
                setSelectedCompany(null);
              }}
              className="hover:text-slate-900 transition-colors"
            >
              {currentCompany?.name || "Podnik"}
            </button>
            <ChevronRight className="w-4 h-4" />
            <button
              onClick={() => setSelectedLine(null)}
              className="hover:text-slate-900 transition-colors"
            >
              {currentLine?.name || "Linka"}
            </button>
            <ChevronRight className="w-4 h-4" />
            <span className="font-semibold text-slate-900">Stroje</span>
          </div>

          <h1 className="text-3xl font-bold text-slate-900">
            {currentLine?.name}
          </h1>
          <p className="text-slate-600 mt-1">
            {filteredMachines.length} strojů
          </p>
        </div>

        {/* Filter */}
        <div className="flex items-center justify-end mb-6">
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-48">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Vše</SelectItem>
              <SelectItem value="overdue">Po termínu</SelectItem>
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
                onClick={() => navigate(createPageUrl(`Machine?id=${machine.id}`))}
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
      </div>
    </div>
  );
}