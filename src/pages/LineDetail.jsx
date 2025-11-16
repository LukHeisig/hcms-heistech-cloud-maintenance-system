import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Factory,
  Building2,
  ChevronRight,
  ArrowLeft,
  Clock,
  AlertTriangle,
  Droplet,
  ClipboardCheck,
  Users,
  BarChart3,
  Calendar,
  Wrench,
  TrendingUp,
  CheckSquare,
  FileText,
  Settings,
  Download,
  Upload,
  ShieldCheck,
} from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { cs } from "date-fns/locale";

export default function LineDetail() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const urlParams = new URLSearchParams(window.location.search);
  const lineId = urlParams.get("id");
  const companyId = urlParams.get("company");

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    const currentUser = await base44.auth.me();
    setUser(currentUser);
  };

  const { data: line } = useQuery({
    queryKey: ["line", lineId],
    queryFn: () => base44.entities.Line.filter({ id: lineId }).then(res => res[0]),
    enabled: !!lineId,
  });

  const { data: company } = useQuery({
    queryKey: ["company", line?.company_id],
    queryFn: () => base44.entities.Company.filter({ id: line.company_id }).then(res => res[0]),
    enabled: !!line?.company_id,
  });

  const { data: machines = [] } = useQuery({
    queryKey: ["machines", lineId],
    queryFn: () => base44.entities.Machine.filter({ line_id: lineId }, "order_index"),
    enabled: !!lineId,
  });

  const { data: allControlPoints = [] } = useQuery({
    queryKey: ["allControlPoints"],
    queryFn: () => base44.entities.ControlPoint.list(),
  });

  const { data: allRecords = [] } = useQuery({
    queryKey: ["allRecords"],
    queryFn: () => base44.entities.ControlRecord.list("-performed_at", 500),
  });

  const { data: allIssues = [] } = useQuery({
    queryKey: ["allIssues"],
    queryFn: () => base44.entities.Issue.filter({ status: "reported" }),
  });

  const { data: allMaintenance = [] } = useQuery({
    queryKey: ["allMaintenance"],
    queryFn: () => base44.entities.MaintenanceRecord.list("-performed_at", 500),
  });

  const { data: allPlannedMaintenance = [] } = useQuery({
    queryKey: ["allPlannedMaintenance"],
    queryFn: () => base44.entities.PlannedMaintenance.list(),
  });

  const { data: allResponsibilities = [] } = useQuery({
    queryKey: ["allResponsibilities"],
    queryFn: () => base44.entities.MachineResponsibility.list(),
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ["allUsers"],
    queryFn: () => base44.entities.User.list(),
  });

  const userMap = useMemo(() => {
    return allUsers.reduce((acc, u) => {
      acc[u.email] = u;
      return acc;
    }, {});
  }, [allUsers]);

  const getUserDisplayName = (email) => {
    const u = userMap[email];
    return u ? (u.custom_display_name || u.full_name || u.email) : email;
  };

  const machineIds = useMemo(() => machines.map(m => m.id), [machines]);

  const controlPoints = useMemo(() => {
    return allControlPoints.filter(cp => machineIds.includes(cp.machine_id));
  }, [allControlPoints, machineIds]);

  const records = useMemo(() => {
    const pointIds = controlPoints.map(cp => cp.id);
    return allRecords.filter(r => pointIds.includes(r.control_point_id));
  }, [allRecords, controlPoints]);

  const issues = useMemo(() => {
    const pointIds = controlPoints.map(cp => cp.id);
    return allIssues.filter(i => 
      (i.control_point_id && pointIds.includes(i.control_point_id)) ||
      (i.machine_id && machineIds.includes(i.machine_id))
    );
  }, [allIssues, controlPoints, machineIds]);

  const maintenanceRecords = useMemo(() => {
    return allMaintenance.filter(m => machineIds.includes(m.machine_id));
  }, [allMaintenance, machineIds]);

  const plannedMaintenance = useMemo(() => {
    return allPlannedMaintenance.filter(pm => machineIds.includes(pm.machine_id));
  }, [allPlannedMaintenance, machineIds]);

  const responsibilities = useMemo(() => {
    return allResponsibilities.filter(r => machineIds.includes(r.machine_id));
  }, [allResponsibilities, machineIds]);

  const getPointStatus = (point) => {
    const pointRecords = records.filter((r) => r.control_point_id === point.id);
    if (pointRecords.length === 0) return "overdue";

    const latestRecord = pointRecords[0];
    const lastPerformed = new Date(latestRecord.performed_at);
    const now = new Date();
    const hoursSince = (now - lastPerformed) / (1000 * 60 * 60);

    return hoursSince > point.interval_hours ? "overdue" : "ok";
  };

  const overduePoints = useMemo(() => {
    return controlPoints.filter(p => getPointStatus(p) === "overdue");
  }, [controlPoints, records]);

  const stats = useMemo(() => {
    const thisMonth = maintenanceRecords.filter(m => {
      const date = new Date(m.performed_at);
      const now = new Date();
      return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    });

    const totalCost = thisMonth.reduce((sum, m) => sum + (m.cost || 0), 0);

    return {
      machinesCount: machines.length,
      pointsCount: controlPoints.length,
      overdueCount: overduePoints.length,
      issuesCount: issues.length,
      maintenanceThisMonth: thisMonth.length,
      totalCostThisMonth: totalCost,
      plannedCount: plannedMaintenance.filter(pm => pm.status !== 'completed' && pm.status !== 'cancelled').length,
    };
  }, [machines, controlPoints, overduePoints, issues, maintenanceRecords, plannedMaintenance]);

  if (!line) {
    return (
      <div className="p-8 flex items-center justify-center min-h-screen">
        <p>Načítání...</p>
      </div>
    );
  }

  const handleBackClick = () => {
    if (companyId) {
      navigate(createPageUrl(`Lines?company=${companyId}`));
    } else {
      navigate(createPageUrl("Lines"));
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg">
        <div className="max-w-7xl mx-auto p-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBackClick}
            className="text-white hover:bg-white/20 mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Zpět na linky
          </Button>

          <div className="flex items-center gap-2 text-sm mb-4 opacity-90">
            <Building2 className="w-4 h-4" />
            <span>{company?.name || "Podnik"}</span>
            <ChevronRight className="w-4 h-4" />
            <span className="font-semibold">{line.name}</span>
          </div>

          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">{line.name}</h1>
              {line.description && (
                <p className="text-blue-100 text-lg">{line.description}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-slate-600 mb-1">Stroje</p>
                  <p className="text-3xl font-bold text-slate-900">{stats.machinesCount}</p>
                </div>
                <div className="p-3 bg-blue-100 rounded-lg">
                  <Factory className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-slate-600 mb-1">Kontrolní body</p>
                  <p className="text-3xl font-bold text-slate-900">{stats.pointsCount}</p>
                </div>
                <div className="p-3 bg-purple-100 rounded-lg">
                  <Droplet className="w-6 h-6 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-slate-600 mb-1">Po termínu</p>
                  <p className="text-3xl font-bold text-red-600">{stats.overdueCount}</p>
                </div>
                <div className="p-3 bg-red-100 rounded-lg">
                  <Clock className="w-6 h-6 text-red-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-slate-600 mb-1">Aktivní závady</p>
                  <p className="text-3xl font-bold text-orange-600">{stats.issuesCount}</p>
                </div>
                <div className="p-3 bg-orange-100 rounded-lg">
                  <AlertTriangle className="w-6 h-6 text-orange-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-white shadow-sm grid w-full grid-cols-3 lg:grid-cols-9 gap-1 p-2">
            <TabsTrigger value="overview">Přehled</TabsTrigger>
            <TabsTrigger value="maintenance">Plán údržby</TabsTrigger>
            <TabsTrigger value="checklist">Checklisty</TabsTrigger>
            <TabsTrigger value="interventions">Zásahy</TabsTrigger>
            <TabsTrigger value="verification">Ověření / Test</TabsTrigger>
            <TabsTrigger value="audit">Evidence</TabsTrigger>
            <TabsTrigger value="analytics">Analytika</TabsTrigger>
            <TabsTrigger value="settings">Nastavení</TabsTrigger>
            <TabsTrigger value="import-export">Import / Export</TabsTrigger>
          </TabsList>

          {/* Přehled */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Factory className="w-5 h-5" />
                    Stroje na lince
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {machines.length === 0 ? (
                    <p className="text-center text-slate-500 py-8">Žádné stroje</p>
                  ) : (
                    <div className="space-y-2">
                      {machines.map((machine) => {
                        const machinePoints = controlPoints.filter(p => p.machine_id === machine.id);
                        const overdueCount = machinePoints.filter(p => getPointStatus(p) === "overdue").length;
                        const issueCount = issues.filter(i => 
                          (i.machine_id === machine.id) ||
                          (i.control_point_id && machinePoints.some(p => p.id === i.control_point_id))
                        ).length;

                        return (
                          <div
                            key={machine.id}
                            className="flex items-center justify-between p-3 rounded-lg border hover:bg-slate-50 cursor-pointer transition-colors"
                            onClick={() => navigate(createPageUrl(`Machine?id=${machine.id}`))}
                          >
                            <div className="flex items-center gap-3">
                              <Factory className="w-5 h-5 text-slate-600" />
                              <div>
                                <p className="font-medium text-slate-900">{machine.name}</p>
                                <p className="text-xs text-slate-500">{machinePoints.length} bodů</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {overdueCount > 0 && (
                                <Badge variant="destructive" className="text-xs">
                                  {overdueCount}
                                </Badge>
                              )}
                              {issueCount > 0 && (
                                <Badge className="bg-orange-500 text-white text-xs">
                                  {issueCount}
                                </Badge>
                              )}
                              <ChevronRight className="w-5 h-5 text-slate-400" />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-orange-600" />
                    Aktivní závady ({issues.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {issues.length === 0 ? (
                    <p className="text-center text-slate-500 py-8">Žádné aktivní závady</p>
                  ) : (
                    <div className="space-y-3">
                      {issues.slice(0, 5).map((issue) => {
                        const machine = machines.find(m => m.id === issue.machine_id);
                        const point = controlPoints.find(p => p.id === issue.control_point_id);
                        
                        return (
                          <div key={issue.id} className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                            <p className="text-sm font-medium text-slate-900 mb-1">
                              {machine?.name || point?.name}
                            </p>
                            <p className="text-xs text-slate-600 line-clamp-2">{issue.description}</p>
                            <p className="text-xs text-slate-500 mt-2">
                              {format(new Date(issue.created_date), "d.M.yyyy", { locale: cs })} • {getUserDisplayName(issue.created_by)}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5" />
                  Statistiky tento měsíc
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <p className="text-sm text-blue-900 mb-1">Provedená údržba</p>
                    <p className="text-2xl font-bold text-blue-700">{stats.maintenanceThisMonth}</p>
                  </div>
                  <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                    <p className="text-sm text-green-900 mb-1">Celkové náklady</p>
                    <p className="text-2xl font-bold text-green-700">{stats.totalCostThisMonth.toLocaleString()} Kč</p>
                  </div>
                  <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                    <p className="text-sm text-purple-900 mb-1">Plánované úkoly</p>
                    <p className="text-2xl font-bold text-purple-700">{stats.plannedCount}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Plán údržby */}
          <TabsContent value="maintenance" className="space-y-6">
            <Card>
              <CardContent className="p-12 text-center">
                <Calendar className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500">Plán údržby bude implementován</p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Checklisty */}
          <TabsContent value="checklist" className="space-y-6">
            <Card>
              <CardContent className="p-12 text-center">
                <CheckSquare className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500">Checklisty budou implementovány</p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Zásahy */}
          <TabsContent value="interventions" className="space-y-6">
            <Card>
              <CardContent className="p-12 text-center">
                <Wrench className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500">Zásahy budou implementovány</p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Ověření / Test */}
          <TabsContent value="verification" className="space-y-6">
            <Card>
              <CardContent className="p-12 text-center">
                <ShieldCheck className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500">Ověření a testy budou implementovány</p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Evidence (Audit) */}
          <TabsContent value="audit" className="space-y-6">
            <Card>
              <CardContent className="p-12 text-center">
                <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500">Evidence bude implementována</p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Analytika */}
          <TabsContent value="analytics" className="space-y-6">
            <Card>
              <CardContent className="p-12 text-center">
                <TrendingUp className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500">Analytika bude implementována</p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Nastavení */}
          <TabsContent value="settings" className="space-y-6">
            <Card>
              <CardContent className="p-12 text-center">
                <Settings className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500">Nastavení bude implementováno</p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Import / Export */}
          <TabsContent value="import-export" className="space-y-6">
            <Card>
              <CardContent className="p-12 text-center">
                <Upload className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500">Import / Export bude implementován</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}