
import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  Factory,
  Droplet,
  Clock,
  AlertTriangle,
  ChevronRight,
  Filter
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

export default function Lines() {
  const [user, setUser] = useState(null);
  const [selectedLine, setSelectedLine] = useState(null);
  const [filterStatus, setFilterStatus] = useState("all");

  useEffect(() => {
    loadUser();
    const urlParams = new URLSearchParams(window.location.search);
    const lineParam = urlParams.get("line");
    if (lineParam) setSelectedLine(lineParam);
  }, []);

  const loadUser = async () => {
    const currentUser = await base44.auth.me();
    setUser(currentUser);
  };

  const { data: lines = [] } = useQuery({
    queryKey: ["lines", user?.customer_id],
    queryFn: () =>
      user?.customer_id
        ? base44.entities.Line.filter({ customer_id: user.customer_id }, "order_index")
        : [],
    enabled: !!user?.customer_id,
  });

  // Načíst VŠECHNY stroje (ne jen pro vybranou linku)
  const { data: allMachines = [] } = useQuery({
    queryKey: ["allMachines"],
    queryFn: () => base44.entities.Machine.list("order_index"),
  });

  // Filtrované stroje pro vybranou linku
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
    const machineIssues = issues.filter((issue) =>
      machinePoints.some((p) => p.id === issue.control_point_id)
    );

    if (machineIssues.length > 0) return "issue";

    const overdue = machinePoints.some((p) => getPointStatus(p) === "overdue");
    return overdue ? "overdue" : "ok";
  };

  const filteredMachines = machines.filter((machine) => {
    if (filterStatus === "all") return true;
    return getMachineStatus(machine) === filterStatus;
  });

  if (!selectedLine) {
    return (
      <div className="p-4 md:p-8 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold text-slate-900 mb-6">Výběr linky</h1>
          <div className="space-y-4">
            {lines.map((line) => {
              // Spočítat stroje pro tuto linku z VŠECH strojů
              const lineMachines = allMachines.filter((m) => m.line_id === line.id);
              const lineMachineIds = lineMachines.map(m => m.id);
              
              // Kontrolní body pro stroje této linky
              const linePoints = controlPoints.filter((p) =>
                lineMachineIds.includes(p.machine_id)
              );
              
              // Kontrola stavu
              const hasOverdue = linePoints.some((p) => getPointStatus(p) === "overdue");
              const lineIssues = issues.filter((issue) =>
                linePoints.some((p) => p.id === issue.control_point_id)
              );

              return (
                <Card
                  key={line.id}
                  className="hover:shadow-lg transition-all cursor-pointer border-2 border-transparent hover:border-red-200"
                  onClick={() => setSelectedLine(line.id)}
                >
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 flex-1">
                        <div className="w-12 h-12 bg-gradient-to-br from-red-600 to-red-700 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
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
                            {lineIssues.length > 0 && (
                              <Badge className="bg-orange-500">
                                <AlertTriangle className="w-3 h-3 mr-1" />
                                {lineIssues.length}
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
                      <ChevronRight className="w-6 h-6 text-slate-400 flex-shrink-0 ml-4" />
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
              <SelectItem value="issue">Se závadou</SelectItem>
              <SelectItem value="ok">V pořádku</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Stroje */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
              <Link
                key={machine.id}
                to={createPageUrl(`Machine?id=${machine.id}`)}
              >
                <Card
                  className={`hover:shadow-lg transition-all border-2 ${
                    status === "issue"
                      ? "border-orange-300 bg-orange-50"
                      : status === "overdue"
                      ? "border-red-300 bg-red-50"
                      : "border-transparent hover:border-slate-200"
                  }`}
                >
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <h3 className="text-lg font-bold text-slate-900 mb-2">
                          {machine.name}
                        </h3>
                        <div className="flex items-center gap-2 flex-wrap">
                          {overdueCount > 0 && (
                            <Badge variant="destructive" className="gap-1">
                              <Clock className="w-3 h-3" />
                              {overdueCount}
                            </Badge>
                          )}
                          {issueCount > 0 && (
                            <Badge className="bg-orange-100 text-orange-700 gap-1">
                              <AlertTriangle className="w-3 h-3" />
                              {issueCount}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex-shrink-0">
                        {status === "issue" ? (
                          <div className="w-4 h-4 rounded-full bg-orange-500" />
                        ) : status === "overdue" ? (
                          <div className="w-4 h-4 rounded-full bg-red-500" />
                        ) : (
                          <div className="w-4 h-4 rounded-full bg-green-500" />
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-slate-600">
                      <span className="flex items-center gap-1">
                        <Droplet className="w-4 h-4" />
                        {machinePoints.filter((p) => p.type === "lubrication").length}{" "}
                        mazání
                      </span>
                      <span className="flex items-center gap-1">
                        <Droplet className="w-4 h-4" />
                        {machinePoints.filter((p) => p.type === "inspection").length}{" "}
                        inspekcí
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
