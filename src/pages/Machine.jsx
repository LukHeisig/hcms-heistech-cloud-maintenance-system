
import React, { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  Droplet,
  Clock,
  AlertTriangle,
  CheckCircle,
  Image as ImageIcon,
  Loader2,
  ClipboardCheck,
  ChevronRight,
  LayoutDashboard,
  Settings,
  Package,
  TrendingUp,
  Users,
  BarChart2,
  FileText,
  Wrench,
  Activity,
  Building2,
  Factory
} from "lucide-react";
import { format } from "date-fns";
import { cs } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar
} from "recharts";

export default function Machine() {
  const navigate = useNavigate();
  const urlParams = new URLSearchParams(window.location.search);
  const machineId = urlParams.get("id");

  const { data: machine } = useQuery({
    queryKey: ["machine", machineId],
    queryFn: async () => {
      const machines = await base44.entities.Machine.list();
      return machines.find(m => m.id === machineId);
    },
    enabled: !!machineId,
  });

  const { data: line } = useQuery({
    queryKey: ["line", machine?.line_id],
    queryFn: async () => {
      if (!machine?.line_id) return null;
      const lines = await base44.entities.Line.list();
      return lines.find(l => l.id === machine.line_id);
    },
    enabled: !!machine?.line_id,
  });

  const { data: company } = useQuery({
    queryKey: ["company", line?.company_id],
    queryFn: async () => {
      if (!line?.company_id) return null;
      const companies = await base44.entities.Company.list();
      return companies.find(c => c.id === line.company_id);
    },
    enabled: !!line?.company_id,
  });

  const { data: controlPoints = [] } = useQuery({
    queryKey: ["controlPoints", machineId],
    queryFn: () => base44.entities.ControlPoint.filter({ machine_id: machineId }),
    enabled: !!machineId,
  });

  const { data: records = [] } = useQuery({
    queryKey: ["records", machineId],
    queryFn: async () => {
      const allRecords = await base44.entities.ControlRecord.list("-performed_at");
      return allRecords.filter(record =>
        controlPoints.some(point => point.id === record.control_point_id)
      );
    },
    enabled: !!machineId && controlPoints.length > 0,
  });

  const { data: issues = [] } = useQuery({
    queryKey: ["issues"],
    queryFn: async () => {
      const allIssues = await base44.entities.Issue.filter({ status: "reported" });
      return allIssues.filter(issue =>
        controlPoints.some(point => point.id === issue.control_point_id)
      );
    },
    enabled: controlPoints.length > 0,
  });

  const { data: documentation = [] } = useQuery({
    queryKey: ["documentation", machineId],
    queryFn: () => base44.entities.Documentation.filter({ machine_id: machineId }),
    enabled: !!machineId,
  });

  const { data: maintenanceRecords = [] } = useQuery({
    queryKey: ["maintenanceRecords", machineId],
    queryFn: () => base44.entities.MaintenanceRecord.filter({ machine_id: machineId }, "-performed_at"),
    enabled: !!machineId,
  });

  const { data: spareParts = [] } = useQuery({
    queryKey: ["spareParts", machineId],
    queryFn: () => base44.entities.SparePart.filter({ machine_id: machineId }),
    enabled: !!machineId,
  });

  const { data: vibrationMeasurements = [] } = useQuery({
    queryKey: ["vibrationMeasurements", machineId],
    queryFn: () => base44.entities.VibrationMeasurement.filter({ machine_id: machineId }, "-measurement_date"),
    enabled: !!machineId,
  });

  const { data: responsibilities = [] } = useQuery({
    queryKey: ["responsibilities", machineId],
    queryFn: () => base44.entities.MachineResponsibility.filter({ machine_id: machineId }),
    enabled: !!machineId,
  });

  const getPointStatus = (point) => {
    const pointRecords = records.filter((r) => r.control_point_id === point.id);
    if (pointRecords.length === 0) return "overdue";

    const latestRecord = pointRecords[0];
    const lastPerformed = new Date(latestRecord.performed_at);
    const now = new Date();
    const hoursSince = (now - lastPerformed) / (1000 * 60 * 60);

    return hoursSince > (point.interval_hours || 0) ? "overdue" : "ok";
  };

  const getNextControlDate = (point) => {
    const pointRecords = records.filter(r => r.control_point_id === point.id);
    if (pointRecords.length === 0 || !point.interval_hours) return null;

    const latestRecord = pointRecords[0];
    const lastPerformed = new Date(latestRecord.performed_at);
    const nextDate = new Date(lastPerformed.getTime() + point.interval_hours * 60 * 60 * 1000);
    return nextDate;
  };

  const lubricationPoints = controlPoints.filter(p => p.type === "lubrication");
  const inspectionPoints = controlPoints.filter(p => p.type === "inspection");
  const lubricatorPoints = controlPoints.filter(p => p.type === "auto_lubricator");

  const overduePoints = controlPoints.filter(p => getPointStatus(p) === "overdue");
  const okPoints = controlPoints.filter(p => getPointStatus(p) === "ok");

  // Funkce pro určení stavu skupiny bodů
  const getGroupStatus = (points) => {
    if (points.length === 0) return null; // Žádné body = žádná tečka
    const hasOverdue = points.some(p => getPointStatus(p) === "overdue");
    return hasOverdue ? "overdue" : "ok";
  };

  const lubricationStatus = getGroupStatus(lubricationPoints);
  const inspectionStatus = getGroupStatus(inspectionPoints);
  const lubricatorsStatus = getGroupStatus(lubricatorPoints);

  // Statistiky
  const lowStockParts = spareParts.filter(p => p.quantity_in_stock <= (p.minimum_stock || 0));
  const totalMaintenanceCost = maintenanceRecords.reduce((sum, r) => sum + (r.cost || 0), 0);

  // Data pro grafy
  const vibrationTrendData = vibrationMeasurements.slice(0, 10).reverse().map(m => ({
    date: format(new Date(m.measurement_date), "d.M.", { locale: cs }),
    vRMS: m.v_rms || 0,
    aRMS: m.a_rms || 0,
    temp: m.temperature || 0,
  }));

  const maintenanceTypeData = [
    { name: "Preventivní", value: maintenanceRecords.filter(r => r.maintenance_type === "preventive").length, color: "#10b981" },
    { name: "Korektivní", value: maintenanceRecords.filter(r => r.maintenance_type === "corrective").length, color: "#f59e0b" },
    { name: "Prediktivní", value: maintenanceRecords.filter(r => r.maintenance_type === "predictive").length, color: "#3b82f6" },
    { name: "Inspekce", value: maintenanceRecords.filter(r => r.maintenance_type === "inspection").length, color: "#8b5cf6" },
  ];

  const renderPointsList = (points, type) => {
    if (points.length === 0) {
      return (
        <Card>
          <CardContent className="p-12 text-center">
            <Droplet className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500">
              {type === "lubrication" ? "Nejsou definovány žádné mazací body" :
               type === "inspection" ? "Nejsou definovány žádné inspekční body" :
               "Nejsou definovány žádné automatické maznice"}
            </p>
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="space-y-2">
        {points.map((point) => {
          const status = getPointStatus(point);
          const pointRecords = records.filter(r => r.control_point_id === point.id);
          const pointIssues = issues.filter(i => i.control_point_id === point.id && i.status === "reported");
          const nextDate = getNextControlDate(point);

          return (
            <Card
              key={point.id}
              className={`cursor-pointer transition-all hover:shadow-md border-l-4 ${
                status === "overdue" ? "border-l-yellow-500 bg-yellow-50/50" :
                "border-l-green-500 bg-green-50/50"
              }`}
              onClick={() => navigate(createPageUrl(`ControlPoint?id=${point.id}`))}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 flex-1">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      status === "overdue" ? "bg-yellow-100" : "bg-green-100"
                    }`}>
                      {type === "lubrication" ? (
                        <Droplet className={`w-5 h-5 ${status === "overdue" ? "text-yellow-700" : "text-green-700"}`} />
                      ) : type === "inspection" ? (
                        <ClipboardCheck className={`w-5 h-5 ${status === "overdue" ? "text-yellow-700" : "text-green-700"}`} />
                      ) : (
                        <Droplet className={`w-5 h-5 ${status === "overdue" ? "text-yellow-700" : "text-green-700"}`} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold text-slate-900 text-base">
                          {point.number && `${point.number} - `}{point.name}
                        </h3>
                        {status === "overdue" && (
                          <Badge variant="outline" className="gap-1 bg-yellow-100 text-yellow-800 border-yellow-300">
                            <Clock className="w-3 h-3" />
                            Po termínu
                          </Badge>
                        )}
                        {pointIssues.length > 0 && (
                          <Badge className="bg-orange-500 gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            {pointIssues.length}
                          </Badge>
                        )}
                      </div>
                      <div className="flex flex-col gap-1 text-sm text-slate-600">
                        <div className="flex items-center gap-4 flex-wrap">
                          {point.interval_hours && (
                            <span>Interval: {point.interval_hours}h</span>
                          )}
                          {pointRecords.length > 0 && (
                            <>
                              <span className="hidden sm:inline">·</span>
                              <span>
                                Poslední: {format(new Date(pointRecords[0].performed_at), "d.M. HH:mm", { locale: cs })}
                              </span>
                            </>
                          )}
                        </div>
                        {nextDate && (
                          <span className={status === "overdue" ? "text-yellow-700 font-medium" : "text-slate-600"}>
                            Následující: {format(nextDate, "d.M. yyyy", { locale: cs })}
                          </span>
                        )}
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
    );
  };

  if (!machine) {
    return (
      <div className="p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
          </div>
        </div>
      </div>
    );
  }

  const machineStatus = overduePoints.length > 0 ? "warning" : issues.length > 0 ? "issues" : "ok";

  // Překlad typu stroje
  const getMachineTypeLabel = (type) => {
    const types = {
      press: "Lis",
      conveyor: "Dopravník",
      pump: "Čerpadlo",
      fan: "Ventilátor",
      compressor: "Kompresor",
      motor: "Motor",
      gearbox: "Převodovka",
      crane: "Jeřáb",
      robot: "Robot",
      cnc_machine: "CNC stroj",
      welding_machine: "Svářečka",
      other: "Jiné"
    };
    return types[type] || type;
  };

  return (
    <div className="p-4 md:p-8 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Hlavička stroje */}
        <div className="mb-6">
          {/* Breadcrumbs - Replaces the old "Zpět na {line?.name}" button */}
          <div className="flex items-center gap-2 text-sm text-slate-600 mb-4 flex-wrap">
            <Building2 className="w-4 h-4 text-slate-500" />
            <button
              onClick={() => navigate(createPageUrl(`Lines?company=${company?.id}`))}
              className="hover:text-slate-900 transition-colors"
            >
              {company?.name || "Podnik"}
            </button>
            <ChevronRight className="w-4 h-4 text-slate-400" />
            <button
              onClick={() => navigate(createPageUrl(`Lines?company=${company?.id}&line=${line?.id}`))}
              className="hover:text-slate-900 transition-colors"
            >
              {line?.name || "Linka"}
            </button>
            <ChevronRight className="w-4 h-4 text-slate-400" />
            <span className="font-semibold text-slate-900">{machine.name}</span>
          </div>
          
          <Card className="border-none shadow-xl bg-gradient-to-r from-slate-900 to-slate-800 text-white overflow-hidden">
            <CardContent className="p-8">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-4 mb-4">
                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shadow-xl ${
                      machineStatus === "warning" ? "bg-yellow-500" :
                      machineStatus === "issues" ? "bg-orange-500" :
                      "bg-green-500"
                    }`}>
                      <Settings className="w-9 h-9 text-white" />
                    </div>
                    <div>
                      <h1 className="text-3xl font-bold mb-2">{machine.name}</h1>
                      <p className="text-slate-300 text-lg">{line?.name}</p>
                    </div>
                  </div>

                  {/* Dodatečné informace o stroji */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    {machine.inventory_number && (
                      <div className="bg-white/10 rounded-lg p-3">
                        <p className="text-slate-400 text-xs mb-1">Inventární číslo</p>
                        <p className="text-white font-semibold">{machine.inventory_number}</p>
                      </div>
                    )}
                    {machine.machine_type && (
                      <div className="bg-white/10 rounded-lg p-3">
                        <p className="text-slate-400 text-xs mb-1">Typ zařízení</p>
                        <p className="text-white font-semibold">{getMachineTypeLabel(machine.machine_type)}</p>
                      </div>
                    )}
                    {machine.location && (
                      <div className="bg-white/10 rounded-lg p-3">
                        <p className="text-slate-400 text-xs mb-1">Umístění</p>
                        <p className="text-white font-semibold">{machine.location}</p>
                      </div>
                    )}
                  </div>

                  {machine.description && (
                    <p className="text-slate-200 mb-4">{machine.description}</p>
                  )}
                  <div className="flex items-center gap-4 flex-wrap">
                    <Badge className="bg-white/20 text-white border-white/30">
                      {controlPoints.length} kontrolních bodů
                    </Badge>
                    {overduePoints.length > 0 && (
                      <Badge className="bg-yellow-500 text-white">
                        <Clock className="w-3 h-3 mr-1" />
                        {overduePoints.length} po termínu
                      </Badge>
                    )}
                    {issues.length > 0 && (
                      <Badge className="bg-orange-500 text-white">
                        <AlertTriangle className="w-3 h-3 mr-1" />
                        {issues.length} aktivních závad
                      </Badge>
                    )}
                  </div>
                </div>
                <div className={`w-24 h-24 rounded-full flex items-center justify-center border-8 ${
                  machineStatus === "warning" ? "border-yellow-500 bg-yellow-500/20" :
                  machineStatus === "issues" ? "border-orange-500 bg-orange-500/20" :
                  "border-green-500 bg-green-500/20"
                }`}>
                  <span className="text-3xl font-bold">
                    {machineStatus === "ok" ? "✓" : machineStatus === "issues" ? "!" : "⏰"}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Záložky */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 lg:grid-cols-8 bg-white shadow-md p-2 h-auto gap-2">
            <TabsTrigger value="overview" className="gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-blue-700 data-[state=active]:text-white">
              <LayoutDashboard className="w-4 h-4" />
              <span className="hidden md:inline">Přehled</span>
            </TabsTrigger>
            <TabsTrigger value="control-points" className="gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-purple-700 data-[state=active]:text-white">
              <Droplet className="w-4 h-4" />
              <span className="hidden md:inline">DEMIP</span>
            </TabsTrigger>
            <TabsTrigger value="documentation" className="gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-600 data-[state=active]:to-indigo-700 data-[state=active]:text-white">
              <ImageIcon className="w-4 h-4" />
              <span className="hidden md:inline">Dokumentace</span>
            </TabsTrigger>
            <TabsTrigger value="maintenance" className="gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-green-600 data-[state=active]:to-green-700 data-[state=active]:text-white">
              <Wrench className="w-4 h-4" />
              <span className="hidden md:inline">Údržba</span>
            </TabsTrigger>
            <TabsTrigger value="spare-parts" className="gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-600 data-[state=active]:to-orange-700 data-[state=active]:text-white">
              <Package className="w-4 h-4" />
              <span className="hidden md:inline">Díly</span>
            </TabsTrigger>
            <TabsTrigger value="vibration" className="gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-red-600 data-[state=active]:to-red-700 data-[state=active]:text-white">
              <Activity className="w-4 h-4" />
              <span className="hidden md:inline">Vibrace</span>
            </TabsTrigger>
            <TabsTrigger value="responsibility" className="gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-teal-600 data-[state=active]:to-teal-700 data-[state=active]:text-white">
              <Users className="w-4 h-4" />
              <span className="hidden md:inline">Odpovědnost</span>
            </TabsTrigger>
            <TabsTrigger value="statistics" className="gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-pink-600 data-[state=active]:to-pink-700 data-[state=active]:text-white">
              <BarChart2 className="w-4 h-4" />
              <span className="hidden md:inline">Statistiky</span>
            </TabsTrigger>
          </TabsList>

          {/* Přehled */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="border-none shadow-lg bg-gradient-to-br from-blue-500 to-blue-600 text-white">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-blue-100 text-sm font-medium mb-1">Kontrolní body</p>
                      <p className="text-4xl font-bold">{controlPoints.length}</p>
                      <p className="text-blue-100 text-xs mt-2">
                        {lubricationPoints.length} mazání • {inspectionPoints.length} inspekcí
                      </p>
                    </div>
                    <Droplet className="w-8 h-8 text-white/80" />
                  </div>
                </CardContent>
              </Card>

              <Card className="border-none shadow-lg bg-gradient-to-br from-yellow-500 to-yellow-600 text-white">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-yellow-100 text-sm font-medium mb-1">Po termínu</p>
                      <p className="text-4xl font-bold">{overduePoints.length}</p>
                      <p className="text-yellow-100 text-xs mt-2">
                        Vyžaduje okamžitou pozornost
                      </p>
                    </div>
                    <Clock className="w-8 h-8 text-white/80" />
                  </div>
                </CardContent>
              </Card>

              <Card className="border-none shadow-lg bg-gradient-to-br from-orange-500 to-orange-600 text-white">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-orange-100 text-sm font-medium mb-1">Aktivní závady</p>
                      <p className="text-4xl font-bold">{issues.length}</p>
                      <p className="text-orange-100 text-xs mt-2">
                        Nahlášené problémy
                      </p>
                    </div>
                    <AlertTriangle className="w-8 h-8 text-white/80" />
                  </div>
                </CardContent>
              </Card>

              <Card className="border-none shadow-lg bg-gradient-to-br from-green-500 to-green-600 text-white">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-green-100 text-sm font-medium mb-1">V pořádku</p>
                      <p className="text-4xl font-bold">{okPoints.length}</p>
                      <p className="text-green-100 text-xs mt-2">
                        Kontrolní body OK
                      </p>
                    </div>
                    <CheckCircle className="w-8 h-8 text-white/80" />
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="border-none shadow-lg">
                <CardHeader className="border-b border-slate-100">
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-blue-600" />
                    Nejbližší úkony
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  {controlPoints.length === 0 ? (
                    <p className="text-center text-slate-500 py-8">Nejsou definovány kontrolní body</p>
                  ) : (
                    <div className="space-y-3">
                      {controlPoints
                        .map(point => ({
                          point,
                          nextDate: getNextControlDate(point),
                          status: getPointStatus(point)
                        }))
                        .filter(item => item.nextDate)
                        .sort((a, b) => new Date(a.nextDate) - new Date(b.nextDate))
                        .slice(0, 5)
                        .map(({ point, nextDate, status }) => (
                          <div
                            key={point.id}
                            className={`p-3 rounded-lg border-l-4 cursor-pointer hover:bg-slate-50 transition-colors ${
                              status === "overdue" ? "border-l-yellow-500 bg-yellow-50/30" : "border-l-green-500 bg-green-50/30"
                            }`}
                            onClick={() => navigate(createPageUrl(`ControlPoint?id=${point.id}`))}
                          >
                            <div className="flex items-start justify-between">
                              <div>
                                <p className="font-semibold text-slate-900 text-sm">
                                  {point.number && `${point.number} - `}{point.name}
                                </p>
                                <p className="text-xs text-slate-600 mt-1">
                                  {point.type === "lubrication" ? "Mazání" : point.type === "inspection" ? "Inspekce" : "Maznice"}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className={`text-sm font-medium ${status === "overdue" ? "text-yellow-700" : "text-slate-900"}`}>
                                  {format(nextDate, "d.M. yyyy", { locale: cs })}
                                </p>
                                {status === "overdue" && (
                                  <Badge variant="outline" className="mt-1 bg-yellow-100 text-yellow-800 border-yellow-300 text-xs">
                                    Po termínu
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border-none shadow-lg">
                <CardHeader className="border-b border-slate-100">
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-orange-600" />
                    Aktivní závady
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  {issues.length === 0 ? (
                    <div className="text-center py-8">
                      <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
                      <p className="text-slate-600 font-medium">Žádné aktivní závady</p>
                      <p className="text-sm text-slate-500 mt-1">Stroj je v dobrém stavu</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {issues.slice(0, 5).map((issue) => {
                        const point = controlPoints.find(p => p.id === issue.control_point_id);
                        return (
                          <div key={issue.id} className="p-3 rounded-lg bg-orange-50 border border-orange-200">
                            <p className="font-semibold text-slate-900 text-sm mb-1">
                              {point?.name || "Neznámý bod"}
                            </p>
                            <p className="text-xs text-slate-600 line-clamp-2">{issue.description}</p>
                            <p className="text-xs text-slate-500 mt-2">
                              {format(new Date(issue.created_date), "d.M. yyyy", { locale: cs })} • {issue.created_by}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {records.length > 0 && (
              <Card className="border-none shadow-lg">
                <CardHeader className="border-b border-slate-100">
                  <CardTitle className="flex items-center gap-2">
                    <ClipboardCheck className="w-5 h-5 text-purple-600" />
                    Poslední záznamy
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="space-y-2">
                    {records.slice(0, 8).map((record) => {
                      const point = controlPoints.find(p => p.id === record.control_point_id);
                      return (
                        <div key={record.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                            record.record_type === "lubrication" ? "bg-blue-100" :
                            record.record_type === "inspection" ? "bg-purple-100" :
                            "bg-green-100"
                          }`}>
                            {record.record_type === "lubrication" ? (
                              <Droplet className="w-4 h-4 text-blue-600" />
                            ) : record.record_type === "inspection" ? (
                              <ClipboardCheck className="w-4 h-4 text-purple-600" />
                            ) : (
                              <Droplet className="w-4 h-4 text-green-600" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-900 truncate">
                              {point?.name || "Neznámý bod"}
                            </p>
                            <p className="text-xs text-slate-500">
                              {format(new Date(record.performed_at), "d.M. yyyy HH:mm", { locale: cs })} • {record.created_by}
                            </p>
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {record.record_type === "lubrication" ? "Mazání" :
                             record.record_type === "inspection" ? "Inspekce" :
                             "Výměna maznice"}
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* DEMIP - Kontrolní body */}
          <TabsContent value="control-points">
            <Tabs defaultValue="lubrication" className="space-y-6">
              <TabsList className="grid w-full grid-cols-3 bg-white shadow-sm">
                <TabsTrigger value="lubrication" className="gap-2">
                  <Droplet className="w-4 h-4" />
                  Mazání ({lubricationPoints.length})
                  {lubricationStatus && (
                    <div className={`w-2 h-2 rounded-full ml-1 ${
                      lubricationStatus === "overdue" ? "bg-yellow-500" : "bg-green-500"
                    }`} />
                  )}
                </TabsTrigger>
                <TabsTrigger value="inspection" className="gap-2">
                  <CheckCircle className="w-4 h-4" />
                  Inspekce ({inspectionPoints.length})
                  {inspectionStatus && (
                    <div className={`w-2 h-2 rounded-full ml-1 ${
                      inspectionStatus === "overdue" ? "bg-yellow-500" : "bg-green-500"
                    }`} />
                  )}
                </TabsTrigger>
                <TabsTrigger value="lubricators" className="gap-2">
                  <Droplet className="w-4 h-4" />
                  Maznice ({lubricatorPoints.length})
                  {lubricatorsStatus && (
                    <div className={`w-2 h-2 rounded-full ml-1 ${
                      lubricatorsStatus === "overdue" ? "bg-yellow-500" : "bg-green-500"
                    }`} />
                  )}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="lubrication">
                {renderPointsList(lubricationPoints, "lubrication")}
              </TabsContent>

              <TabsContent value="inspection">
                {renderPointsList(inspectionPoints, "inspection")}
              </TabsContent>

              <TabsContent value="lubricators">
                {renderPointsList(lubricatorPoints, "lubricator")}
              </TabsContent>
            </Tabs>
          </TabsContent>

          {/* Dokumentace */}
          <TabsContent value="documentation">
            <Card className="border-none shadow-lg">
              <CardHeader className="border-b border-slate-100">
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-indigo-600" />
                  Fotodokumentace a schémata stroje
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                {documentation.length === 0 ? (
                  <div className="text-center py-12">
                    <ImageIcon className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                    <p className="text-slate-500 mb-2">Zatím nebyla přidána žádná dokumentace</p>
                    <p className="text-sm text-slate-400">Dokumentaci můžete přidávat v detailu kontrolního bodu</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {documentation.map((doc) => (
                      <a
                        key={doc.id}
                        href={doc.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group"
                      >
                        <div className="aspect-square rounded-lg overflow-hidden border-2 border-slate-200 group-hover:border-indigo-400 transition-colors">
                          <img
                            src={doc.file_url}
                            alt={doc.file_name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <p className="text-sm text-slate-600 mt-2 truncate">{doc.file_name}</p>
                        <p className="text-xs text-slate-400">
                          {format(new Date(doc.created_date), "d.M. yyyy", { locale: cs })}
                        </p>
                      </a>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Údržba a servis */}
          <TabsContent value="maintenance">
            <Card className="border-none shadow-lg">
              <CardHeader className="border-b border-slate-100">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Wrench className="w-5 h-5 text-green-600" />
                    Historie údržby a servisu
                  </CardTitle>
                  <div className="text-sm text-slate-600">
                    Celkové náklady: <span className="font-bold text-green-600">{totalMaintenanceCost.toLocaleString()} Kč</span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                {maintenanceRecords.length === 0 ? (
                  <div className="text-center py-12">
                    <Wrench className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                    <p className="text-slate-500 mb-2">Zatím nejsou záznamy o údržbě</p>
                    <p className="text-sm text-slate-400">První záznam můžete přidat v administraci</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {maintenanceRecords.map((record) => (
                      <Card key={record.id} className="border border-slate-200">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <Badge className={
                                  record.maintenance_type === "preventive" ? "bg-green-100 text-green-800" :
                                  record.maintenance_type === "corrective" ? "bg-orange-100 text-orange-800" :
                                  record.maintenance_type === "predictive" ? "bg-blue-100 text-blue-800" :
                                  "bg-purple-100 text-purple-800"
                                }>
                                  {record.maintenance_type === "preventive" ? "Preventivní" :
                                   record.maintenance_type === "corrective" ? "Korektivní" :
                                   record.maintenance_type === "predictive" ? "Prediktivní" :
                                   "Inspekce"}
                                </Badge>
                                <h3 className="font-bold text-slate-900">{record.title}</h3>
                              </div>
                              <p className="text-sm text-slate-600 mb-2">{record.description}</p>
                              <div className="flex items-center gap-4 text-xs text-slate-500">
                                <span>{format(new Date(record.performed_at), "d.M. yyyy HH:mm", { locale: cs })}</span>
                                {record.duration_hours && <span>• {record.duration_hours}h</span>}
                                {record.technician && <span>• {record.technician}</span>}
                              </div>
                              {record.notes && (
                                <p className="text-xs text-slate-500 mt-2 italic">{record.notes}</p>
                              )}
                            </div>
                            {record.cost && (
                              <div className="text-right">
                                <p className="text-lg font-bold text-green-600">
                                  {record.cost.toLocaleString()} Kč
                                </p>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Náhradní díly */}
          <TabsContent value="spare-parts">
            <Card className="border-none shadow-lg">
              <CardHeader className="border-b border-slate-100">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Package className="w-5 h-5 text-orange-600" />
                    Náhradní díly a spotřební materiál
                  </CardTitle>
                  {lowStockParts.length > 0 && (
                    <Badge variant="destructive" className="gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      {lowStockParts.length} pod minimom
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-6">
                {spareParts.length === 0 ? (
                  <div className="text-center py-12">
                    <Package className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                    <p className="text-slate-500 mb-2">Zatím nejsou definovány náhradní díly</p>
                    <p className="text-sm text-slate-400">První díl můžete přidat v administraci</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {spareParts.map((part) => {
                      const isLowStock = part.quantity_in_stock <= (part.minimum_stock || 0);
                      return (
                        <Card key={part.id} className={`border ${isLowStock ? "border-red-300 bg-red-50/30" : "border-slate-200"}`}>
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <h3 className="font-bold text-slate-900">{part.name}</h3>
                                  {isLowStock && (
                                    <Badge variant="destructive" className="gap-1 text-xs">
                                      <AlertTriangle className="w-3 h-3" />
                                      Nízký stav
                                    </Badge>
                                  )}
                                  {part.category && (
                                    <Badge variant="outline" className="text-xs">
                                      {part.category === "mechanical" ? "Mechanické" :
                                       part.category === "electrical" ? "Elektrické" :
                                       part.category === "hydraulic" ? "Hydraulické" :
                                       part.category === "pneumatic" ? "Pneumatické" :
                                       part.category === "consumable" ? "Spotřební" :
                                       "Ostatní"}
                                    </Badge>
                                  )}
                                </div>
                                {part.part_number && (
                                  <p className="text-sm text-slate-600 mb-1">Katalogové č.: {part.part_number}</p>
                                )}
                                {part.manufacturer && (
                                  <p className="text-sm text-slate-600 mb-1">Výrobce: {part.manufacturer}</p>
                                )}
                                <div className="flex items-center gap-4 text-xs text-slate-500 mt-2">
                                  {part.supplier && <span>Dodavatel: {part.supplier}</span>}
                                  {part.storage_location && <span>• Umístění: {part.storage_location}</span>}
                                </div>
                                {part.notes && (
                                  <p className="text-xs text-slate-500 mt-2 italic">{part.notes}</p>
                                )}
                              </div>
                              <div className="text-right ml-4">
                                <p className={`text-2xl font-bold ${isLowStock ? "text-red-600" : "text-slate-900"}`}>
                                  {part.quantity_in_stock || 0} ks
                                </p>
                                <p className="text-xs text-slate-500">Min: {part.minimum_stock || 0} ks</p>
                                {part.unit_price && (
                                  <p className="text-sm text-slate-600 mt-2">
                                    {part.unit_price.toLocaleString()} Kč/ks
                                  </p>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Vibrodiagnostika */}
          <TabsContent value="vibration" className="space-y-6">
            {vibrationMeasurements.length > 0 && (
              <Card className="border-none shadow-lg">
                <CardHeader className="border-b border-slate-100">
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-red-600" />
                    Trendy vibračních veličin
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={vibrationTrendData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="date" stroke="#64748b" />
                      <YAxis stroke="#64748b" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "white",
                          border: "1px solid #e2e8f0",
                          borderRadius: "8px",
                        }}
                      />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="vRMS"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        name="vRMS (mm/s)"
                        dot={{ fill: "#3b82f6", r: 4 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="aRMS"
                        stroke="#ef4444"
                        strokeWidth={2}
                        name="aRMS (m/s²)"
                        dot={{ fill: "#ef4444", r: 4 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="temp"
                        stroke="#f59e0b"
                        strokeWidth={2}
                        name="Teplota (°C)"
                        dot={{ fill: "#f59e0b", r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            <Card className="border-none shadow-lg">
              <CardHeader className="border-b border-slate-100">
                <CardTitle className="flex items-center gap-2">
                  <Activity className="w-5 h-5 text-red-600" />
                  Historie měření vibrací
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                {vibrationMeasurements.length === 0 ? (
                  <div className="text-center py-12">
                    <Activity className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                    <p className="text-slate-500 mb-2">Zatím nejsou záznamy o měření vibrací</p>
                    <p className="text-sm text-slate-400">První měření můžete přidat v administraci</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {vibrationMeasurements.map((measurement) => (
                      <Card key={measurement.id} className={`border ${
                        measurement.condition_rating === "unacceptable" ? "border-red-300 bg-red-50/30" :
                        measurement.condition_rating === "unsatisfactory" ? "border-orange-300 bg-orange-50/30" :
                        measurement.condition_rating === "acceptable" ? "border-yellow-300 bg-yellow-50/30" :
                        "border-green-300 bg-green-50/30"
                      }`}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="font-bold text-slate-900">{measurement.measuring_point}</h3>
                                <Badge className={
                                  measurement.measurement_type === "online" ? "bg-blue-100 text-blue-800" : "bg-purple-100 text-purple-800"
                                }>
                                  {measurement.measurement_type === "online" ? "Online" : "Offline"}
                                </Badge>
                                {measurement.condition_rating && (
                                  <Badge className={
                                    measurement.condition_rating === "good" ? "bg-green-500" :
                                    measurement.condition_rating === "acceptable" ? "bg-yellow-500" :
                                    measurement.condition_rating === "unsatisfactory" ? "bg-orange-500" :
                                    "bg-red-500"
                                  }>
                                    {measurement.condition_rating === "good" ? "Dobrý" :
                                     measurement.condition_rating === "acceptable" ? "Přijatelný" :
                                     measurement.condition_rating === "unsatisfactory" ? "Neuspokojivý" :
                                     "Nepřijatelný"}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-slate-500">
                                {format(new Date(measurement.measurement_date), "d.M. yyyy HH:mm", { locale: cs })}
                                {measurement.measured_by && ` • ${measurement.measured_by}`}
                              </p>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-3">
                            {measurement.v_rms !== null && (
                              <div className="bg-white rounded-lg p-3 border border-slate-200">
                                <p className="text-xs text-slate-500 mb-1">vRMS</p>
                                <p className="text-lg font-bold text-slate-900">{measurement.v_rms}</p>
                                <p className="text-xs text-slate-500">mm/s</p>
                              </div>
                            )}
                            {measurement.a_rms !== null && (
                              <div className="bg-white rounded-lg p-3 border border-slate-200">
                                <p className="text-xs text-slate-500 mb-1">aRMS</p>
                                <p className="text-lg font-bold text-slate-900">{measurement.a_rms}</p>
                                <p className="text-xs text-slate-500">m/s²</p>
                              </div>
                            )}
                            {measurement.a_envelope !== null && (
                              <div className="bg-white rounded-lg p-3 border border-slate-200">
                                <p className="text-xs text-slate-500 mb-1">aENVELOP</p>
                                <p className="text-lg font-bold text-slate-900">{measurement.a_envelope}</p>
                                <p className="text-xs text-slate-500">g</p>
                              </div>
                            )}
                            {measurement.overall_acceleration !== null && (
                              <div className="bg-white rounded-lg p-3 border border-slate-200">
                                <p className="text-xs text-slate-500 mb-1">OA</p>
                                <p className="text-lg font-bold text-slate-900">{measurement.overall_acceleration}</p>
                                <p className="text-xs text-slate-500">m/s²</p>
                              </div>
                            )}
                            {measurement.temperature !== null && (
                              <div className="bg-white rounded-lg p-3 border border-slate-200">
                                <p className="text-xs text-slate-500 mb-1">Teplota</p>
                                <p className="text-lg font-bold text-slate-900">{measurement.temperature}</p>
                                <p className="text-xs text-slate-500">°C</p>
                              </div>
                            )}
                          </div>

                          {measurement.findings && (
                            <div className="bg-white rounded-lg p-3 border border-slate-200 mb-2">
                              <p className="text-xs font-semibold text-slate-700 mb-1">Zjištění:</p>
                              <p className="text-sm text-slate-600">{measurement.findings}</p>
                            </div>
                          )}

                          {measurement.recommendations && (
                            <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                              <p className="text-xs font-semibold text-blue-900 mb-1">Doporučení:</p>
                              <p className="text-sm text-blue-800">{measurement.recommendations}</p>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Odpovědnost */}
          <TabsContent value="responsibility">
            <Card className="border-none shadow-lg">
              <CardHeader className="border-b border-slate-100">
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-teal-600" />
                  Odpovědné osoby
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                {responsibilities.length === 0 ? (
                  <div className="text-center py-12">
                    <Users className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                    <p className="text-slate-500 mb-2">Zatím nejsou přiřazeny odpovědné osoby</p>
                    <p className="text-sm text-slate-400">První odpovědnost můžete přidat v administraci</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {responsibilities.map((resp) => (
                      <Card key={resp.id} className="border border-slate-200">
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <div className="w-12 h-12 bg-gradient-to-br from-teal-500 to-teal-600 rounded-full flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                              {resp.user_name?.[0] || "?"}
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-bold text-slate-900 mb-1">{resp.user_name}</h3>
                              <p className="text-sm text-slate-600 mb-2">{resp.user_email}</p>
                              <Badge variant="outline">
                                {resp.responsibility_type === "primary" ? "Primární odpovědnost" :
                                 resp.responsibility_type === "maintenance" ? "Údržba" :
                                 resp.responsibility_type === "lubrication" ? "Mazání" :
                                 resp.responsibility_type === "inspection" ? "Inspekce" :
                                 resp.responsibility_type === "vibration_analysis" ? "Vibrodiagnostika" :
                                 "Náhradní díly"}
                              </Badge>
                              {resp.notes && (
                                <p className="text-xs text-slate-500 mt-2 italic">{resp.notes}</p>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Statistiky */}
          <TabsContent value="statistics" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="border-none shadow-lg">
                <CardHeader className="border-b border-slate-100">
                  <CardTitle className="flex items-center gap-2">
                    <BarChart2 className="w-5 h-5 text-pink-600" />
                    Typy údržby
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  {maintenanceRecords.length === 0 ? (
                    <p className="text-center text-slate-500 py-8">Zatím nejsou data</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={250}>
                      <PieChart>
                        <Pie
                          data={maintenanceTypeData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {maintenanceTypeData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              <Card className="border-none shadow-lg">
                <CardHeader className="border-b border-slate-100">
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    Stav kontrolních bodů
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-slate-600">V pořádku</span>
                        <span className="text-sm font-bold text-green-600">{okPoints.length}</span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-3">
                        <div
                          className="bg-gradient-to-r from-green-500 to-green-600 h-3 rounded-full transition-all"
                          style={{ width: `${controlPoints.length > 0 ? (okPoints.length / controlPoints.length) * 100 : 0}%` }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-slate-600">Po termínu</span>
                        <span className="text-sm font-bold text-yellow-600">{overduePoints.length}</span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-3">
                        <div
                          className="bg-gradient-to-r from-yellow-500 to-yellow-600 h-3 rounded-full transition-all"
                          style={{ width: `${controlPoints.length > 0 ? (overduePoints.length / controlPoints.length) * 100 : 0}%` }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-slate-600">Aktivní závady</span>
                        <span className="text-sm font-bold text-orange-600">{issues.length}</span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-3">
                        <div
                          className="bg-gradient-to-r from-orange-500 to-orange-600 h-3 rounded-full transition-all"
                          style={{ width: `${controlPoints.length > 0 ? (issues.length / controlPoints.length) * 100 : 0}%` }}
                        />
                      </div>
                    </div>

                    <div className="pt-4 border-t border-slate-200">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-slate-900">Celkem kontrolních bodů</span>
                        <span className="text-2xl font-bold text-slate-900">{controlPoints.length}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="border-none shadow-lg">
              <CardHeader className="border-b border-slate-100">
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-blue-600" />
                  Klíčové metriky
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4 border border-blue-200">
                    <p className="text-sm text-blue-700 mb-1">Celkem záznamů</p>
                    <p className="text-3xl font-bold text-blue-900">{records.length}</p>
                  </div>

                  <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-4 border border-green-200">
                    <p className="text-sm text-green-700 mb-1">Údržbových úkonů</p>
                    <p className="text-3xl font-bold text-green-900">{maintenanceRecords.length}</p>
                  </div>

                  <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl p-4 border border-orange-200">
                    <p className="text-sm text-orange-700 mb-1">Náhradních dílů</p>
                    <p className="text-3xl font-bold text-orange-900">{spareParts.length}</p>
                  </div>

                  <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-4 border border-purple-200">
                    <p className="text-sm text-purple-700 mb-1">Celkové náklady</p>
                    <p className="text-2xl font-bold text-purple-900">{totalMaintenanceCost.toLocaleString()} Kč</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
