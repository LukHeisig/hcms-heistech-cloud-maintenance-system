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
          <TabsList className="bg-white shadow-sm grid w-full grid-cols-4">
            <TabsTrigger value="overview">Přehled</TabsTrigger>
            <TabsTrigger value="maintenance">Preventivní údržba</TabsTrigger>
            <TabsTrigger value="checklist">Check list</TabsTrigger>
            <TabsTrigger value="responsibilities">Odpovědné osoby</TabsTrigger>
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

          {/* Preventivní údržba */}
          <TabsContent value="maintenance" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wrench className="w-5 h-5" />
                  Plánovaná údržba
                </CardTitle>
              </CardHeader>
              <CardContent>
                {plannedMaintenance.length === 0 ? (
                  <p className="text-center text-slate-500 py-8">Žádná plánovaná údržba</p>
                ) : (
                  <div className="space-y-2">
                    {plannedMaintenance.map((pm) => {
                      const machine = machines.find(m => m.id === pm.machine_id);
                      const isOverdue = new Date(pm.planned_date) < new Date();
                      
                      return (
                        <div
                          key={pm.id}
                          className={`p-4 border rounded-lg ${
                            pm.status === 'completed' ? 'bg-green-50 border-green-200' :
                            pm.status === 'assigned' ? 'bg-blue-50 border-blue-200' :
                            isOverdue ? 'bg-red-50 border-red-200' :
                            'bg-white'
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <p className="font-medium text-slate-900">{pm.title}</p>
                                {pm.status === 'completed' && (
                                  <Badge className="bg-green-600">Dokončeno</Badge>
                                )}
                                {pm.status === 'assigned' && (
                                  <Badge className="bg-blue-600">Přiřazeno</Badge>
                                )}
                                {isOverdue && pm.status !== 'completed' && (
                                  <Badge variant="destructive">Po termínu</Badge>
                                )}
                              </div>
                              <p className="text-sm text-slate-600 mb-2">{machine?.name}</p>
                              <div className="flex items-center gap-4 text-xs text-slate-500">
                                <span className="flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  {format(new Date(pm.planned_date), "d.M.yyyy", { locale: cs })}
                                </span>
                                {pm.assigned_to && (
                                  <span>{getUserDisplayName(pm.assigned_to)}</span>
                                )}
                              </div>
                            </div>
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
                  <TrendingUp className="w-5 h-5" />
                  Historie údržby
                </CardTitle>
              </CardHeader>
              <CardContent>
                {maintenanceRecords.length === 0 ? (
                  <p className="text-center text-slate-500 py-8">Žádné záznamy údržby</p>
                ) : (
                  <div className="space-y-3">
                    {maintenanceRecords.slice(0, 10).map((record) => {
                      const machine = machines.find(m => m.id === record.machine_id);
                      
                      return (
                        <div key={record.id} className="p-3 border rounded-lg">
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <p className="font-medium text-slate-900">{record.title}</p>
                              <p className="text-sm text-slate-600">{machine?.name}</p>
                            </div>
                            {record.cost && (
                              <Badge variant="outline">{record.cost} Kč</Badge>
                            )}
                          </div>
                          <p className="text-xs text-slate-500">
                            {format(new Date(record.performed_at), "d.M.yyyy HH:mm", { locale: cs })}
                            {record.technician && ` • ${record.technician}`}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Check list */}
          <TabsContent value="checklist" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckSquare className="w-5 h-5" />
                  Kontrolní body po termínu
                </CardTitle>
              </CardHeader>
              <CardContent>
                {overduePoints.length === 0 ? (
                  <div className="text-center py-8">
                    <ClipboardCheck className="w-16 h-16 text-green-500 mx-auto mb-4" />
                    <p className="text-green-700 font-medium">Všechny body jsou v pořádku!</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {overduePoints.map((point) => {
                      const machine = machines.find(m => m.id === point.machine_id);
                      const pointRecords = records.filter(r => r.control_point_id === point.id);
                      const lastRecord = pointRecords[0];
                      
                      return (
                        <div
                          key={point.id}
                          className="p-3 bg-red-50 border border-red-200 rounded-lg cursor-pointer hover:bg-red-100 transition-colors"
                          onClick={() => navigate(createPageUrl(`Machine?id=${machine.id}`))}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <p className="font-medium text-slate-900">{point.name}</p>
                              <p className="text-sm text-slate-600">{machine?.name}</p>
                              {lastRecord && (
                                <p className="text-xs text-slate-500 mt-1">
                                  Naposledy: {format(new Date(lastRecord.performed_at), "d.M.yyyy", { locale: cs })}
                                </p>
                              )}
                            </div>
                            <Badge variant="destructive">Po termínu</Badge>
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
                  <ClipboardCheck className="w-5 h-5" />
                  Všechny kontrolní body ({controlPoints.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {controlPoints.length === 0 ? (
                  <p className="text-center text-slate-500 py-8">Žádné kontrolní body</p>
                ) : (
                  <div className="space-y-2">
                    {controlPoints.map((point) => {
                      const machine = machines.find(m => m.id === point.machine_id);
                      const status = getPointStatus(point);
                      
                      return (
                        <div
                          key={point.id}
                          className={`p-3 border rounded-lg cursor-pointer hover:bg-slate-50 transition-colors ${
                            status === 'overdue' ? 'border-red-200 bg-red-50' : 'border-slate-200'
                          }`}
                          onClick={() => navigate(createPageUrl(`Machine?id=${machine.id}`))}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              {point.type === 'lubrication' && <Droplet className="w-4 h-4 text-blue-600" />}
                              {point.type === 'inspection' && <ClipboardCheck className="w-4 h-4 text-purple-600" />}
                              <div>
                                <p className="font-medium text-slate-900">{point.name}</p>
                                <p className="text-xs text-slate-600">{machine?.name}</p>
                              </div>
                            </div>
                            <div className={`w-3 h-3 rounded-full ${
                              status === 'overdue' ? 'bg-red-500' : 'bg-green-500'
                            }`} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Odpovědné osoby */}
          <TabsContent value="responsibilities" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Přiřazené odpovědnosti
                </CardTitle>
              </CardHeader>
              <CardContent>
                {responsibilities.length === 0 ? (
                  <p className="text-center text-slate-500 py-8">Žádné přiřazené odpovědnosti</p>
                ) : (
                  <div className="space-y-4">
                    {Object.entries(
                      responsibilities.reduce((acc, resp) => {
                        if (!acc[resp.user_email]) {
                          acc[resp.user_email] = [];
                        }
                        acc[resp.user_email].push(resp);
                        return acc;
                      }, {})
                    ).map(([userEmail, userResponsibilities]) => (
                      <div key={userEmail} className="p-4 border rounded-lg">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                            <Users className="w-5 h-5 text-blue-600" />
                          </div>
                          <div>
                            <p className="font-medium text-slate-900">{getUserDisplayName(userEmail)}</p>
                            <p className="text-sm text-slate-600">{userEmail}</p>
                          </div>
                        </div>
                        <div className="space-y-2 ml-13">
                          {userResponsibilities.map((resp) => {
                            const machine = machines.find(m => m.id === resp.machine_id);
                            
                            return (
                              <div key={resp.id} className="flex items-center justify-between text-sm">
                                <span className="text-slate-700">{machine?.name}</span>
                                <Badge variant="outline">
                                  {resp.responsibility_type === 'primary' ? 'Hlavní odpovědnost' :
                                   resp.responsibility_type === 'maintenance' ? 'Údržba' :
                                   resp.responsibility_type === 'lubrication' ? 'Mazání' :
                                   resp.responsibility_type === 'inspection' ? 'Inspekce' :
                                   resp.responsibility_type}
                                </Badge>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}