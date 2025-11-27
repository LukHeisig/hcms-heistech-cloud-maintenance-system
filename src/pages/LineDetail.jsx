import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
} from "@/components/ui/dialog";
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
  Plus,
  ChevronDown,
  ChevronUp,
  ChevronsDown,
  ChevronsUp,
  Loader2,
  Thermometer,
  Waves,
  Activity,
} from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { cs } from "date-fns/locale";

export default function LineDetail() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [expandedSections, setExpandedSections] = useState({});
  const [showCheckRecordDialog, setShowCheckRecordDialog] = useState(false);
  const [checkRecordForm, setCheckRecordForm] = useState({
    section_id: "",
    check_point_id: "",
    defect_description: "",
    device_status: "V provozu",
    note: "",
    spare_part_used: "",
    downtime_estimate: "Hned za provozu",
    downtime_hours: "",
    planned_downtime_date: "",
  });
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

  const { data: checkSections = [] } = useQuery({
    queryKey: ["checkSections", lineId],
    queryFn: () => base44.entities.LineCheckSection.filter({ line_id: lineId }, "order_index"),
    enabled: !!lineId,
  });

  const { data: allCheckPoints = [] } = useQuery({
    queryKey: ["lineCheckPoints"],
    queryFn: () => base44.entities.LineCheckPoint.list("order_index"),
  });

  const { data: checkRecords = [] } = useQuery({
    queryKey: ["lineCheckRecords", lineId],
    queryFn: () => base44.entities.LineCheckRecord.filter({ line_id: lineId }, "-created_date"),
    enabled: !!lineId,
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

  const hasDiagnostics = useMemo(() => {
    return machines.some(m => m.monitor_vibration || m.monitor_thermo || m.monitor_tribo);
  }, [machines]);

  const getMachineStatusStyles = (machineId) => {
    const activeIssues = issues.filter(i => i.machine_id === machineId || 
        (i.control_point_id && controlPoints.find(cp => cp.id === i.control_point_id && cp.machine_id === machineId)));
    
    if (activeIssues.length > 0) return { bg: "bg-red-100", text: "text-red-600", border: "border-red-200" };

    const mPoints = controlPoints.filter(p => p.machine_id === machineId);
    const hasOverdue = mPoints.some(p => getPointStatus(p) === "overdue");
    
    if (hasOverdue) return { bg: "bg-orange-100", text: "text-orange-600", border: "border-orange-200" };

    return { bg: "bg-green-100", text: "text-green-600", border: "border-green-200" };
  };

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

  const toggleSection = (sectionId) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }));
  };

  const expandAll = () => {
    const allExpanded = {};
    checkSections.forEach(section => {
      allExpanded[section.id] = true;
    });
    setExpandedSections(allExpanded);
  };

  const collapseAll = () => {
    setExpandedSections({});
  };

  const sectionCheckPoints = useMemo(() => {
    if (!checkRecordForm.section_id) return [];
    return allCheckPoints.filter(p => p.section_id === checkRecordForm.section_id);
  }, [checkRecordForm.section_id, allCheckPoints]);

  const createCheckRecordMutation = useMutation({
    mutationFn: (data) => base44.entities.LineCheckRecord.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lineCheckRecords"] });
      setShowCheckRecordDialog(false);
      setCheckRecordForm({
        section_id: "",
        check_point_id: "",
        defect_description: "",
        device_status: "V provozu",
        note: "",
        spare_part_used: "",
        downtime_estimate: "Hned za provozu",
        downtime_hours: "",
        planned_downtime_date: "",
      });
    },
  });

  const handleSaveCheckRecord = async () => {
    if (!checkRecordForm.section_id || !checkRecordForm.check_point_id || !checkRecordForm.defect_description.trim()) {
      return;
    }

    const data = {
      line_id: lineId,
      section_id: checkRecordForm.section_id,
      check_point_id: checkRecordForm.check_point_id,
      defect_description: checkRecordForm.defect_description,
      device_status: checkRecordForm.device_status,
      note: checkRecordForm.note || undefined,
      spare_part_used: checkRecordForm.spare_part_used || undefined,
      downtime_estimate: checkRecordForm.downtime_estimate,
      downtime_hours: checkRecordForm.downtime_estimate === "Vlastní čas" ? parseFloat(checkRecordForm.downtime_hours) : undefined,
      planned_downtime_date: checkRecordForm.planned_downtime_date || undefined,
    };

    await createCheckRecordMutation.mutateAsync(data);
  };

  if (!line) {
    return (
      <div className="p-8 flex items-center justify-center min-h-screen">
        <p>Načítání...</p>
      </div>
    );
  }

  const handleBackClick = () => {
    navigate(createPageUrl("Dashboard"));
  };

  const canManage = user && (user.user_type === "manager" || user.user_type === "admin" || user.user_type === "superAdmin");

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
            Zpět na hlavní dashboard
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
          <TabsList className="bg-white shadow-sm flex flex-wrap gap-1 p-2">
            <TabsTrigger value="overview">Přehled</TabsTrigger>
            {hasDiagnostics && <TabsTrigger value="diagnostics">Technická diagnostika</TabsTrigger>}
            <TabsTrigger value="lubrication">Mazání</TabsTrigger>
            <TabsTrigger value="prevention">Preventivní údržba</TabsTrigger>
            <TabsTrigger value="maintenance">Plán údržby</TabsTrigger>
            <TabsTrigger value="checklist">Checklisty</TabsTrigger>
            <TabsTrigger value="interventions">Zásahy</TabsTrigger>
            <TabsTrigger value="verification">Ověření / Test</TabsTrigger>
            <TabsTrigger value="audit">Evidence</TabsTrigger>
            <TabsTrigger value="analytics">Analytika</TabsTrigger>
          </TabsList>

          {/* Přehled */}
          <TabsContent value="overview" className="space-y-6">
             <div className="space-y-3">
                {machines.map(machine => {
                  const styles = getMachineStatusStyles(machine.id);
                  const machinePoints = controlPoints.filter(p => p.machine_id === machine.id);
                  const borderClass = styles.text.includes('red') ? 'border-l-red-500' : 
                                    styles.text.includes('orange') ? 'border-l-orange-500' : 
                                    'border-l-green-500';

                  return (
                    <Card 
                      key={machine.id} 
                      className={`cursor-pointer hover:shadow-md transition-all border-l-4 ${borderClass}`}
                      onClick={() => navigate(createPageUrl(`Machine?id=${machine.id}`))}
                    >
                      <CardContent className="p-4 flex items-center gap-4">
                        <div className={`p-2 rounded-lg flex-shrink-0 ${styles.bg} ${styles.text}`}>
                           {machine.machine_type === 'switchboard' ? <Settings className="w-6 h-6" /> : <Factory className="w-6 h-6" />}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                              <h3 className="font-bold text-lg text-slate-900 truncate">{machine.name}</h3>
                              {machine.parent_id && <Badge variant="outline" className="text-xs flex-shrink-0">Podřízený</Badge>}
                          </div>
                          <p className="text-sm text-slate-500 truncate">
                            {machine.machine_type === 'switchboard' ? 'Rozvaděč' : 'Stroj'} • {machinePoints.length} bodů
                          </p>
                        </div>

                        <div className="hidden sm:flex gap-1 flex-wrap justify-end items-center">
                            {machine.monitor_vibration && <Badge variant="secondary" className="text-[10px]">Vibrace</Badge>}
                            {machine.monitor_thermo && <Badge variant="secondary" className="text-[10px]">Termo</Badge>}
                            {machine.monitor_tribo && <Badge variant="secondary" className="text-[10px]">Tribo</Badge>}
                        </div>

                        <ChevronRight className="w-5 h-5 text-slate-400 flex-shrink-0 ml-2" />
                      </CardContent>
                    </Card>
                  );
                })}
                {machines.length === 0 && (
                  <div className="text-center py-12 bg-white rounded-lg border border-dashed">
                    <Factory className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-500">Zatím zde nejsou žádné stroje</p>
                  </div>
                )}
             </div>
          </TabsContent>

          {/* Technická diagnostika */}
          {hasDiagnostics && (
          <TabsContent value="diagnostics" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="w-5 h-5" />
                  Technická diagnostika
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="vibration">
                  <TabsList className="w-full justify-start border-b rounded-none h-auto p-0 bg-transparent space-x-6 mb-6">
                    <TabsTrigger 
                      value="vibration"
                      className="data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:shadow-none rounded-none px-0 py-2 bg-transparent"
                    >
                      <div className="flex items-center gap-2">
                        <Activity className="w-4 h-4" />
                        Vibrační diagnostika
                      </div>
                    </TabsTrigger>
                    <TabsTrigger 
                      value="thermo"
                      className="data-[state=active]:border-b-2 data-[state=active]:border-orange-500 data-[state=active]:shadow-none rounded-none px-0 py-2 bg-transparent"
                    >
                      <div className="flex items-center gap-2">
                        <Thermometer className="w-4 h-4" />
                        Termodiagnostika
                      </div>
                    </TabsTrigger>
                    <TabsTrigger 
                      value="tribo"
                      className="data-[state=active]:border-b-2 data-[state=active]:border-purple-500 data-[state=active]:shadow-none rounded-none px-0 py-2 bg-transparent"
                    >
                      <div className="flex items-center gap-2">
                        <Droplet className="w-4 h-4" />
                        Tribodiagnostika
                      </div>
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="vibration" className="mt-0">
                    {machines.filter(m => m.monitor_vibration).length === 0 ? (
                      <p className="text-center text-slate-500 py-8">Žádné stroje s aktivní vibrační diagnostikou</p>
                    ) : (
                      <div className="space-y-2">
                        {machines.filter(m => m.monitor_vibration).map((machine) => {
                           const styles = getMachineStatusStyles(machine.id);
                           return (
                             <div
                               key={machine.id}
                               className="flex items-center justify-between p-3 rounded-lg border hover:bg-slate-50 cursor-pointer transition-colors"
                               onClick={() => navigate(createPageUrl(`Machine?id=${machine.id}#vibration`))}
                             >
                               <div className="flex items-center gap-3">
                                 <div className={`p-2 rounded ${styles.bg} ${styles.text}`}>
                                   <Activity className="w-5 h-5" />
                                 </div>
                                 <div>
                                   <p className="font-medium text-slate-900">{machine.name}</p>
                                   <div className="flex gap-2 text-xs text-slate-500">
                                      <span>{machine.machine_type === 'switchboard' ? 'Rozvaděč' : 'Stroj'}</span>
                                      {machine.vibration_standard_id && <span>• Norma nastavena</span>}
                                   </div>
                                 </div>
                               </div>
                               <ChevronRight className="w-5 h-5 text-slate-400" />
                             </div>
                           );
                        })}
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="thermo" className="mt-0">
                    {machines.filter(m => m.monitor_thermo).length === 0 ? (
                      <p className="text-center text-slate-500 py-8">Žádné stroje/rozvaděče s aktivní termodiagnostikou</p>
                    ) : (
                      <div className="space-y-2">
                        {machines.filter(m => m.monitor_thermo).map((machine) => {
                             const styles = getMachineStatusStyles(machine.id);
                             return (
                               <div
                                 key={machine.id}
                                 className="flex items-center justify-between p-3 rounded-lg border hover:bg-slate-50 cursor-pointer transition-colors"
                                 onClick={() => navigate(createPageUrl(`Machine?id=${machine.id}#thermo`))}
                               >
                                 <div className="flex items-center gap-3">
                                   <div className={`p-2 rounded ${styles.bg.replace('blue', 'orange')} ${styles.text.replace('blue', 'orange')}`}>
                                     <Thermometer className="w-5 h-5" />
                                   </div>
                                   <div>
                                     <p className="font-medium text-slate-900">{machine.name}</p>
                                     <div className="flex gap-2 text-xs text-slate-500">
                                        <span>{machine.machine_type === 'switchboard' ? 'Rozvaděč' : 'Stroj'}</span>
                                     </div>
                                   </div>
                                 </div>
                                 <ChevronRight className="w-5 h-5 text-slate-400" />
                               </div>
                             );
                        })}
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="tribo" className="mt-0">
                    {machines.filter(m => m.monitor_tribo).length === 0 ? (
                      <p className="text-center text-slate-500 py-8">Žádné stroje s aktivní tribodiagnostikou</p>
                    ) : (
                      <div className="space-y-2">
                        {machines.filter(m => m.monitor_tribo).map((machine) => {
                             const styles = getMachineStatusStyles(machine.id);
                             return (
                               <div
                                 key={machine.id}
                                 className="flex items-center justify-between p-3 rounded-lg border hover:bg-slate-50 cursor-pointer transition-colors"
                                 onClick={() => navigate(createPageUrl(`Machine?id=${machine.id}#tribo`))}
                               >
                                 <div className="flex items-center gap-3">
                                   <div className={`p-2 rounded ${styles.bg.replace('blue', 'purple')} ${styles.text.replace('blue', 'purple')}`}>
                                     <Droplet className="w-5 h-5" />
                                   </div>
                                   <div>
                                     <p className="font-medium text-slate-900">{machine.name}</p>
                                     <div className="flex gap-2 text-xs text-slate-500">
                                        <span>{machine.machine_type === 'switchboard' ? 'Rozvaděč' : 'Stroj'}</span>
                                     </div>
                                   </div>
                                 </div>
                                 <ChevronRight className="w-5 h-5 text-slate-400" />
                               </div>
                             );
                        })}
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </TabsContent>
          )}

          {/* Mazání */}
          <TabsContent value="lubrication" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Droplet className="w-5 h-5" />
                  Stroje - Mazání
                </CardTitle>
              </CardHeader>
              <CardContent>
                {machines.filter(m => (m.maintenance_category || "lubrication") === "lubrication").length === 0 ? (
                  <p className="text-center text-slate-500 py-8">Žádné stroje v kategorii mazání</p>
                ) : (
                  <div className="space-y-2">
                    {machines.filter(m => (m.maintenance_category || "lubrication") === "lubrication").map((machine) => {
                      const machinePoints = controlPoints.filter(p => p.machine_id === machine.id && ['lubrication', 'inspection', 'auto_lubricator'].includes(p.type));
                      const overdueCount = machinePoints.filter(p => getPointStatus(p) === "overdue").length;
                      const issueCount = issues.filter(i => 
                        (i.machine_id === machine.id) ||
                        (i.control_point_id && machinePoints.some(p => p.id === i.control_point_id))
                      ).length;
                      
                      const statusColor = overdueCount > 0 ? "border-l-red-500" : "border-l-green-500";

                      let targetSubtab = "lubrication";
                      if (machinePoints.some(p => p.type === "lubrication")) targetSubtab = "lubrication";
                      else if (machinePoints.some(p => p.type === "inspection")) targetSubtab = "inspection";
                      else if (machinePoints.some(p => p.type === "auto_lubricator")) targetSubtab = "lubricators";

                      return (
                        <div
                          key={machine.id}
                          className={`flex items-center justify-between p-3 rounded-lg border border-l-4 hover:bg-slate-50 cursor-pointer transition-colors ${statusColor}`}
                          onClick={() => navigate(createPageUrl(`Machine?id=${machine.id}&tab=control-points&subtab=${targetSubtab}`))}
                        >
                          <div className="flex items-center gap-3">
                            <Droplet className="w-5 h-5 text-blue-600" />
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
          </TabsContent>

          {/* Preventivní údržba */}
          <TabsContent value="prevention" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ClipboardCheck className="w-5 h-5" />
                  Stroje - Preventivní údržba
                </CardTitle>
              </CardHeader>
              <CardContent>
                {machines.filter(m => controlPoints.some(cp => cp.machine_id === m.id && cp.type === "prevention")).length === 0 ? (
                  <p className="text-center text-slate-500 py-8">Žádné stroje s kontrolním bodem prevence</p>
                ) : (
                  <div className="space-y-2">
                    {machines.filter(m => controlPoints.some(cp => cp.machine_id === m.id && cp.type === "prevention")).map((machine) => {
                      const machinePoints = controlPoints.filter(p => p.machine_id === machine.id && p.type === 'prevention');
                      const overdueCount = machinePoints.filter(p => getPointStatus(p) === "overdue").length;
                      const issueCount = issues.filter(i => 
                        (i.machine_id === machine.id) ||
                        (i.control_point_id && machinePoints.some(p => p.id === i.control_point_id))
                      ).length;
                      
                      const statusColor = overdueCount > 0 ? "border-l-red-500" : "border-l-green-500";

                      return (
                        <div
                          key={machine.id}
                          className={`flex items-center justify-between p-3 rounded-lg border border-l-4 hover:bg-slate-50 cursor-pointer transition-colors ${statusColor}`}
                          onClick={() => navigate(createPageUrl(`Machine?id=${machine.id}&tab=control-points&subtab=prevention`))}
                        >
                          <div className="flex items-center gap-3">
                            <ClipboardCheck className="w-5 h-5 text-purple-600" />
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

          <TabsContent value="checklist" className="space-y-6">
            <Card>
              <CardContent className="p-12 text-center">
                <CheckSquare className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500">Checklisty budou implementovány</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="interventions" className="space-y-6">
            <Card>
              <CardContent className="p-12 text-center">
                <Wrench className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500">Zásahy budou implementovány</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="verification" className="space-y-6">
            <Card>
              <CardContent className="p-12 text-center">
                <ShieldCheck className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500">Ověření a testy budou implementovány</p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Evidence */}
          <TabsContent value="audit" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    Záznamy z kontrol
                  </CardTitle>
                  <Button
                    onClick={() => setShowCheckRecordDialog(true)}
                    className="bg-gradient-to-r from-blue-600 to-blue-700"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Přidat zápis
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {checkRecords.length === 0 ? (
                  <div className="text-center py-12">
                    <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                    <p className="text-slate-500 mb-2">Zatím nejsou žádné záznamy z kontrol</p>
                    <p className="text-xs text-slate-400">Klikněte na "Přidat zápis" pro vytvoření prvního záznamu</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {checkRecords.map((record) => {
                      const section = checkSections.find(s => s.id === record.section_id);
                      const checkPoint = allCheckPoints.find(p => p.id === record.check_point_id);
                      
                      return (
                        <div key={record.id} className="border border-slate-200 rounded-lg p-4 bg-white">
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-semibold text-slate-900">{section?.name}</h4>
                                <ChevronRight className="w-4 h-4 text-slate-400" />
                                <span className="text-slate-700">{checkPoint?.name}</span>
                              </div>
                              <p className="text-xs text-slate-500">
                                {format(new Date(record.created_date), "d. M. yyyy HH:mm", { locale: cs })} • {getUserDisplayName(record.created_by)}
                              </p>
                            </div>
                            <Badge 
                              className={
                                record.device_status === "Opraveno" 
                                  ? "bg-green-100 text-green-700"
                                  : record.device_status === "Stojí"
                                  ? "bg-red-100 text-red-700"
                                  : record.device_status === "Čeká na opravu"
                                  ? "bg-orange-100 text-orange-700"
                                  : "bg-blue-100 text-blue-700"
                              }
                            >
                              {record.device_status}
                            </Badge>
                          </div>
                          
                          <div className="space-y-2">
                            <div>
                              <p className="text-sm font-medium text-slate-700">Popis závady:</p>
                              <p className="text-sm text-slate-900">{record.defect_description}</p>
                            </div>
                            
                            {record.note && (
                              <div>
                                <p className="text-sm font-medium text-slate-700">Poznámka:</p>
                                <p className="text-sm text-slate-600">{record.note}</p>
                              </div>
                            )}
                            
                            {record.spare_part_used && (
                              <div>
                                <p className="text-sm font-medium text-slate-700">Spotřebovaný díl:</p>
                                <p className="text-sm text-slate-600">{record.spare_part_used}</p>
                              </div>
                            )}
                            
                            <div className="flex items-center gap-4 text-sm">
                              <div>
                                <span className="text-slate-700 font-medium">Odhad odstávky: </span>
                                <span className="text-slate-600">
                                  {record.downtime_estimate}
                                  {record.downtime_estimate === "Vlastní čas" && record.downtime_hours && ` (${record.downtime_hours}h)`}
                                </span>
                              </div>
                              {record.planned_downtime_date && (
                                <div>
                                  <span className="text-slate-700 font-medium">Plánováno: </span>
                                  <span className="text-slate-600">
                                    {format(new Date(record.planned_downtime_date), "d. M. yyyy", { locale: cs })}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6">
            <Card>
              <CardContent className="p-12 text-center">
                <TrendingUp className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500">Analytika bude implementována</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="space-y-6">
            <Card>
              <CardContent className="p-12 text-center">
                <Settings className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500">Nastavení bude implementováno</p>
              </CardContent>
            </Card>
          </TabsContent>

        </Tabs>
      </div>

      {/* Dialog pro přidání záznamu z kontroly */}
      <Dialog open={showCheckRecordDialog} onOpenChange={setShowCheckRecordDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Přidat zápis z kontroly</DialogTitle>
            <DialogDescription>
              Zaznamenejte výsledek kontroly kontrolního bodu
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="section">Sekce *</Label>
                <Select
                  value={checkRecordForm.section_id}
                  onValueChange={(value) => {
                    setCheckRecordForm({ 
                      ...checkRecordForm, 
                      section_id: value,
                      check_point_id: ""
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Vyberte sekci" />
                  </SelectTrigger>
                  <SelectContent>
                    {checkSections.map((section) => (
                      <SelectItem key={section.id} value={section.id}>
                        {section.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="check_point">Kontrolní bod *</Label>
                <Select
                  value={checkRecordForm.check_point_id}
                  onValueChange={(value) => setCheckRecordForm({ ...checkRecordForm, check_point_id: value })}
                  disabled={!checkRecordForm.section_id}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Vyberte bod" />
                  </SelectTrigger>
                  <SelectContent>
                    {sectionCheckPoints.map((point) => (
                      <SelectItem key={point.id} value={point.id}>
                        {point.name}
                        {point.check_parameters && (
                          <span className="text-xs text-slate-500 ml-2">({point.check_parameters})</span>
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="defect_description">Popis závady *</Label>
              <Textarea
                id="defect_description"
                value={checkRecordForm.defect_description}
                onChange={(e) => setCheckRecordForm({ ...checkRecordForm, defect_description: e.target.value })}
                placeholder="Popište zjištěnou závadu nebo stav..."
                rows={3}
              />
            </div>

            <div>
              <Label htmlFor="device_status">Současný stav zařízení *</Label>
              <Select
                value={checkRecordForm.device_status}
                onValueChange={(value) => setCheckRecordForm({ ...checkRecordForm, device_status: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="V provozu">V provozu</SelectItem>
                  <SelectItem value="Opraveno">Opraveno</SelectItem>
                  <SelectItem value="Stojí">Stojí</SelectItem>
                  <SelectItem value="Čeká na opravu">Čeká na opravu</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="note">Poznámka</Label>
              <Textarea
                id="note"
                value={checkRecordForm.note}
                onChange={(e) => setCheckRecordForm({ ...checkRecordForm, note: e.target.value })}
                placeholder="Volitelná poznámka..."
                rows={2}
              />
            </div>

            <div>
              <Label htmlFor="spare_part">Spotřebovaný náhradní díl</Label>
              <Input
                id="spare_part"
                value={checkRecordForm.spare_part_used}
                onChange={(e) => setCheckRecordForm({ ...checkRecordForm, spare_part_used: e.target.value })}
                placeholder="např. Ložisko 6205"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="downtime_estimate">Časový odhad odstávky</Label>
                <Select
                  value={checkRecordForm.downtime_estimate}
                  onValueChange={(value) => setCheckRecordForm({ ...checkRecordForm, downtime_estimate: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Hned za provozu">Hned za provozu</SelectItem>
                    <SelectItem value="O přestávce">O přestávce</SelectItem>
                    <SelectItem value="Víkend">Víkend</SelectItem>
                    <SelectItem value="Vlastní čas">Vlastní čas (hodiny)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {checkRecordForm.downtime_estimate === "Vlastní čas" && (
                <div>
                  <Label htmlFor="downtime_hours">Počet hodin</Label>
                  <Input
                    id="downtime_hours"
                    type="number"
                    value={checkRecordForm.downtime_hours}
                    onChange={(e) => setCheckRecordForm({ ...checkRecordForm, downtime_hours: e.target.value })}
                    placeholder="např. 4"
                    min="0"
                    step="0.5"
                  />
                </div>
              )}
            </div>

            <div>
              <Label htmlFor="planned_date">Datum plánované odstávky</Label>
              <Input
                id="planned_date"
                type="date"
                value={checkRecordForm.planned_downtime_date}
                onChange={(e) => setCheckRecordForm({ ...checkRecordForm, planned_downtime_date: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCheckRecordDialog(false)}
            >
              Zrušit
            </Button>
            <Button
              onClick={handleSaveCheckRecord}
              disabled={
                !checkRecordForm.section_id || 
                !checkRecordForm.check_point_id || 
                !checkRecordForm.defect_description.trim() ||
                createCheckRecordMutation.isLoading
              }
              className="bg-gradient-to-r from-blue-600 to-blue-700"
            >
              {createCheckRecordMutation.isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Ukládám...
                </>
              ) : (
                "Uložit zápis"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}