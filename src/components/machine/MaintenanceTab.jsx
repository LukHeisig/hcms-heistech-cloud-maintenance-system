import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Calendar, Wrench, AlertTriangle, ClipboardCheck, TrendingUp, Plus, CheckCircle,
  Loader2, X, Send, Clock, BarChart2, FileText
} from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import { cs } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar
} from "recharts";

export default function MaintenanceTab({
  machine,
  machineId,
  line,
  currentUser,
  allUsers,
  maintenanceRecords,
  plannedMaintenance,
  issues,
  controlPoints,
  records,
  inspectionRecords,
  getUserDisplayName,
}) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [showAddPlannedMaintenanceDialog, setShowAddPlannedMaintenanceDialog] = useState(false);
  const [showCompleteMaintenanceDialog, setShowCompleteMaintenanceDialog] = useState(false);
  const [selectedPlannedTask, setSelectedPlannedTask] = useState(null);
  const [plannedMaintenanceForm, setPlannedMaintenanceForm] = useState({
    title: "", description: "", maintenance_type: "preventive", planned_date: "",
    assigned_to: "", priority: "medium", estimated_duration_hours: null,
    estimated_cost: null, interval_days: null, notes: "",
  });
  const [completionForm, setCompletionForm] = useState({ duration_hours: null, cost: null, notes: "" });

  const canManagePlannedMaintenance = currentUser && (
    currentUser.user_type === "manager" || currentUser.user_type === "admin" || currentUser.user_type === "superAdmin"
  );

  const activePlannedTasks = plannedMaintenance.filter(t => t.status === "planned" || t.status === "assigned");

  const totalMaintenanceCost = maintenanceRecords.reduce((sum, r) => sum + (r.cost || 0), 0);

  const costByType = React.useMemo(() => {
    const costs = { preventive: 0, corrective: 0, predictive: 0, inspection: 0 };
    maintenanceRecords.forEach(record => {
      if (record.cost && record.maintenance_type) {
        costs[record.maintenance_type] = (costs[record.maintenance_type] || 0) + record.cost;
      }
    });
    return costs;
  }, [maintenanceRecords]);

  const costByTypeData = [
    { name: "Preventivní", value: costByType.preventive, color: "#10b981" },
    { name: "Korektivní", value: costByType.corrective, color: "#f59e0b" },
    { name: "Prediktivní", value: costByType.predictive, color: "#3b82f6" },
    { name: "Inspekce", value: costByType.inspection, color: "#8b5cf6" },
  ].filter(item => item.value > 0);

  const costByMonthData = React.useMemo(() => {
    const monthsData = {};
    const now = new Date();
    for (let i = 0; i < 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      monthsData[format(d, "MM/yyyy", { locale: cs })] = 0;
    }
    maintenanceRecords.forEach(record => {
      if (record.cost && record.performed_at) {
        const monthYear = format(new Date(record.performed_at), "MM/yyyy", { locale: cs });
        if (monthsData.hasOwnProperty(monthYear)) {
          monthsData[monthYear] = (monthsData[monthYear] || 0) + record.cost;
        }
      }
    });
    return Object.entries(monthsData)
      .sort((a, b) => {
        const [monthA, yearA] = a[0].split('/');
        const [monthB, yearB] = b[0].split('/');
        return new Date(yearA, monthA - 1) - new Date(yearB, monthB - 1);
      })
      .map(([month, cost]) => ({ month: format(new Date(month.split('/')[1], month.split('/')[0] - 1), "MM/yy", { locale: cs }), cost }));
  }, [maintenanceRecords]);

  const createPlannedMaintenanceMutation = useMutation({
    mutationFn: (data) => base44.entities.PlannedMaintenance.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plannedMaintenance"] });
      setShowAddPlannedMaintenanceDialog(false);
      setPlannedMaintenanceForm({ title: "", description: "", maintenance_type: "preventive", planned_date: "", assigned_to: "", priority: "medium", estimated_duration_hours: null, estimated_cost: null, interval_days: null, notes: "" });
    },
  });

  const createWorkOrderMutation = useMutation({
    mutationFn: async ({ taskId, task }) => {
      await base44.entities.PlannedMaintenance.update(taskId, { status: "assigned", work_order_created_at: new Date().toISOString() });
      if (task.assigned_to) {
        const assignedUserName = getUserDisplayName(task.assigned_to);
        await base44.integrations.Core.SendEmail({
          to: task.assigned_to,
          subject: `Nový pracovní příkaz: ${task.title}`,
          body: `Dobrý den ${assignedUserName},\n\nByl vám přiřazen nový pracovní příkaz:\n\nStroj: ${machine.name}\nÚkol: ${task.title}\nPopis: ${task.description || "Bez popisu"}\nPlánované datum: ${format(new Date(task.planned_date), "d. M. yyyy", { locale: cs })}\nPriorita: ${task.priority === "high" ? "Vysoká" : task.priority === "medium" ? "Střední" : "Nízká"}\n\nProsím přihlaste se do systému a potvrďte provedení po dokončení.\n\nS pozdravem,\nDEMIP systém`,
        });
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["plannedMaintenance"] }),
  });

  const completeMaintenanceMutation = useMutation({
    mutationFn: async ({ taskId, task, completionData }) => {
      const maintenanceRecord = await base44.entities.MaintenanceRecord.create({
        machine_id: machineId, maintenance_type: task.maintenance_type, title: task.title,
        description: task.description, performed_at: new Date().toISOString(),
        duration_hours: completionData.duration_hours, cost: completionData.cost,
        technician: currentUser?.email, notes: completionData.notes,
      });
      await base44.entities.PlannedMaintenance.update(taskId, { status: "completed", completed_at: new Date().toISOString(), maintenance_record_id: maintenanceRecord.id });
      if (task.issue_id) {
        await base44.entities.Issue.update(task.issue_id, { status: "resolved", resolved_at: new Date().toISOString(), resolved_by: currentUser?.email, resolution_note: completionData.notes ? `Vyřešeno v rámci PP: ${task.title}. Poznámka: ${completionData.notes}` : `Vyřešeno v rámci PP: ${task.title}` });
        await base44.entities.AuditLog.create({ entity_type: "Issue", entity_id: task.issue_id, changed_by: currentUser?.email || "system", change_description: `Automaticky vyřešeno dokončením pracovního příkazu "${task.title}"`, user_type: currentUser?.user_type, company_id: currentUser?.company_id || null });
      }
      return maintenanceRecord;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plannedMaintenance"] });
      queryClient.invalidateQueries({ queryKey: ["maintenanceRecords"] });
      setShowCompleteMaintenanceDialog(false);
      setSelectedPlannedTask(null);
      setCompletionForm({ duration_hours: null, cost: null, notes: "" });
    },
  });

  const cancelPlannedMaintenanceMutation = useMutation({
    mutationFn: (taskId) => base44.entities.PlannedMaintenance.update(taskId, { status: "cancelled" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["plannedMaintenance"] }),
  });

  const handleCreateWorkOrder = async (task) => {
    if (window.confirm(`Opravdu chcete vytvořit pracovní příkaz a přiřadit ho technikovi ${getUserDisplayName(task.assigned_to)}? Technik obdrží emailovou notifikaci.`)) {
      await createWorkOrderMutation.mutateAsync({ taskId: task.id, task });
    }
  };

  return (
    <>
      <Tabs defaultValue="planned" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5 bg-white shadow-sm">
          <TabsTrigger value="planned" className="gap-2">
            <Calendar className="w-4 h-4" />
            Plánovaná údržba ({activePlannedTasks.length})
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <Wrench className="w-4 h-4" />
            Historie údržby
          </TabsTrigger>
          <TabsTrigger value="active-issues" className="gap-2">
            <AlertTriangle className="w-4 h-4" />
            Aktivní závady ({issues.length})
          </TabsTrigger>
          <TabsTrigger value="inspections" className="gap-2">
            <ClipboardCheck className="w-4 h-4" />
            Inspekce ({inspectionRecords.length})
          </TabsTrigger>
          <TabsTrigger value="costs" className="gap-2">
            <TrendingUp className="w-4 h-4" />
            Náklady
          </TabsTrigger>
        </TabsList>

        {/* Plánovaná údržba */}
        <TabsContent value="planned">
          <Card className="border-none shadow-lg">
            <CardHeader className="border-b border-slate-100">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-blue-600" />
                  Plánovaná údržba
                </CardTitle>
                {canManagePlannedMaintenance && (
                  <Button onClick={() => setShowAddPlannedMaintenanceDialog(true)} className="gap-2 bg-gradient-to-r from-blue-600 to-blue-700">
                    <Plus className="w-4 h-4" />
                    Přidat plánovaný úkol
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-6">
              {activePlannedTasks.length === 0 ? (
                <div className="text-center py-12">
                  <Calendar className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500 mb-2">Zatím nejsou naplánované žádné úkoly údržby</p>
                  {canManagePlannedMaintenance && <p className="text-sm text-slate-400">Klikněte na "Přidat plánovaný úkol" pro vytvoření nového</p>}
                </div>
              ) : (
                <div className="space-y-3">
                  {activePlannedTasks.map((task) => {
                    const isOverdue = new Date(task.planned_date) < new Date() && task.status === "planned";
                    const isAssigned = task.status === "assigned";
                    const canComplete = isAssigned && (currentUser?.email === task.assigned_to || canManagePlannedMaintenance);
                    return (
                      <Card key={task.id} className={`border-l-4 ${isOverdue ? "border-l-red-500 bg-red-50/30" : isAssigned ? "border-l-blue-500 bg-blue-50/30" : "border-l-green-500 bg-green-50/30"}`}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2 flex-wrap">
                                <h3 className="font-bold text-slate-900 text-lg">{task.title}</h3>
                                <Badge className={task.maintenance_type === "preventive" ? "bg-green-100 text-green-800" : task.maintenance_type === "corrective" ? "bg-orange-100 text-orange-800" : task.maintenance_type === "predictive" ? "bg-blue-100 text-blue-800" : "bg-purple-100 text-purple-800"}>
                                  {task.maintenance_type === "preventive" ? "Preventivní" : task.maintenance_type === "corrective" ? "Korektivní" : task.maintenance_type === "predictive" ? "Prediktivní" : "Inspekce"}
                                </Badge>
                                {task.priority === "high" && <Badge variant="destructive">Vysoká priorita</Badge>}
                                {isOverdue && <Badge className="bg-red-500 text-white">Po termínu</Badge>}
                                {isAssigned && <Badge className="bg-blue-500 text-white">Pracovní příkaz vytvořen</Badge>}
                              </div>
                              {task.description && <p className="text-sm text-slate-600 mb-3">{task.description}</p>}
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                                <div className="bg-white rounded-lg p-2 border border-slate-200">
                                  <p className="text-xs text-slate-500">Plánované datum</p>
                                  <p className={`text-sm font-medium ${isOverdue ? "text-red-700" : "text-slate-900"}`}>{format(new Date(task.planned_date), "d. M. yyyy", { locale: cs })}</p>
                                </div>
                                {task.assigned_to && <div className="bg-white rounded-lg p-2 border border-slate-200"><p className="text-xs text-slate-500">Přiřazeno</p><p className="text-sm font-medium text-slate-900">{getUserDisplayName(task.assigned_to)}</p></div>}
                                {task.estimated_duration_hours && <div className="bg-white rounded-lg p-2 border border-slate-200"><p className="text-xs text-slate-500">Odhad. čas</p><p className="text-sm font-medium text-slate-900">{task.estimated_duration_hours}h</p></div>}
                                {task.estimated_cost && <div className="bg-white rounded-lg p-2 border border-slate-200"><p className="text-xs text-slate-500">Odhad. náklady</p><p className="text-sm font-medium text-slate-900">{task.estimated_cost.toLocaleString()} Kč</p></div>}
                              </div>
                              {task.notes && <p className="text-xs text-slate-500 italic bg-slate-50 p-2 rounded">{task.notes}</p>}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            {canManagePlannedMaintenance && !isAssigned && (
                              <Button size="sm" onClick={() => handleCreateWorkOrder(task)} className="gap-2 bg-blue-600 hover:bg-blue-700" disabled={!task.assigned_to || createWorkOrderMutation.isPending}>
                                {createWorkOrderMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                Vytvořit pracovní příkaz
                              </Button>
                            )}
                            {canComplete && (
                              <Button size="sm" onClick={() => { setSelectedPlannedTask(task); setCompletionForm({ duration_hours: task.estimated_duration_hours || null, cost: task.estimated_cost || null, notes: "" }); setShowCompleteMaintenanceDialog(true); }} className="gap-2 bg-green-600 hover:bg-green-700">
                                <CheckCircle className="w-4 h-4" /> Potvrdit provedení
                              </Button>
                            )}
                            {canManagePlannedMaintenance && task.status === "planned" && (
                              <Button size="sm" variant="outline" onClick={() => { if (window.confirm("Opravdu chcete zrušit tento plánovaný úkol?")) { cancelPlannedMaintenanceMutation.mutate(task.id); } }} className="gap-2 text-red-600 hover:text-red-700">
                                <X className="w-4 h-4" /> Zrušit
                              </Button>
                            )}
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

        {/* Historie */}
        <TabsContent value="history">
          <Card className="border-none shadow-lg">
            <CardHeader className="border-b border-slate-100">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2"><Wrench className="w-5 h-5 text-green-600" />Historie pracovních příkazů (WO)</CardTitle>
                <Badge variant="outline" className="text-sm">{maintenanceRecords.length} záznamů</Badge>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              {maintenanceRecords.length === 0 ? (
                <div className="text-center py-12"><Wrench className="w-16 h-16 text-slate-300 mx-auto mb-4" /><p className="text-slate-500 mb-2">Zatím nejsou záznamy o údržbě</p></div>
              ) : (
                <div className="space-y-3">
                  {maintenanceRecords.map((record) => (
                    <Card key={record.id} className="border border-slate-200">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <Badge className={record.maintenance_type === "preventive" ? "bg-green-100 text-green-800" : record.maintenance_type === "corrective" ? "bg-orange-100 text-orange-800" : record.maintenance_type === "predictive" ? "bg-blue-100 text-blue-800" : "bg-purple-100 text-purple-800"}>
                            {record.maintenance_type === "preventive" ? "Preventivní" : record.maintenance_type === "corrective" ? "Korektivní" : record.maintenance_type === "predictive" ? "Prediktivní" : "Inspekce"}
                          </Badge>
                          <h3 className="font-bold text-slate-900">{record.title}</h3>
                        </div>
                        <p className="text-sm text-slate-600 mb-2">{record.description}</p>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <div className="bg-slate-50 rounded-lg p-2"><p className="text-xs text-slate-500">Datum</p><p className="text-sm font-medium text-slate-900">{format(new Date(record.performed_at), "d.M. yyyy HH:mm", { locale: cs })}</p></div>
                          {record.duration_hours && <div className="bg-slate-50 rounded-lg p-2"><p className="text-xs text-slate-500">Doba</p><p className="text-sm font-medium text-slate-900">{record.duration_hours}h</p></div>}
                          {record.technician && <div className="bg-slate-50 rounded-lg p-2"><p className="text-xs text-slate-500">Technik</p><p className="text-sm font-medium text-slate-900">{getUserDisplayName(record.technician)}</p></div>}
                          {record.cost && <div className="bg-green-50 rounded-lg p-2"><p className="text-xs text-green-700">Náklady</p><p className="text-sm font-bold text-green-900">{record.cost.toLocaleString()} Kč</p></div>}
                        </div>
                        {record.notes && <p className="text-xs text-slate-500 mt-2 italic bg-slate-50 p-2 rounded">{record.notes}</p>}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Aktivní závady */}
        <TabsContent value="active-issues">
          <Card className="border-none shadow-lg">
            <CardHeader className="border-b border-slate-100">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-orange-600" />Aktuální otevřené závady / WO</CardTitle>
                {issues.length > 0 && <Badge variant="destructive">{issues.length} aktivních</Badge>}
              </div>
            </CardHeader>
            <CardContent className="p-6">
              {issues.length === 0 ? (
                <div className="text-center py-12"><CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" /><h3 className="text-lg font-semibold text-slate-900 mb-2">Žádné aktivní závady</h3></div>
              ) : (
                <div className="space-y-3">
                  {issues.map((issue) => {
                    const point = controlPoints.find(p => p.id === issue.control_point_id);
                    return (
                      <Card key={issue.id} className="border-l-4 border-l-orange-500 bg-orange-50/30">
                        <CardContent className="p-4">
                          <div className="flex items-center gap-2 mb-1"><AlertTriangle className="w-4 h-4 text-orange-600" /><h3 className="font-bold text-slate-900">{point?.name || "Neznámý bod"}</h3><Badge className="bg-orange-500 text-white">Aktivní</Badge></div>
                          <p className="text-sm text-slate-700 bg-white p-3 rounded-lg border border-orange-200 mb-2">{issue.description}</p>
                          <div className="flex items-center gap-3 text-xs text-slate-500">
                            <span>Nahlášeno: {format(new Date(issue.created_date), "d. M. yyyy HH:mm", { locale: cs })}</span>
                            <span>•</span><span>{getUserDisplayName(issue.created_by)}</span>
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

        {/* Inspekce */}
        <TabsContent value="inspections">
          <Card className="border-none shadow-lg">
            <CardHeader className="border-b border-slate-100">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2"><ClipboardCheck className="w-5 h-5 text-purple-600" />Záznamy o kontrolách a inspekcích</CardTitle>
                <Badge variant="outline">{inspectionRecords.length} záznamů</Badge>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              {inspectionRecords.length === 0 ? (
                <div className="text-center py-12"><ClipboardCheck className="w-16 h-16 text-slate-300 mx-auto mb-4" /><p className="text-slate-500">Zatím nebyly provedeny žádné inspekce</p></div>
              ) : (
                <div className="space-y-2">
                  {inspectionRecords.map((record) => {
                    const point = controlPoints.find(p => p.id === record.control_point_id);
                    return (
                      <div key={record.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 border border-slate-200">
                        <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0"><ClipboardCheck className="w-5 h-5 text-purple-600" /></div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-900 truncate">{point?.name || "Neznámý bod"}</p>
                          <p className="text-xs text-slate-500">{format(new Date(record.performed_at), "d.M. yyyy HH:mm", { locale: cs })} • {getUserDisplayName(record.created_by)}</p>
                          {record.note && <p className="text-xs text-slate-600 mt-1 italic">{record.note}</p>}
                        </div>
                        <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">Provedeno</Badge>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Náklady */}
        <TabsContent value="costs" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="border-none shadow-lg bg-gradient-to-br from-green-500 to-green-600 text-white"><CardContent className="p-6"><p className="text-green-100 text-sm font-medium mb-1">Celkové náklady</p><p className="text-3xl font-bold">{totalMaintenanceCost.toLocaleString()} Kč</p></CardContent></Card>
            <Card className="border-none shadow-lg bg-gradient-to-br from-emerald-500 to-emerald-600 text-white"><CardContent className="p-6"><p className="text-emerald-100 text-sm font-medium mb-1">Preventivní</p><p className="text-2xl font-bold">{costByType.preventive.toLocaleString()} Kč</p></CardContent></Card>
            <Card className="border-none shadow-lg bg-gradient-to-br from-amber-500 to-amber-600 text-white"><CardContent className="p-6"><p className="text-amber-100 text-sm font-medium mb-1">Korektivní</p><p className="text-2xl font-bold">{costByType.corrective.toLocaleString()} Kč</p></CardContent></Card>
            <Card className="border-none shadow-lg bg-gradient-to-br from-blue-500 to-blue-600 text-white"><CardContent className="p-6"><p className="text-blue-100 text-sm font-medium mb-1">Průměrné náklady</p><p className="text-2xl font-bold">{maintenanceRecords.length > 0 ? Math.round(totalMaintenanceCost / maintenanceRecords.length).toLocaleString() : 0} Kč</p></CardContent></Card>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="border-none shadow-lg">
              <CardHeader className="border-b border-slate-100"><CardTitle className="flex items-center gap-2"><BarChart2 className="w-5 h-5 text-green-600" />Náklady podle typu údržby</CardTitle></CardHeader>
              <CardContent className="p-6">
                {costByTypeData.length === 0 ? <p className="text-center text-slate-500 py-8">Zatím nejsou data o nákladech</p> : (
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart><Pie data={costByTypeData} cx="50%" cy="50%" labelLine={false} label={({ name, value }) => `${name}: ${value.toLocaleString()} Kč`} outerRadius={80} dataKey="value">{costByTypeData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}</Pie><Tooltip formatter={(value) => `${value.toLocaleString()} Kč`} /></PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
            <Card className="border-none shadow-lg">
              <CardHeader className="border-b border-slate-100"><CardTitle className="flex items-center gap-2"><TrendingUp className="w-5 h-5 text-blue-600" />Vývoj nákladů v čase</CardTitle></CardHeader>
              <CardContent className="p-6">
                {costByMonthData.length === 0 || costByMonthData.every(d => d.cost === 0) ? <p className="text-center text-slate-500 py-8">Zatím nejsou data o nákladech</p> : (
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={costByMonthData}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis dataKey="month" stroke="#64748b" /><YAxis stroke="#64748b" /><Tooltip formatter={(value) => `${value.toLocaleString()} Kč`} /><Bar dataKey="cost" fill="#10b981" name="Náklady (Kč)" /></BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Dialog pro přidání plánované údržby */}
      <Dialog open={showAddPlannedMaintenanceDialog} onOpenChange={setShowAddPlannedMaintenanceDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Přidat plánovaný úkol údržby</DialogTitle><DialogDescription>Vytvořte nový plánovaný úkol údržby pro stroj {machine?.name}</DialogDescription></DialogHeader>
          <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
            <div><Label>Název úkolu *</Label><Input value={plannedMaintenanceForm.title} onChange={(e) => setPlannedMaintenanceForm({ ...plannedMaintenanceForm, title: e.target.value })} placeholder="Např. Výměna oleje, Kontrola ložisek..." /></div>
            <div><Label>Popis</Label><Textarea value={plannedMaintenanceForm.description} onChange={(e) => setPlannedMaintenanceForm({ ...plannedMaintenanceForm, description: e.target.value })} rows={3} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Typ údržby *</Label>
                <Select value={plannedMaintenanceForm.maintenance_type} onValueChange={(value) => setPlannedMaintenanceForm({ ...plannedMaintenanceForm, maintenance_type: value })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="preventive">Preventivní údržba</SelectItem>
                    <SelectItem value="corrective">Korektivní údržba</SelectItem>
                    <SelectItem value="predictive">Prediktivní údržba</SelectItem>
                    <SelectItem value="inspection">Inspekce</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Priorita</Label>
                <Select value={plannedMaintenanceForm.priority} onValueChange={(value) => setPlannedMaintenanceForm({ ...plannedMaintenanceForm, priority: value })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="low">Nízká</SelectItem><SelectItem value="medium">Střední</SelectItem><SelectItem value="high">Vysoká</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Plánované datum *</Label><Input type="date" value={plannedMaintenanceForm.planned_date} onChange={(e) => setPlannedMaintenanceForm({ ...plannedMaintenanceForm, planned_date: e.target.value })} /></div>
              <div><Label>Přiřadit technikovi</Label>
                <Select value={plannedMaintenanceForm.assigned_to} onValueChange={(value) => setPlannedMaintenanceForm({ ...plannedMaintenanceForm, assigned_to: value })}>
                  <SelectTrigger><SelectValue placeholder="Vyberte technika" /></SelectTrigger>
                  <SelectContent>
                    {allUsers.filter(u => {
                      const targetCompanyId = line?.company_id;
                      if (!targetCompanyId) return true;
                      const isAssigned = u.company_id === targetCompanyId || (Array.isArray(u.assigned_company_ids) && u.assigned_company_ids.includes(targetCompanyId));
                      const hasRole = u.user_type === "technician" || u.user_type === "manager" || (u.user_type === "admin" && isAssigned);
                      return isAssigned && hasRole;
                    }).map((user) => <SelectItem key={user.id} value={user.email}>{getUserDisplayName(user.email)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Odhadovaná doba (hodiny)</Label><Input type="number" step="0.5" value={plannedMaintenanceForm.estimated_duration_hours || ""} onChange={(e) => setPlannedMaintenanceForm({ ...plannedMaintenanceForm, estimated_duration_hours: e.target.value ? parseFloat(e.target.value) : null })} placeholder="Např. 2" /></div>
              <div><Label>Odhadované náklady (Kč)</Label><Input type="number" value={plannedMaintenanceForm.estimated_cost || ""} onChange={(e) => setPlannedMaintenanceForm({ ...plannedMaintenanceForm, estimated_cost: e.target.value ? parseFloat(e.target.value) : null })} placeholder="Např. 5000" /></div>
            </div>
            <div><Label>Poznámky</Label><Textarea value={plannedMaintenanceForm.notes} onChange={(e) => setPlannedMaintenanceForm({ ...plannedMaintenanceForm, notes: e.target.value })} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddPlannedMaintenanceDialog(false)}>Zrušit</Button>
            <Button onClick={() => createPlannedMaintenanceMutation.mutate({ machine_id: machineId, ...plannedMaintenanceForm })} disabled={!plannedMaintenanceForm.title || !plannedMaintenanceForm.planned_date || createPlannedMaintenanceMutation.isPending} className="bg-gradient-to-r from-blue-600 to-blue-700">
              {createPlannedMaintenanceMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Přidávám...</> : <><Plus className="w-4 h-4 mr-2" />Přidat úkol</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog pro potvrzení provedení */}
      <Dialog open={showCompleteMaintenanceDialog} onOpenChange={setShowCompleteMaintenanceDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Potvrdit provedení údržby</DialogTitle><DialogDescription>Vyplňte skutečné údaje o provedené údržbě: {selectedPlannedTask?.title}</DialogDescription></DialogHeader>
          <div className="space-y-4 py-4">
            <div><Label>Skutečná doba trvání (hodiny) *</Label><Input type="number" step="0.5" value={completionForm.duration_hours || ""} onChange={(e) => setCompletionForm({ ...completionForm, duration_hours: e.target.value ? parseFloat(e.target.value) : null })} placeholder="Např. 2.5" /></div>
            <div><Label>Skutečné náklady (Kč)</Label><Input type="number" value={completionForm.cost || ""} onChange={(e) => setCompletionForm({ ...completionForm, cost: e.target.value ? parseFloat(e.target.value) : null })} placeholder="Např. 5000" /></div>
            <div><Label>Poznámky k provedení *</Label><Textarea value={completionForm.notes} onChange={(e) => setCompletionForm({ ...completionForm, notes: e.target.value })} rows={4} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCompleteMaintenanceDialog(false)}>Zrušit</Button>
            <Button onClick={() => completeMaintenanceMutation.mutateAsync({ taskId: selectedPlannedTask.id, task: selectedPlannedTask, completionData: completionForm })} disabled={!completionForm.duration_hours || !completionForm.notes || completeMaintenanceMutation.isPending} className="bg-gradient-to-r from-green-600 to-green-700">
              {completeMaintenanceMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Dokončuji...</> : <><CheckCircle className="w-4 h-4 mr-2" />Potvrdit provedení</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}