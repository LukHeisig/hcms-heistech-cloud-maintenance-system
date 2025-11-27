import React, { useState, useRef, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  Droplet,
  ClipboardCheck,
  AlertTriangle,
  Plus,
  Calendar,
  Clock,
  Pencil,
  Trash2,
  CheckCircle,
  XCircle,
  Download,
  Upload,
  ChevronRight,
  Wrench,
  Activity,
  TrendingUp,
  FileText,
  Loader2,
  Package,
  Users,
  User,
  Bell,
  Image as ImageIcon,
  LayoutDashboard,
  Settings,
  BarChart2,
  Building2,
  Factory,
  Camera,
  X,
  FileIcon,
  FileImage,
  FileJson,
  Send,
  FileSpreadsheet
} from "lucide-react";
import VibrationJobDialog from "@/components/machine/VibrationJobDialog";
import VibrationCard from "@/components/machine/VibrationCard";
import ThermoJobDialog from "@/components/machine/ThermoJobDialog";
import ThermoCard from "@/components/machine/ThermoCard";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export default function Machine() {
  const navigate = useNavigate();
  const urlParams = new URLSearchParams(window.location.search);
  const machineId = urlParams.get("id");

  const queryClient = useQueryClient();
  const [currentUser, setCurrentUser] = useState(null);

  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [uploadingCategory, setUploadingCategory] = useState("drawing");
  const [selectedUploadFile, setSelectedUploadFile] = useState(null);
  const [uploadFileName, setUploadFileName] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const [deleteDocId, setDeleteDocId] = useState(null);
  const [showDocPreviewDialog, setShowDocPreviewDialog] = useState(false);
  const [selectedDocPreview, setSelectedDocPreview] = useState(null);

  const [showAddPlannedMaintenanceDialog, setShowAddPlannedMaintenanceDialog] = useState(false);
  const [showCompleteMaintenanceDialog, setShowCompleteMaintenanceDialog] = useState(false);
  const [showVibrationDialog, setShowVibrationDialog] = useState(false);
  const [editingVibrationJob, setEditingVibrationJob] = useState(null);
  const [showThermoDialog, setShowThermoDialog] = useState(false);
  const [editingThermoJob, setEditingThermoJob] = useState(null);
  const [selectedPlannedTask, setSelectedPlannedTask] = useState(null);
  const [plannedMaintenanceForm, setPlannedMaintenanceForm] = useState({
    title: "",
    description: "",
    maintenance_type: "preventive",
    planned_date: "",
    assigned_to: "",
    priority: "medium",
    estimated_duration_hours: null,
    estimated_cost: null,
    interval_days: null,
    notes: "",
  });
  const [completionForm, setCompletionForm] = useState({
    duration_hours: null,
    cost: null,
    notes: "",
  });

  useEffect(() => {
    loadCurrentUser();
    
    if (window.location.hash === "#maintenance") {
      setTimeout(() => {
        const maintenanceTab = document.querySelector('[value="maintenance"]');
        if (maintenanceTab) {
          maintenanceTab.click();
        }
      }, 100);
    }
  }, []);

  const loadCurrentUser = async () => {
    try {
      const user = await base44.auth.me();
      setCurrentUser(user);
    } catch (error) {
      console.error("Failed to load current user:", error);
      setCurrentUser(null);
    }
  };

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
      const companies = await base44.entities.Company.filter({ id: line.company_id });
      return companies[0];
    },
    enabled: !!line?.company_id,
    staleTime: 1000 * 60 * 5,
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ["allUsers"],
    queryFn: () => base44.entities.User.list(),
  });

  const userMap = React.useMemo(() => {
    return allUsers.reduce((acc, u) => {
      acc[u.email] = u;
      return acc;
    }, {});
  }, [allUsers]);

  const getUserDisplayName = (email) => {
    const u = userMap[email];
    return u ? (u.custom_display_name || u.full_name || u.email) : email;
  };

  const { data: controlPoints = [] } = useQuery({
    queryKey: ["controlPoints", machineId],
    queryFn: () => base44.entities.ControlPoint.filter({ machine_id: machineId }),
    enabled: !!machineId,
  });

  const { data: records = [] } = useQuery({
    queryKey: ["records", machineId, controlPoints.map(cp => cp.id).join(',')],
    queryFn: async () => {
      const allRecords = await base44.entities.ControlRecord.list("-performed_at", 500);
      return allRecords.filter(record =>
        controlPoints.some(point => point.id === record.control_point_id)
      );
    },
    enabled: !!machineId && controlPoints.length > 0,
    staleTime: 1000 * 60,
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

  const { data: plannedMaintenance = [] } = useQuery({
    queryKey: ["plannedMaintenance", machineId],
    queryFn: () => base44.entities.PlannedMaintenance.filter({ 
      machine_id: machineId,
      status: ["planned", "assigned"]
    }, "planned_date"),
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

  const { data: vibrationJobs = [] } = useQuery({
    queryKey: ["vibrationJobs", machineId],
    queryFn: () => base44.entities.VibrationJob.filter({ machine_id: machineId }, "-date"),
    enabled: !!machineId
  });

  const { data: thermoJobs = [] } = useQuery({
    queryKey: ["thermoJobs", machineId],
    queryFn: () => base44.entities.ThermoJob.filter({ machine_id: machineId }, "-measurement_date"),
    enabled: !!machineId
  });

  const { data: responsibilities = [] } = useQuery({
    queryKey: ["responsibilities", machineId],
    queryFn: () => base44.entities.MachineResponsibility.filter({ machine_id: machineId }),
    enabled: !!machineId,
  });

  const inspectionRecords = React.useMemo(() => {
    if (!controlPoints || controlPoints.length === 0) return [];

    const machineControlPoints = controlPoints.filter(cp => cp.machine_id === machineId);
    const machineControlPointIds = machineControlPoints.map(cp => cp.id);
    return records.filter(r => r.record_type === "inspection" && machineControlPointIds.includes(r.control_point_id));
  }, [records, controlPoints, machineId]);

  const totalMaintenanceCost = maintenanceRecords.reduce((sum, r) => sum + (r.cost || 0), 0);
  
  const costByType = React.useMemo(() => {
    const costs = {
      preventive: 0,
      corrective: 0,
      predictive: 0,
      inspection: 0,
    };
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

  const getPointStatus = (point) => {
    const pointRecords = records.filter((r) => r.control_point_id === point.id);
    
    const vizType = company?.overdue_visualization_type || "two_colors";
    const tolerance = company?.overdue_tolerance_percent || 4;
    const interval = point.interval_hours || 0;

    if (pointRecords.length === 0) {
         return vizType === "traffic_light" ? "critical" : "warning";
    }

    const latestRecord = pointRecords[0];
    const lastPerformed = new Date(latestRecord.performed_at);
    const now = new Date();
    const hoursSince = (now - lastPerformed) / (1000 * 60 * 60);

    if (hoursSince <= interval) return "ok";

    if (vizType === "two_colors") {
        return "warning";
    } else {
        const overduePercent = ((hoursSince - interval) / interval) * 100;
        if (overduePercent <= tolerance) {
            return "warning";
        } else {
            return "critical";
        }
    }
  };

  const getNextControlDate = (point) => {
    const pointRecords = records.filter(r => r.control_point_id === point.id);
    if (pointRecords.length === 0 || !point.interval_hours) return null;

    const latestRecord = pointRecords[0];
    const lastPerformed = new Date(latestRecord.performed_at);
    const nextDate = new Date(lastPerformed.getTime() + point.interval_hours * 60 * 60 * 1000);
    return nextDate;
  };

  const upcomingTasks = React.useMemo(() => {
    const tasks = [];
    
    controlPoints.forEach(point => {
      const nextDate = getNextControlDate(point);
      if (nextDate) {
        tasks.push({
          type: "control_point",
          id: point.id,
          name: point.name,
          date: nextDate,
          controlType: point.type,
          point: point,
        });
      }
    });
    
    plannedMaintenance.forEach(maintenance => {
      if (maintenance.planned_date) {
        tasks.push({
          type: "planned_maintenance",
          id: maintenance.id,
          name: maintenance.title,
          date: new Date(maintenance.planned_date),
          maintenanceType: maintenance.maintenance_type,
          priority: maintenance.priority,
          assignedTo: maintenance.assigned_to,
          status: maintenance.status,
          maintenance: maintenance,
        });
      }
    });
    
    return tasks.sort((a, b) => a.date.getTime() - b.date.getTime()).slice(0, 5);
  }, [controlPoints, plannedMaintenance, records]);

  const lubricationPoints = controlPoints.filter(p => p.type === "lubrication");
  const inspectionPoints = controlPoints.filter(p => p.type === "inspection");
  const lubricatorPoints = controlPoints.filter(p => p.type === "auto_lubricator");

  const overduePoints = controlPoints.filter(p => getPointStatus(p) === "overdue");
  const okPoints = controlPoints.filter(p => getPointStatus(p) === "ok");

  const getGroupStatus = (points) => {
    if (points.length === 0) return null;
    const hasOverdue = points.some(p => getPointStatus(p) === "overdue");
    return hasOverdue ? "overdue" : "ok";
  };

  const lubricationStatus = getGroupStatus(lubricationPoints);
  const inspectionStatus = getGroupStatus(inspectionPoints);
  const lubricatorsStatus = getGroupStatus(lubricatorPoints);

  const lowStockParts = spareParts.filter(p => p.quantity_in_stock <= (p.minimum_stock || 0));

  const vibrationTrendData = vibrationMeasurements.slice(0, 10).reverse().map(m => ({
    date: format(new Date(m.measurement_date), "d.M.", { locale: cs }),
    vRMS: m.v_rms || 0,
    aRMS: m.a_rms || 0,
    temp: m.temperature || 0,
  }));

  // Visibility Logic
  const showDemip = company?.enable_demip !== false && controlPoints.length > 0;
  const showMaintenance = company?.enable_maintenance !== false && (maintenanceRecords.length > 0 || plannedMaintenance.length > 0);
  const showParts = company?.enable_parts !== false && spareParts.length > 0;
  const showVibration = company?.enable_vibration !== false && (machine?.monitor_vibration || vibrationMeasurements.length > 0 || vibrationJobs.length > 0);
  const showThermo = company?.enable_thermo !== false && (machine?.monitor_thermo || thermoJobs.length > 0);
  const showTribo = company?.enable_tribo !== false && machine?.monitor_tribo;

  const maintenanceTypeData = [
    { name: "Preventivní", value: maintenanceRecords.filter(r => r.maintenance_type === "preventive").length, color: "#10b981" },
    { name: "Reaktivní", value: maintenanceRecords.filter(r => r.maintenance_type === "corrective").length, color: "#f59e0b" },
    { name: "Prediktivní", value: maintenanceRecords.filter(r => r.maintenance_type === "predictive").length, color: "#3b82f6" },
    { name: "Inspekce", value: maintenanceRecords.filter(r => r.maintenance_type === "inspection").length, color: "#8b5cf6" },
  ].filter(item => item.value > 0);

  const createPlannedMaintenanceMutation = useMutation({
    mutationFn: (data) => base44.entities.PlannedMaintenance.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plannedMaintenance"] });
      setShowAddPlannedMaintenanceDialog(false);
      setPlannedMaintenanceForm({
        title: "",
        description: "",
        maintenance_type: "preventive",
        planned_date: "",
        assigned_to: "",
        priority: "medium",
        estimated_duration_hours: null,
        estimated_cost: null,
        interval_days: null,
        notes: "",
      });
    },
    onError: (error) => {
      console.error("Error creating planned maintenance:", error);
      alert("Chyba při vytváření plánovaného úkolu: " + error.message);
    }
  });

  const createWorkOrderMutation = useMutation({
    mutationFn: async ({ taskId, task }) => {
      await base44.entities.PlannedMaintenance.update(taskId, {
        status: "assigned",
        work_order_created_at: new Date().toISOString(),
      });
      
      if (task.assigned_to) {
        const assignedUserName = getUserDisplayName(task.assigned_to);
        
        await base44.integrations.Core.SendEmail({
          to: task.assigned_to,
          subject: `Nový pracovní příkaz: ${task.title}`,
          body: `Dobrý den ${assignedUserName},\n\nByl vám přiřazen nový pracovní příkaz:\n\nStroj: ${machine.name}\nÚkol: ${task.title}\nPopis: ${task.description || "Bez popisu"}\nPlánované datum: ${format(new Date(task.planned_date), "d. M. yyyy", { locale: cs })}\nPriorita: ${task.priority === "high" ? "Vysoká" : task.priority === "medium" ? "Střední" : "Nízká"}\n\nProsím přihlaste se do systému a potvrďte provedení po dokončení.\n\nS pozdravem,\nDEMIP systém`,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plannedMaintenance"] });
    },
    onError: (error) => {
      console.error("Error creating work order:", error);
      alert("Chyba při vytváření pracovního příkazu: " + error.message);
    }
  });

  const completeMaintenanceMutation = useMutation({
    mutationFn: async ({ taskId, task, completionData }) => {
      const maintenanceRecord = await base44.entities.MaintenanceRecord.create({
        machine_id: machineId,
        maintenance_type: task.maintenance_type,
        title: task.title,
        description: task.description,
        performed_at: new Date().toISOString(),
        duration_hours: completionData.duration_hours,
        cost: completionData.cost,
        technician: currentUser?.email,
        notes: completionData.notes,
      });

      await base44.entities.PlannedMaintenance.update(taskId, {
        status: "completed",
        completed_at: new Date().toISOString(),
        maintenance_record_id: maintenanceRecord.id,
      });

      return maintenanceRecord;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plannedMaintenance"] });
      queryClient.invalidateQueries({ queryKey: ["maintenanceRecords"] });
      setShowCompleteMaintenanceDialog(false);
      setSelectedPlannedTask(null);
      setCompletionForm({
        duration_hours: null,
        cost: null,
        notes: "",
      });
    },
    onError: (error) => {
      console.error("Error completing maintenance:", error);
      alert("Chyba při potvrzování provedení údržby: " + error.message);
    }
  });

  const cancelPlannedMaintenanceMutation = useMutation({
    mutationFn: (taskId) => base44.entities.PlannedMaintenance.update(taskId, { status: "cancelled" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plannedMaintenance"] });
    },
    onError: (error) => {
      console.error("Error cancelling planned maintenance:", error);
      alert("Chyba při rušení plánovaného úkolu: " + error.message);
    }
  });

  const canManagePlannedMaintenance = currentUser && (
    currentUser.user_type === "manager" ||
    currentUser.user_type === "admin" ||
    currentUser.user_type === "superAdmin"
  );

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

  const getFileIcon = (fileType) => {
    switch (fileType) {
      case "photo":
        return <FileImage className="w-8 h-8 text-blue-500" />;
      case "schema":
        return <FileText className="w-8 h-8 text-purple-500" />;
      case "document":
        return <FileText className="w-8 h-8 text-green-500" />;
      case "other_file":
        return <FileIcon className="w-8 h-8 text-slate-500" />;
      case "application/pdf":
        return <FileText className="w-8 h-8 text-red-500" />;
      case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      case "application/msword":
        return <FileText className="w-8 h-8 text-blue-500" />;
      case "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
      case "application/vnd.ms-excel":
        return <FileText className="w-8 h-8 text-green-500" />;
      case "image/jpeg":
      case "image/png":
      case "image/gif":
        return <FileImage className="w-8 h-8 text-blue-500" />;
      default:
        return <FileIcon className="w-8 h-8 text-slate-500" />;
    }
  };

  const handleFileUpload = async () => {
    if (!selectedUploadFile || !uploadFileName.trim() || !uploadingCategory) return;

    setIsUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file: selectedUploadFile });
      
      let detectedFileType = "other_file";
      if (selectedUploadFile.type.startsWith("image/")) {
        detectedFileType = "photo";
      } else if (selectedUploadFile.type === "application/pdf") {
        detectedFileType = "document";
      } else if (selectedUploadFile.name.toLowerCase().endsWith(".dwg") || selectedUploadFile.name.toLowerCase().endsWith(".dxf")) {
          detectedFileType = "schema";
      } else if (selectedUploadFile.type.includes("word") || selectedUploadFile.type.includes("excel")) {
          detectedFileType = "document";
      }
      
      await base44.entities.Documentation.create({
        machine_id: machineId,
        file_url,
        file_name: uploadFileName,
        file_type: detectedFileType,
        category: uploadingCategory,
      });
      queryClient.invalidateQueries({ queryKey: ["documentation"] });
      setShowUploadDialog(false);
      setSelectedUploadFile(null);
      setUploadFileName("");
      setUploadingCategory("drawing");
    } catch (error) {
      console.error("Error uploading file:", error);
      alert("Chyba při nahrávání souboru: " + error.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteDoc = async () => {
    if (deleteDocId) {
      await base44.entities.Documentation.delete(deleteDocId);
      queryClient.invalidateQueries({ queryKey: ["documentation"] });
      setDeleteDocId(null);
    }
  };

  const handleAddPlannedMaintenance = async () => {
    await createPlannedMaintenanceMutation.mutateAsync({
      machine_id: machineId,
      ...plannedMaintenanceForm,
    });
  };

  const handleCreateWorkOrder = async (task) => {
    if (window.confirm(`Opravdu chcete vytvořit pracovní příkaz a přiřadit ho technikovi ${getUserDisplayName(task.assigned_to)}? Technik obdrží emailovou notifikaci.`)) {
      await createWorkOrderMutation.mutateAsync({ taskId: task.id, task });
    }
  };

  const handleCompleteMaintenance = async () => {
    await completeMaintenanceMutation.mutateAsync({
      taskId: selectedPlannedTask.id,
      task: selectedPlannedTask,
      completionData: completionForm,
    });
  };

  const activePlannedTasks = plannedMaintenance.filter(t => t.status === "planned" || t.status === "assigned");
  const completedPlannedTasks = plannedMaintenance.filter(t => t.status === "completed");

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

          const isCritical = status === "critical";
          const isWarning = status === "warning" || status === "overdue";
          
          return (
            <Card
              key={point.id}
              className={`cursor-pointer transition-all hover:shadow-md border-l-4 ${
                isCritical ? "border-l-red-500 bg-red-50/50" :
                isWarning ? "border-l-yellow-500 bg-yellow-50/50" :
                "border-l-green-500 bg-green-50/50"
              }`}
              onClick={() => navigate(createPageUrl(`ControlPoint?id=${point.id}`))}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 flex-1">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      isCritical ? "bg-red-100" :
                      isWarning ? "bg-yellow-100" : "bg-green-100"
                    }`}>
                      {type === "lubrication" ? (
                        <Droplet className={`w-5 h-5 ${isCritical ? "text-red-700" : isWarning ? "text-yellow-700" : "text-green-700"}`} />
                      ) : type === "inspection" ? (
                        <ClipboardCheck className={`w-5 h-5 ${isCritical ? "text-red-700" : isWarning ? "text-yellow-700" : "text-green-700"}`} />
                      ) : (
                        <Droplet className={`w-5 h-5 ${isCritical ? "text-red-700" : isWarning ? "text-yellow-700" : "text-green-700"}`} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold text-slate-900 text-base">
                          {point.number && `${point.number} - `}{point.name}
                        </h3>
                        {isWarning && (
                          <Badge variant="outline" className="gap-1 bg-yellow-100 text-yellow-800 border-yellow-300">
                            <Clock className="w-3 h-3 mr-1" />
                            Po termínu
                          </Badge>
                        )}
                        {isCritical && (
                          <Badge variant="outline" className="gap-1 bg-red-100 text-red-800 border-red-300">
                            <Clock className="w-3 h-3 mr-1" />
                            KRITICKÉ
                          </Badge>
                        )}
                        {pointIssues.length > 0 && (
                          <Badge className="bg-orange-500 text-white">
                            <AlertTriangle className="w-3 h-3 mr-1" />
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
                          <span className={isCritical ? "text-red-700 font-medium" : isWarning ? "text-yellow-700 font-medium" : "text-slate-600"}>
                            Následující: {format(nextDate, "d.M. yyyy", { locale: cs })}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${
                      isCritical ? "bg-red-500" :
                      isWarning ? "bg-yellow-500" : "bg-green-500"
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* NOVÝ HEADER - menší verze jako u LineDetail */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg">
        <div className="max-w-7xl mx-auto p-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(createPageUrl(`LineDetail?id=${line?.id}${company?.id ? `&company=${company.id}` : ''}`))}
            className="text-white hover:bg-white/20 mb-3"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Zpět na {line?.name || "linku"}
          </Button>

          <div className="flex items-center gap-2 text-sm mb-3 opacity-90">
            <Building2 className="w-4 h-4" />
            <span>{company?.name || "Podnik"}</span>
            <ChevronRight className="w-4 h-4" />
            <span>{line?.name || "Linka"}</span>
            <ChevronRight className="w-4 h-4" />
            <span className="font-semibold">{machine.name}</span>
          </div>

          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold mb-1">{machine.name}</h1>
              {machine.description && (
                <p className="text-blue-100 text-sm">{machine.description}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
        {/* Statistiky */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-slate-600 mb-1">Kontrolní body</p>
                  <p className="text-3xl font-bold text-slate-900">{controlPoints.length}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    {lubricationPoints.length} mazání • {inspectionPoints.length} inspekcí
                  </p>
                </div>
                <div className="p-3 bg-blue-100 rounded-lg">
                  <Droplet className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-slate-600 mb-1">Po termínu</p>
                  <p className="text-3xl font-bold text-red-600">{overduePoints.length}</p>
                  <p className="text-xs text-slate-500 mt-1">Vyžaduje pozornost</p>
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
                  <p className="text-3xl font-bold text-orange-600">{issues.length}</p>
                  <p className="text-xs text-slate-500 mt-1">Nahlášené problémy</p>
                </div>
                <div className="p-3 bg-orange-100 rounded-lg">
                  <AlertTriangle className="w-6 h-6 text-orange-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-slate-600 mb-1">V pořádku</p>
                  <p className="text-3xl font-bold text-green-600">{okPoints.length}</p>
                  <p className="text-xs text-slate-500 mt-1">Kontrolní body OK</p>
                </div>
                <div className="p-3 bg-green-100 rounded-lg">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Záložky */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="flex flex-wrap w-full bg-white shadow-md p-2 h-auto gap-2">
            <TabsTrigger value="overview" className="flex-1 min-w-[100px] gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-blue-700 data-[state=active]:text-white">
              <LayoutDashboard className="w-4 h-4" />
              <span className="hidden md:inline">Přehled</span>
            </TabsTrigger>
            
            {showDemip && (
              <TabsTrigger value="control-points" className="flex-1 min-w-[100px] gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-purple-700 data-[state=active]:text-white">
                <Droplet className="w-4 h-4" />
                <span className="hidden md:inline">DEMIP</span>
              </TabsTrigger>
            )}
            
            <TabsTrigger value="documentation" className="flex-1 min-w-[100px] gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-600 data-[state=active]:to-indigo-700 data-[state=active]:text-white">
              <ImageIcon className="w-4 h-4" />
              <span className="hidden md:inline">Dokumentace</span>
            </TabsTrigger>
            
            {showMaintenance && (
              <TabsTrigger value="maintenance" className="flex-1 min-w-[100px] gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-green-600 data-[state=active]:to-green-700 data-[state=active]:text-white">
                <Wrench className="w-4 h-4" />
                <span className="hidden md:inline">Údržba</span>
              </TabsTrigger>
            )}
            
            {showParts && (
              <TabsTrigger value="spare-parts" className="flex-1 min-w-[100px] gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-600 data-[state=active]:to-orange-700 data-[state=active]:text-white">
                <Package className="w-4 h-4" />
                <span className="hidden md:inline">Díly</span>
              </TabsTrigger>
            )}
            
            {showVibration && (
              <TabsTrigger value="vibration" className="flex-1 min-w-[100px] gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-red-600 data-[state=active]:to-red-700 data-[state=active]:text-white">
                <FileSpreadsheet className="w-4 h-4" />
                <span className="hidden md:inline">Vibrace</span>
              </TabsTrigger>
            )}

            {showThermo && (
              <TabsTrigger value="thermo" className="flex-1 min-w-[100px] gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-600 data-[state=active]:to-amber-700 data-[state=active]:text-white">
                <Activity className="w-4 h-4" />
                <span className="hidden md:inline">Termo</span>
              </TabsTrigger>
            )}

            {showTribo && (
              <TabsTrigger value="tribo" className="flex-1 min-w-[100px] gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-purple-700 data-[state=active]:text-white">
                <Droplet className="w-4 h-4" />
                <span className="hidden md:inline">Tribo</span>
              </TabsTrigger>
            )}
            
            <TabsTrigger value="responsibility" className="flex-1 min-w-[100px] gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-teal-600 data-[state=active]:to-teal-700 data-[state=active]:text-white">
              <Users className="w-4 h-4" />
              <span className="hidden md:inline">Odpovědnost</span>
            </TabsTrigger>
            
            <TabsTrigger value="statistics" className="flex-1 min-w-[100px] gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-pink-600 data-[state=active]:to-pink-700 data-[state=active]:text-white">
              <BarChart2 className="w-4 h-4" />
              <span className="hidden md:inline">Statistiky</span>
            </TabsTrigger>
          </TabsList>

          {/* Přehled */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Nejbližší plánované úkony */}
              <Card className="shadow-lg">
                <CardHeader className="border-b border-slate-100">
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-slate-600" />
                    Nejbližší plánované úkony
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  {upcomingTasks.length === 0 ? (
                    <p className="text-center text-slate-500 py-8">
                      Žádné plánované úkony
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {upcomingTasks.map((task) => {
                        if (task.type === "control_point") {
                          const point = task.point;
                          const status = getPointStatus(point);
                          const isOverdue = status === "overdue";
                          
                          return (
                            <div
                              key={`cp-${task.id}`}
                              className={`p-4 rounded-lg border-l-4 ${
                                isOverdue
                                  ? "border-l-red-500 bg-red-50"
                                  : "border-l-blue-500 bg-blue-50"
                              }`}
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-2">
                                    {point.type === "lubrication" || point.type === "auto_lubricator" ? (
                                      <Droplet className="w-4 h-4 text-blue-600" />
                                    ) : (
                                      <ClipboardCheck className="w-4 h-4 text-purple-600" />
                                    )}
                                    <h4 className="font-semibold text-slate-900">
                                      {point.number && `${point.number} - `}{point.name}
                                    </h4>
                                    {isOverdue && (
                                      <Badge variant="destructive" className="text-xs">
                                        Po termínu
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="text-sm text-slate-600 mb-1">
                                    {point.type === "lubrication" 
                                      ? `Mazání: ${point.lubricant_type || "neuvedeno"}`
                                      : point.type === "auto_lubricator" ? "Automatická maznice"
                                      : "Inspekce"
                                    }
                                  </p>
                                  <p className="text-xs text-slate-500">
                                    Další kontrola:{" "}
                                    {format(task.date, "d. M. yyyy HH:mm", { locale: cs })}
                                  </p>
                                </div>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => navigate(createPageUrl(`ControlPoint?id=${point.id}`))}
                                >
                                  Detail
                                </Button>
                              </div>
                            </div>
                          );
                        } else {
                          // Plánovaná údržba
                          const maintenance = task.maintenance;
                          const isOverdue = task.date < new Date();
                          const isPriority = maintenance.priority === "high";
                          
                          const maintenanceTypeLabels = {
                            preventive: { label: "Preventivní", icon: CheckCircle, color: "text-green-600" },
                            corrective: { label: "Korektivní", icon: Wrench, color: "text-orange-600" },
                            predictive: { label: "Prediktivní", icon: TrendingUp, color: "text-blue-600" },
                            inspection: { label: "Inspekce", icon: ClipboardCheck, color: "text-purple-600" },
                          };
                          
                          const typeInfo = maintenanceTypeLabels[maintenance.maintenance_type] || maintenanceTypeLabels.preventive;
                          const TypeIcon = typeInfo.icon;
                          
                          return (
                            <div
                              key={`pm-${task.id}`}
                              className={`p-4 rounded-lg border-l-4 ${
                                isOverdue
                                  ? "border-l-red-500 bg-red-50"
                                  : isPriority
                                  ? "border-l-orange-500 bg-orange-50"
                                  : "border-l-green-500 bg-green-50"
                              }`}
                            >
                              <div className="flex items-start justify-between">
                                <div>
                                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                                    <TypeIcon className={`w-4 h-4 ${typeInfo.color}`} />
                                    <h4 className="font-semibold text-slate-900">
                                      {maintenance.title}
                                    </h4>
                                    {isOverdue && (
                                      <Badge variant="destructive" className="text-xs">
                                        Po termínu
                                      </Badge>
                                    )}
                                    {maintenance.status === "assigned" && (
                                      <Badge className="bg-blue-100 text-blue-700 text-xs">
                                        Přiřazeno
                                      </Badge>
                                    )}
                                    {isPriority && !isOverdue && (
                                      <Badge className="bg-orange-100 text-orange-700 text-xs">
                                        Vysoká priorita
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="text-sm text-slate-600 mb-1">
                                    {typeInfo.label} údržba
                                    {maintenance.assigned_to && (
                                      <> • Přiřazeno: {getUserDisplayName(maintenance.assigned_to)}</>
                                    )}
                                  </p>
                                  <p className="text-xs text-slate-500">
                                    Plánováno na:{" "}
                                    {format(task.date, "d. M. yyyy", { locale: cs })}
                                  </p>
                                </div>
                              </div>
                            </div>
                          );
                        }
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Aktivní závady */}
              <Card className="border-l-4 border-l-orange-500 shadow-lg">
                <CardHeader className="border-b border-slate-100">
                  <CardTitle className="flex items-center gap-2 text-orange-700">
                    <AlertTriangle className="w-5 h-5" />
                    Aktivní závady ({issues.length})
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
                        const point = controlPoints.find(
                          (p) => p.id === issue.control_point_id
                        );
                        return (
                          <div
                            key={issue.id}
                            onClick={() => navigate(createPageUrl(`IssueApproval?issue=${issue.id}`))}
                            className="p-4 rounded-lg bg-orange-50 border border-orange-200 hover:bg-orange-100 hover:border-orange-300 transition-all cursor-pointer"
                          >
                            <div className="flex items-start justify-between mb-2">
                              <h4 className="font-semibold text-slate-900">
                                {point?.name || "Neznámý bod"}
                              </h4>
                              <ChevronRight className="w-5 h-5 text-orange-600 flex-shrink-0" />
                            </div>
                            <p className="text-sm text-slate-700 mb-2 line-clamp-2">
                              {issue.description}
                            </p>
                            <div className="flex items-center gap-2 text-xs text-slate-500">
                              <span>
                                {format(new Date(issue.created_date), "d. M. yyyy", {
                                  locale: cs,
                                })}
                              </span>
                              <span>•</span>
                              <span>{getUserDisplayName(issue.created_by)}</span>
                            </div>
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
                              {format(new Date(record.performed_at), "d.M. yyyy HH:mm", { locale: cs })} • {getUserDisplayName(record.created_by)}
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
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-indigo-600" />
                    Dokumentace stroje
                  </CardTitle>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedUploadFile(null);
                        setUploadFileName("");
                        setUploadingCategory("drawing"); // Default category
                        setShowUploadDialog(true);
                      }}
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      Nahrát soubor
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                {documentation.length === 0 ? (
                  <div className="text-center py-12">
                    <ImageIcon className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                    <p className="text-slate-500 mb-2">Zatím nebyla přidána žádná dokumentace</p>
                    <p className="text-sm text-slate-400">Použijte tlačítko "Nahrát soubor" pro přidání</p>
                  </div>
                ) : (
                  <Tabs defaultValue="drawing" className="space-y-6">
                    <TabsList className="grid w-full grid-cols-3 bg-white shadow-sm">
                      <TabsTrigger value="drawing" className="gap-2">
                        Výkresy ({documentation.filter(doc => doc.category === "drawing").length})
                      </TabsTrigger>
                      <TabsTrigger value="operational" className="gap-2">
                        Provozní ({documentation.filter(doc => doc.category === "operational").length})
                      </TabsTrigger>
                      <TabsTrigger value="other" className="gap-2">
                        Ostatní ({documentation.filter(doc => doc.category === "other").length})
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="drawing">
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {documentation.filter(doc => doc.category === "drawing").map((doc) => (
                          <div
                            key={doc.id}
                            className="group relative aspect-video rounded-lg overflow-hidden border-2 border-slate-200 hover:border-indigo-400 transition-all cursor-pointer bg-slate-50 flex items-center justify-center"
                            onClick={() => {
                                setSelectedDocPreview(doc);
                                setShowDocPreviewDialog(true);
                            }}
                          >
                            {doc.file_type === "photo" ? (
                              <img
                                src={doc.file_url}
                                alt={doc.file_name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                                <div className="flex flex-col items-center p-4 text-center">
                                    {getFileIcon(doc.file_type)}
                                    <p className="text-xs text-slate-600 mt-2 truncate max-w-full">{doc.file_name}</p>
                                </div>
                            )}
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-all flex items-center justify-center">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="opacity-0 group-hover:opacity-100 transition-opacity bg-red-600 hover:bg-red-700 text-white"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeleteDocId(doc.id);
                                }}
                              >
                                <X className="w-5 h-5" />
                              </Button>
                            </div>
                            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                              <p className="text-xs text-white truncate">{doc.file_name}</p>
                              <p className="text-xs text-white/70">
                                {format(new Date(doc.created_date), "d. M. yyyy", { locale: cs })}
                              </p>
                            </div>
                          </div>
                        ))}
                        {documentation.filter(doc => doc.category === "drawing").length === 0 && (
                            <p className="col-span-full text-center text-slate-500 py-8">Žádné výkresy nebyly přidány.</p>
                        )}
                      </div>
                    </TabsContent>

                    <TabsContent value="operational">
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {documentation.filter(doc => doc.category === "operational").map((doc) => (
                          <div
                            key={doc.id}
                            className="group relative aspect-video rounded-lg overflow-hidden border-2 border-slate-200 hover:border-indigo-400 transition-all cursor-pointer bg-slate-50 flex items-center justify-center"
                            onClick={() => {
                                setSelectedDocPreview(doc);
                                setShowDocPreviewDialog(true);
                            }}
                          >
                            {doc.file_type === "photo" ? (
                              <img
                                src={doc.file_url}
                                alt={doc.file_name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                                <div className="flex flex-col items-center p-4 text-center">
                                    {getFileIcon(doc.file_type)}
                                    <p className="text-xs text-slate-600 mt-2 truncate max-w-full">{doc.file_name}</p>
                                </div>
                            )}
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-all flex items-center justify-center">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="opacity-0 group-hover:opacity-100 transition-opacity bg-red-600 hover:bg-red-700 text-white"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeleteDocId(doc.id);
                                }}
                              >
                                <X className="w-5 h-5" />
                              </Button>
                            </div>
                            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                              <p className="text-xs text-white truncate">{doc.file_name}</p>
                              <p className="text-xs text-white/70">
                                {format(new Date(doc.created_date), "d. M. yyyy", { locale: cs })}
                              </p>
                            </div>
                          </div>
                        ))}
                        {documentation.filter(doc => doc.category === "operational").length === 0 && (
                            <p className="col-span-full text-center text-slate-500 py-8">Žádná provozní dokumentace nebyla přidána.</p>
                        )}
                      </div>
                    </TabsContent>

                    <TabsContent value="other">
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {documentation.filter(doc => doc.category === "other").map((doc) => (
                          <div
                            key={doc.id}
                            className="group relative aspect-video rounded-lg overflow-hidden border-2 border-slate-200 hover:border-indigo-400 transition-all cursor-pointer bg-slate-50 flex items-center justify-center"
                            onClick={() => {
                                setSelectedDocPreview(doc);
                                setShowDocPreviewDialog(true);
                            }}
                          >
                            {doc.file_type === "photo" ? (
                              <img
                                src={doc.file_url}
                                alt={doc.file_name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                                <div className="flex flex-col items-center p-4 text-center">
                                    {getFileIcon(doc.file_type)}
                                    <p className="text-xs text-slate-600 mt-2 truncate max-w-full">{doc.file_name}</p>
                                </div>
                            )}
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-all flex items-center justify-center">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="opacity-0 group-hover:opacity-100 transition-opacity bg-red-600 hover:bg-red-700 text-white"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeleteDocId(doc.id);
                                }}
                              >
                                <X className="w-5 h-5" />
                              </Button>
                            </div>
                            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                              <p className="text-xs text-white truncate">{doc.file_name}</p>
                              <p className="text-xs text-white/70">
                                {format(new Date(doc.created_date), "d. M. yyyy", { locale: cs })}
                              </p>
                            </div>
                          </div>
                        ))}
                        {documentation.filter(doc => doc.category === "other").length === 0 && (
                            <p className="col-span-full text-center text-slate-500 py-8">Žádná další dokumentace nebyla přidána.</p>
                        )}
                      </div>
                    </TabsContent>
                  </Tabs>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Údržba a servis - ROZŠÍŘENÁ VERZE */}
          <TabsContent value="maintenance">
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
                        <Button
                          onClick={() => setShowAddPlannedMaintenanceDialog(true)}
                          className="gap-2 bg-gradient-to-r from-blue-600 to-blue-700"
                        >
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
                        {canManagePlannedMaintenance && (
                          <p className="text-sm text-slate-400">Klikněte na "Přidat plánovaný úkol" pro vytvoření nového</p>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {activePlannedTasks.map((task) => {
                          const isOverdue = new Date(task.planned_date) < new Date() && task.status === "planned";
                          const isAssigned = task.status === "assigned";
                          const canComplete = isAssigned && (currentUser?.email === task.assigned_to || canManagePlannedMaintenance);

                          return (
                            <Card key={task.id} className={`border-l-4 ${
                              isOverdue ? "border-l-red-500 bg-red-50/30" :
                              isAssigned ? "border-l-blue-500 bg-blue-50/30" :
                              "border-l-green-500 bg-green-50/30"
                            }`}>
                              <CardContent className="p-4">
                                <div className="flex items-start justify-between mb-3">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                                      <h3 className="font-bold text-slate-900 text-lg">{task.title}</h3>
                                      <Badge className={
                                        task.maintenance_type === "preventive" ? "bg-green-100 text-green-800" :
                                        task.maintenance_type === "corrective" ? "bg-orange-100 text-orange-800" :
                                        task.maintenance_type === "predictive" ? "bg-blue-100 text-blue-800" :
                                        "bg-purple-100 text-purple-800"
                                      }>
                                        {task.maintenance_type === "preventive" ? "Preventivní" :
                                         task.maintenance_type === "corrective" ? "Korektivní" :
                                         task.maintenance_type === "predictive" ? "Prediktivní" :
                                         "Inspekce"}
                                      </Badge>
                                      {task.priority === "high" && (
                                        <Badge variant="destructive">Vysoká priorita</Badge>
                                      )}
                                      {isOverdue && (
                                        <Badge className="bg-red-500 text-white">Po termínu</Badge>
                                      )}
                                      {isAssigned && (
                                        <Badge className="bg-blue-500 text-white">Pracovní příkaz vytvořen</Badge>
                                      )}
                                    </div>
                                    {task.description && (
                                      <p className="text-sm text-slate-600 mb-3">{task.description}</p>
                                    )}
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                                      <div className="bg-white rounded-lg p-2 border border-slate-200">
                                        <p className="text-xs text-slate-500">Plánované datum</p>
                                        <p className={`text-sm font-medium ${isOverdue ? "text-red-700" : "text-slate-900"}`}>
                                          {format(new Date(task.planned_date), "d. M. yyyy", { locale: cs })}
                                        </p>
                                      </div>
                                      {task.assigned_to && (
                                        <div className="bg-white rounded-lg p-2 border border-slate-200">
                                          <p className="text-xs text-slate-500">Přiřazeno</p>
                                          <p className="text-sm font-medium text-slate-900">
                                            {getUserDisplayName(task.assigned_to)}
                                          </p>
                                        </div>
                                      )}
                                      {task.estimated_duration_hours && (
                                        <div className="bg-white rounded-lg p-2 border border-slate-200">
                                          <p className="text-xs text-slate-500">Odhad. čas</p>
                                          <p className="text-sm font-medium text-slate-900">{task.estimated_duration_hours}h</p>
                                        </div>
                                      )}
                                      {task.estimated_cost && (
                                        <div className="bg-white rounded-lg p-2 border border-slate-200">
                                          <p className="text-xs text-slate-500">Odhad. náklady</p>
                                          <p className="text-sm font-medium text-slate-900">{task.estimated_cost.toLocaleString()} Kč</p>
                                        </div>
                                      )}
                                    </div>
                                    {task.notes && (
                                      <p className="text-xs text-slate-500 italic bg-slate-50 p-2 rounded">{task.notes}</p>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  {canManagePlannedMaintenance && !isAssigned && (
                                    <Button
                                      size="sm"
                                      onClick={() => handleCreateWorkOrder(task)}
                                      className="gap-2 bg-blue-600 hover:bg-blue-700"
                                      disabled={!task.assigned_to || createWorkOrderMutation.isLoading}
                                    >
                                      {createWorkOrderMutation.isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                      Vytvořit pracovní příkaz
                                    </Button>
                                  )}
                                  {canComplete && (
                                    <Button
                                      size="sm"
                                      onClick={() => {
                                        setSelectedPlannedTask(task);
                                        setCompletionForm({
                                          duration_hours: task.estimated_duration_hours || null,
                                          cost: task.estimated_cost || null,
                                          notes: "",
                                        });
                                        setShowCompleteMaintenanceDialog(true);
                                      }}
                                      className="gap-2 bg-green-600 hover:bg-green-700"
                                    >
                                      <CheckCircle className="w-4 h-4" />
                                      Potvrdit provedení
                                    </Button>
                                  )}
                                  {canManagePlannedMaintenance && task.status === "planned" && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => {
                                        if (window.confirm("Opravdu chcete zrušit tento plánovaný úkol?")) {
                                          cancelPlannedMaintenanceMutation.mutate(task.id);
                                        }
                                      }}
                                      className="gap-2 text-red-600 hover:text-red-700"
                                    >
                                      <X className="w-4 h-4" />
                                      Zrušit
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

              {/* Historie pracovních příkazů */}
              <TabsContent value="history">
                <Card className="border-none shadow-lg">
                  <CardHeader className="border-b border-slate-100">
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        <Wrench className="w-5 h-5 text-green-600" />
                        Historie pracovních příkazů (WO)
                      </CardTitle>
                      <Badge variant="outline" className="text-sm">
                        {maintenanceRecords.length} záznamů
                      </Badge>
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
                                  <div className="flex items-center gap-2 mb-2 flex-wrap">
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
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-2">
                                    <div className="bg-slate-50 rounded-lg p-2">
                                      <p className="text-xs text-slate-500">Datum provedení</p>
                                      <p className="text-sm font-medium text-slate-900">
                                        {format(new Date(record.performed_at), "d.M. yyyy HH:mm", { locale: cs })}
                                      </p>
                                    </div>
                                    {record.duration_hours && (
                                      <div className="bg-slate-50 rounded-lg p-2">
                                        <p className="text-xs text-slate-500">Doba trvání</p>
                                        <p className="text-sm font-medium text-slate-900">{record.duration_hours}h</p>
                                      </div>
                                    )}
                                    {record.technician && (
                                      <div className="bg-slate-50 rounded-lg p-2">
                                        <p className="text-xs text-slate-500">Technik</p>
                                        <p className="text-sm font-medium text-slate-900">{getUserDisplayName(record.technician)}</p>
                                      </div>
                                    )}
                                    {record.cost && (
                                      <div className="bg-green-50 rounded-lg p-2">
                                        <p className="text-xs text-green-700">Náklady</p>
                                        <p className="text-sm font-bold text-green-900">
                                          {record.cost.toLocaleString()} Kč
                                        </p>
                                      </div>
                                    )}
                                  </div>
                                  {record.notes && (
                                    <p className="text-xs text-slate-500 mt-2 italic bg-slate-50 p-2 rounded">{record.notes}</p>
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

              {/* Aktivní závady / Otevřené WO */}
              <TabsContent value="active-issues">
                <Card className="border-none shadow-lg">
                  <CardHeader className="border-b border-slate-100">
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-orange-600" />
                        Aktuální otevřené závady / WO
                      </CardTitle>
                      {issues.length > 0 && (
                        <Badge variant="destructive">
                          {issues.length} aktivních
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="p-6">
                    {issues.length === 0 ? (
                      <div className="text-center py-12">
                        <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-slate-900 mb-2">
                          Žádné aktivní závady
                        </h3>
                        <p className="text-slate-500">
                          Stroj je v dobrém stavu, žádné nahlášené problémy
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {issues.map((issue) => {
                          const point = controlPoints.find(p => p.id === issue.control_point_id);
                          return (
                            <Card key={issue.id} className="border-l-4 border-l-orange-500 bg-orange-50/30">
                              <CardContent className="p-4">
                                <div className="flex items-start justify-between mb-2">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                      <AlertTriangle className="w-4 h-4 text-orange-600" />
                                      <h3 className="font-bold text-slate-900">
                                        {point?.name || "Neznámý bod"}
                                      </h3>
                                      <Badge className="bg-orange-500 text-white">
                                        Aktivní
                                      </Badge>
                                    </div>
                                    <p className="text-sm text-slate-700 bg-white p-3 rounded-lg border border-orange-200 mb-2">
                                      {issue.description}
                                    </p>
                                    <div className="flex items-center gap-3 text-xs text-slate-500">
                                      <span>
                                        Nahlášeno: {format(new Date(issue.created_date), "d. M. yyyy HH:mm", { locale: cs })}
                                      </span>
                                      <span>•</span>
                                      <span>{getUserDisplayName(issue.created_by)}</span>
                                    </div>
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

              {/* Záznamy o kontrolách / inspekcích */}
              <TabsContent value="inspections">
                <Card className="border-none shadow-lg">
                  <CardHeader className="border-b border-slate-100">
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        <ClipboardCheck className="w-5 h-5 text-purple-600" />
                        Záznamy o kontrolách a inspekcích
                      </CardTitle>
                      <Badge variant="outline">
                        {inspectionRecords.length} záznamů
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="p-6">
                    {inspectionRecords.length === 0 ? (
                      <div className="text-center py-12">
                        <ClipboardCheck className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                        <p className="text-slate-500 mb-2">Zatím nebyly provedeny žádné inspekce</p>
                        <p className="text-sm text-slate-400">Inspekce se provádějí na kontrolních bodech typu "Inspekce"</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {inspectionRecords.map((record) => {
                          const point = controlPoints.find(p => p.id === record.control_point_id);
                          return (
                            <div key={record.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors border border-slate-200">
                              <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0">
                                <ClipboardCheck className="w-5 h-5 text-purple-600" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-slate-900 truncate">
                                  {point?.name || "Neznámý bod"}
                                </p>
                                <p className="text-xs text-slate-500">
                                  {format(new Date(record.performed_at), "d.M. yyyy HH:mm", { locale: cs })} • {getUserDisplayName(record.created_by)}
                                </p>
                                {record.note && (
                                  <p className="text-xs text-slate-600 mt-1 italic">{record.note}</p>
                                )}
                              </div>
                              <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                                Provedeno
                              </Badge>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Náklady na údržbu */}
              <TabsContent value="costs" className="space-y-6">
                {/* Celkové náklady a statistiky */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <Card className="border-none shadow-lg bg-gradient-to-br from-green-500 to-green-600 text-white">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-green-100 text-sm font-medium mb-1">Celkové náklady</p>
                          <p className="text-3xl font-bold">{totalMaintenanceCost.toLocaleString()} Kč</p>
                          <p className="text-green-100 text-xs mt-2">
                            Z {maintenanceRecords.length} zásahů
                          </p>
                        </div>
                        <TrendingUp className="w-8 h-8 text-white/80" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-none shadow-lg bg-gradient-to-br from-emerald-500 to-emerald-600 text-white">
                    <CardContent className="p-6">
                      <div>
                        <p className="text-emerald-100 text-sm font-medium mb-1">Preventivní</p>
                        <p className="text-2xl font-bold">{costByType.preventive.toLocaleString()} Kč</p>
                        <p className="text-emerald-100 text-xs mt-2">
                          {maintenanceRecords.filter(r => r.maintenance_type === "preventive").length} zásahů
                        </p>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-none shadow-lg bg-gradient-to-br from-amber-500 to-amber-600 text-white">
                    <CardContent className="p-6">
                      <div>
                        <p className="text-amber-100 text-sm font-medium mb-1">Korektivní</p>
                        <p className="text-2xl font-bold">{costByType.corrective.toLocaleString()} Kč</p>
                        <p className="text-amber-100 text-xs mt-2">
                          {maintenanceRecords.filter(r => r.maintenance_type === "corrective").length} zásahů
                        </p>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-none shadow-lg bg-gradient-to-br from-blue-500 to-blue-600 text-white">
                    <CardContent className="p-6">
                      <div>
                        <p className="text-blue-100 text-sm font-medium mb-1">Průměrné náklady</p>
                        <p className="text-2xl font-bold">
                          {maintenanceRecords.length > 0 
                            ? Math.round(totalMaintenanceCost / maintenanceRecords.length).toLocaleString() 
                            : 0} Kč
                        </p>
                        <p className="text-blue-100 text-xs mt-2">
                          Na jeden zásah
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Grafy */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Graf nákladů podle typu */}
                  <Card className="border-none shadow-lg">
                    <CardHeader className="border-b border-slate-100">
                      <CardTitle className="flex items-center gap-2">
                        <BarChart2 className="w-5 h-5 text-green-600" />
                        Náklady podle typu údržby
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6">
                      {costByTypeData.length === 0 ? (
                        <p className="text-center text-slate-500 py-8">Zatím nejsou data o nákladech</p>
                      ) : (
                        <ResponsiveContainer width="100%" height={250}>
                          <PieChart>
                            <Pie
                              data={costByTypeData}
                              cx="50%"
                              cy="50%"
                              labelLine={false}
                              label={({ name, value }) => `${name}: ${value.toLocaleString()} Kč`}
                              outerRadius={80}
                              fill="#8884d8"
                              dataKey="value"
                            >
                              {costByTypeData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip formatter={(value) => `${value.toLocaleString()} Kč`} />
                          </PieChart>
                        </ResponsiveContainer>
                      )}
                    </CardContent>
                  </Card>

                  {/* Graf nákladů v čase */}
                  <Card className="border-none shadow-lg">
                    <CardHeader className="border-b border-slate-100">
                      <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-blue-600" />
                        Vývoj nákladů v čase
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6">
                      {costByMonthData.length === 0 || costByMonthData.every(d => d.cost === 0) ? (
                        <p className="text-center text-slate-500 py-8">Zatím nejsou data o nákladech</p>
                      ) : (
                        <ResponsiveContainer width="100%" height={250}>
                          <BarChart data={costByMonthData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                            <XAxis dataKey="month" stroke="#64748b" />
                            <YAxis stroke="#64748b" />
                            <Tooltip formatter={(value) => `${value.toLocaleString()} Kč`} />
                            <Bar dataKey="cost" fill="#10b981" name="Náklady (Kč)" />
                          </BarChart>
                        </ResponsiveContainer>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Detailní přehled nákladů */}
                <Card className="border-none shadow-lg">
                  <CardHeader className="border-b border-slate-100">
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="w-5 h-5 text-slate-600" />
                      Detailní přehled nákladů
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6">
                    {maintenanceRecords.filter(r => r.cost).length === 0 ? (
                      <p className="text-center text-slate-500 py-8">Zatím nejsou záznamy s vyplněnými náklady</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                              <th className="text-left p-3 text-sm font-semibold text-slate-700">Datum</th>
                              <th className="text-left p-3 text-sm font-semibold text-slate-700">Název</th>
                              <th className="text-left p-3 text-sm font-semibold text-slate-700">Typ</th>
                              <th className="text-right p-3 text-sm font-semibold text-slate-700">Náklady</th>
                            </tr>
                          </thead>
                          <tbody>
                            {maintenanceRecords
                              .filter(r => r.cost)
                              .map((record) => (
                                <tr key={record.id} className="border-b border-slate-100 hover:bg-slate-50">
                                  <td className="p-3 text-sm text-slate-600">
                                    {format(new Date(record.performed_at), "d.M. yyyy", { locale: cs })}
                                  </td>
                                  <td className="p-3 text-sm text-slate-900 font-medium">
                                    {record.title}
                                  </td>
                                  <td className="p-3">
                                    <Badge variant="outline" className="text-xs">
                                      {record.maintenance_type === "preventive" ? "Preventivní" :
                                       record.maintenance_type === "corrective" ? "Korektivní" :
                                       record.maintenance_type === "predictive" ? "Prediktivní" :
                                       "Inspekce"}
                                    </Badge>
                                  </td>
                                  <td className="p-3 text-sm text-right font-bold text-green-700">
                                    {record.cost.toLocaleString()} Kč
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
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
             <div className="flex justify-end mb-4">
                 <Button 
                     onClick={() => { setEditingVibrationJob(null); setShowVibrationDialog(true); }} 
                     className="bg-blue-600 hover:bg-blue-700"
                 >
                     <Plus className="w-4 h-4 mr-2" /> Nové měření
                 </Button>
             </div>
             
             <VibrationCard machine={machine} jobs={vibrationJobs} />
             
             {/* Edit buttons for jobs - keep them accessible or maybe integrate into card? 
                 For now, let's add a small list below for editing if needed, or rely on Admin access.
                 Actually, let's keep the edit functionality available.
             */}
             {vibrationJobs.length > 0 && (
                <div className="mt-8 pt-8 border-t">
                    <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4">Správa měření</h3>
                    <div className="grid gap-2">
                         {vibrationJobs.map(job => (
                            <div key={job.id} className="flex items-center justify-between p-3 bg-white border rounded-lg text-sm">
                                <span>{format(new Date(job.date), "d. M. yyyy", { locale: cs })} - Zakázka {job.order_number}</span>
                                <Button variant="ghost" size="sm" onClick={() => { setEditingVibrationJob(job); setShowVibrationDialog(true); }}>
                                    <Pencil className="w-3 h-3 mr-2" /> Upravit
                                </Button>
                            </div>
                         ))}
                    </div>
                </div>
             )}
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
                              {getUserDisplayName(resp.user_email)?.[0] || "?"}
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-bold text-slate-900 mb-1">{getUserDisplayName(resp.user_email)}</h3>
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

          {/* Termodiagnostika */}
          <TabsContent value="thermo" className="space-y-6">
             <div className="flex justify-end mb-4">
                 <Button 
                     onClick={() => { setEditingThermoJob(null); setShowThermoDialog(true); }} 
                     className="bg-orange-600 hover:bg-orange-700"
                 >
                     <Plus className="w-4 h-4 mr-2" /> Nové měření
                 </Button>
             </div>
             
             <ThermoCard 
                machine={machine} 
                jobs={thermoJobs} 
                onEdit={(job) => { setEditingThermoJob(job); setShowThermoDialog(true); }}
             />
          </TabsContent>

          {/* Tribodiagnostika Placeholder */}
          <TabsContent value="tribo" className="space-y-6">
            <Card>
                <CardContent className="p-12 text-center">
                    <Droplet className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                    <p className="text-slate-500">Modul Tribodiagnostika je aktivní, ale zatím nejsou data.</p>
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

        {/* Dialog pro přidání plánované údržby */}
        <Dialog open={showAddPlannedMaintenanceDialog} onOpenChange={setShowAddPlannedMaintenanceDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Přidat plánovaný úkol údržby</DialogTitle>
              <DialogDescription>
                Vytvořte nový plánovaný úkol údržby pro stroj {machine.name}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
              <div>
                <Label htmlFor="title">Název úkolu *</Label>
                <Input
                  id="title"
                  value={plannedMaintenanceForm.title}
                  onChange={(e) => setPlannedMaintenanceForm({ ...plannedMaintenanceForm, title: e.target.value })}
                  placeholder="Např. Výměna oleje, Kontrola ložisek..."
                />
              </div>

              <div>
                <Label htmlFor="description">Popis</Label>
                <Textarea
                  id="description"
                  value={plannedMaintenanceForm.description}
                  onChange={(e) => setPlannedMaintenanceForm({ ...plannedMaintenanceForm, description: e.target.value })}
                  placeholder="Detailní popis práce..."
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="maintenance_type">Typ údržby *</Label>
                  <Select
                    value={plannedMaintenanceForm.maintenance_type}
                    onValueChange={(value) => setPlannedMaintenanceForm({ ...plannedMaintenanceForm, maintenance_type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="preventive">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-green-600" />
                          <span>Preventivní údržba</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="corrective">
                        <div className="flex items-center gap-2">
                          <Wrench className="w-4 h-4 text-orange-600" />
                          <span>Korektivní údržba</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="predictive">
                        <div className="flex items-center gap-2">
                          <TrendingUp className="w-4 h-4 text-blue-600" />
                          <span>Prediktivní údržba</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="inspection">
                        <div className="flex items-center gap-2">
                          <ClipboardCheck className="w-4 h-4 text-purple-600" />
                          <span>Inspekce</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="priority">Priorita</Label>
                  <Select
                    value={plannedMaintenanceForm.priority}
                    onValueChange={(value) => setPlannedMaintenanceForm({ ...plannedMaintenanceForm, priority: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Nízká</SelectItem>
                      <SelectItem value="medium">Střední</SelectItem>
                      <SelectItem value="high">Vysoká</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="planned_date">Plánované datum *</Label>
                  <Input
                    id="planned_date"
                    type="date"
                    value={plannedMaintenanceForm.planned_date}
                    onChange={(e) => setPlannedMaintenanceForm({ ...plannedMaintenanceForm, planned_date: e.target.value })}
                  />
                </div>

                <div>
                  <Label htmlFor="assigned_to">Přiřadit technikovi</Label>
                  <Select
                    value={plannedMaintenanceForm.assigned_to}
                    onValueChange={(value) => setPlannedMaintenanceForm({ ...plannedMaintenanceForm, assigned_to: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Vyberte technika" />
                    </SelectTrigger>
                    <SelectContent>
                      {allUsers
                        .filter(u => u.user_type === "technician" || u.user_type === "manager")
                        .map((user) => (
                          <SelectItem key={user.id} value={user.email}>
                            {getUserDisplayName(user.email)}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="estimated_duration">Odhadovaná doba (hodiny)</Label>
                  <Input
                    id="estimated_duration"
                    type="number"
                    step="0.5"
                    value={plannedMaintenanceForm.estimated_duration_hours || ""}
                    onChange={(e) => setPlannedMaintenanceForm({ ...plannedMaintenanceForm, estimated_duration_hours: e.target.value ? parseFloat(e.target.value) : null })}
                    placeholder="Např. 2"
                  />
                </div>

                <div>
                  <Label htmlFor="estimated_cost">Odhadované náklady (Kč)</Label>
                  <Input
                    id="estimated_cost"
                    type="number"
                    value={plannedMaintenanceForm.estimated_cost || ""}
                    onChange={(e) => setPlannedMaintenanceForm({ ...plannedMaintenanceForm, estimated_cost: e.target.value ? parseFloat(e.target.value) : null })}
                    placeholder="Např. 5000"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="interval_days">Interval opakování (dny)</Label>
                <Input
                  id="interval_days"
                  type="number"
                  value={plannedMaintenanceForm.interval_days || ""}
                  onChange={(e) => setPlannedMaintenanceForm({ ...plannedMaintenanceForm, interval_days: e.target.value ? parseInt(e.target.value) : null })}
                  placeholder="Např. 30 (pro měsíční opakování)"
                />
                <p className="text-xs text-slate-500 mt-1">Pokud nevyplníte, úkol se nebude opakovat</p>
              </div>

              <div>
                <Label htmlFor="notes">Poznámky</Label>
                <Textarea
                  id="notes"
                  value={plannedMaintenanceForm.notes}
                  onChange={(e) => setPlannedMaintenanceForm({ ...plannedMaintenanceForm, notes: e.target.value })}
                  placeholder="Další poznámky..."
                  rows={2}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddPlannedMaintenanceDialog(false)}>
                Zrušit
              </Button>
              <Button
                onClick={handleAddPlannedMaintenance}
                disabled={!plannedMaintenanceForm.title || !plannedMaintenanceForm.planned_date || createPlannedMaintenanceMutation.isLoading}
                className="bg-gradient-to-r from-blue-600 to-blue-700"
              >
                {createPlannedMaintenanceMutation.isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Přidávám...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-2" />
                    Přidat úkol
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog pro potvrzení provedení údržby */}
        <Dialog open={showCompleteMaintenanceDialog} onOpenChange={setShowCompleteMaintenanceDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Potvrdit provedení údržby</DialogTitle>
              <DialogDescription>
                Vyplňte skutečné údaje o provedené údržbě: {selectedPlannedTask?.title}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="duration">Skutečná doba trvání (hodiny) *</Label>
                <Input
                  id="duration"
                  type="number"
                  step="0.5"
                  value={completionForm.duration_hours || ""}
                  onChange={(e) => setCompletionForm({ ...completionForm, duration_hours: e.target.value ? parseFloat(e.target.value) : null })}
                  placeholder="Např. 2.5"
                />
              </div>

              <div>
                <Label htmlFor="cost">Skutečné náklady (Kč)</Label>
                <Input
                  id="cost"
                  type="number"
                  value={completionForm.cost || ""}
                  onChange={(e) => setCompletionForm({ ...completionForm, cost: e.target.value ? parseFloat(e.target.value) : null })}
                  placeholder="Např. 5000"
                />
              </div>

              <div>
                <Label htmlFor="completion_notes">Poznámky k provedení *</Label>
                <Textarea
                  id="completion_notes"
                  value={completionForm.notes}
                  onChange={(e) => setCompletionForm({ ...completionForm, notes: e.target.value })}
                  placeholder="Co bylo provedeno, jaké díly byly vyměněny, případné problémy..."
                  rows={4}
                />
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-900">
                  Po potvrzení se vytvoří záznam v historii údržby a úkol bude označen jako dokončený.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCompleteMaintenanceDialog(false)}>
                Zrušit
              </Button>
              <Button
                onClick={handleCompleteMaintenance}
                disabled={!completionForm.duration_hours || !completionForm.notes || completeMaintenanceMutation.isLoading}
                className="bg-gradient-to-r from-green-600 to-green-700"
              >
                {completeMaintenanceMutation.isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Dokončuji...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Potvrdit provedení
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog pro zobrazení/náhled dokumentu */}
        <Dialog open={showDocPreviewDialog} onOpenChange={setShowDocPreviewDialog}>
            <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>{selectedDocPreview?.file_name}</DialogTitle>
                    <DialogDescription>
                        {selectedDocPreview && format(new Date(selectedDocPreview.created_date), "d. M. yyyy HH:mm", { locale: cs })}
                        {selectedDocPreview?.created_by && ` • ${getUserDisplayName(selectedDocPreview.created_by)}`}
                    </DialogDescription>
                </DialogHeader>
                <div className="flex-1 flex items-center justify-center overflow-auto p-4 bg-slate-50 rounded-md">
                    {selectedDocPreview?.file_type === "photo" ? (
                        <img
                            src={selectedDocPreview.file_url}
                            alt={selectedDocPreview.file_name}
                            className="max-w-full max-h-full object-contain"
                        />
                    ) : selectedDocPreview?.file_type === "document" && selectedDocPreview.file_url.endsWith(".pdf") ? (
                        <iframe
                            src={selectedDocPreview.file_url}
                            title={selectedDocPreview.file_name}
                            className="w-full h-full border-none"
                        />
                    ) : (
                        <div className="text-center">
                            {getFileIcon(selectedDocPreview?.file_type)}
                            <p className="text-slate-600 mt-4">Náhled pro tento typ souboru není dostupný.</p>
                            <p className="text-sm text-slate-500">Můžete jej otevřít v nové záložce.</p>
                        </div>
                    )}
                </div>
                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => window.open(selectedDocPreview?.file_url, "_blank")}
                    >
                        Otevřít v nové záložce
                    </Button>
                    <Button
                        variant="destructive"
                        onClick={() => {
                            setShowDocPreviewDialog(false);
                            setDeleteDocId(selectedDocPreview?.id);
                        }}
                    >
                        <X className="w-4 h-4 mr-2" />
                        Smazat
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

        {/* Alert dialog pro smazání dokumentu */}
        <AlertDialog
          open={!!deleteDocId}
          onOpenChange={() => setDeleteDocId(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Opravdu smazat dokument?</AlertDialogTitle>
              <AlertDialogDescription>
                Tato akce je nevratná. Dokument bude trvale odstraněn.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Zrušit</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteDoc}
                className="bg-red-600 hover:bg-red-700"
              >
                Smazat
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Dialog pro měření vibrací */}
        <VibrationJobDialog 
          open={showVibrationDialog} 
          onOpenChange={setShowVibrationDialog} 
          machine={machine} 
          job={editingVibrationJob} 
        />

        <ThermoJobDialog 
          open={showThermoDialog} 
          onOpenChange={setShowThermoDialog} 
          machine={machine} 
          job={editingThermoJob} 
        />
      </div>
    </div>
  );
}