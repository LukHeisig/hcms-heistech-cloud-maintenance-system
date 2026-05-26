import React, { useState, useRef, useEffect, useMemo } from "react";
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
  Upload,
  ChevronRight,
  Wrench,
  Activity,
  TrendingUp,
  FileText,
  Loader2,
  Package,
  Users,
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
  Send,
  FileSpreadsheet, Brain, Sparkles, Cpu
} from "lucide-react";
import VibrationJobDialog from "@/components/machine/VibrationJobDialog";
import VibrationCard from "@/components/machine/VibrationCard";
import VibrationCardMQTT from "@/components/machine/VibrationCardMQTT";
import ThermoJobDialog from "@/components/machine/ThermoJobDialog";
import ThermoCard from "@/components/machine/ThermoCard";
import MaintenanceTab from "@/components/machine/MaintenanceTab";
import { format } from "date-fns";
import { cs } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar } from "recharts";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
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
  const [showVibrationDialog, setShowVibrationDialog] = useState(false);
  const [editingVibrationJob, setEditingVibrationJob] = useState(null);
  const [showThermoDialog, setShowThermoDialog] = useState(false);
  const [editingThermoJob, setEditingThermoJob] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setCurrentUser).catch(() => setCurrentUser(null));
  }, []);

  const { data: machine } = useQuery({
    queryKey: ["machine", machineId],
    queryFn: async () => {
      const machines = await base44.entities.Machine.filter({ id: machineId });
      return machines[0];
    },
    enabled: !!machineId,
    staleTime: 0,
  });

  const { data: line } = useQuery({
    queryKey: ["line", machine?.line_id],
    queryFn: async () => {
      if (!machine?.line_id) return null;
      const lines = await base44.entities.Line.filter({ id: machine.line_id });
      return lines[0];
    },
    enabled: !!machine?.line_id,
    staleTime: 60000,
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
    queryFn: async () => {
      const { data } = await base44.functions.invoke("getUsers");
      return data;
    },
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
    queryKey: ["records", machineId],
    queryFn: async () => {
        if (controlPoints.length === 0) return [];
        // Sequential batches of 3 to avoid rate limiting
        const cpIds = controlPoints.map(p => p.id);
        const allRecords = [];
        for (let i = 0; i < cpIds.length; i += 3) {
          const batch = cpIds.slice(i, i + 3);
          const results = await Promise.all(
            batch.map(cpId => base44.entities.ControlRecord.filter({ control_point_id: cpId }, "-performed_at", 30))
          );
          allRecords.push(...results.flat());
        }
        return allRecords.sort((a, b) => new Date(b.performed_at) - new Date(a.performed_at));
    },
    enabled: !!machineId && controlPoints.length > 0,
    staleTime: 1000 * 60 * 5,
  });

  const { data: issues = [] } = useQuery({
    queryKey: ["issues", machineId],
    queryFn: async () => {
        // Fetch machine-wide issues + all reported issues, filter client-side to avoid per-CP requests
        const [machineIssues, allReported] = await Promise.all([
          base44.entities.Issue.filter({ machine_id: machineId, status: "reported" }),
          base44.entities.Issue.filter({ status: "reported" }, "-created_date", 200),
        ]);
        const cpIds = new Set(controlPoints.map(p => p.id));
        const cpIssues = allReported.filter(i => cpIds.has(i.control_point_id));
        const seen = new Set();
        return [...machineIssues, ...cpIssues].filter(i => {
          if (seen.has(i.id)) return false;
          seen.add(i.id);
          return true;
        });
    },
    enabled: !!machineId && controlPoints.length > 0,
    staleTime: 1000 * 60,
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

  const { data: predictiveAnalysis = [] } = useQuery({
    queryKey: ["predictiveAnalysis", machineId],
    queryFn: () => base44.entities.PredictiveAnalysis.filter({ machine_id: machineId }, "-analysis_date"),
    enabled: !!machineId
  });

  const runPredictionMutation = useMutation({
    mutationFn: async () => {
      const response = await base44.functions.invoke('predictMachineHealth', { machine_id: machineId });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["predictiveAnalysis"] });
    },
    onError: (error) => {
        alert("Chyba při predikci: " + error.message);
    }
  });

  const deletePredictionMutation = useMutation({
    mutationFn: (id) => base44.entities.PredictiveAnalysis.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["predictiveAnalysis"] });
    },
    onError: (error) => {
      alert("Chyba při mazání predikce: " + error.message);
    }
  });

  const canDeletePredictions = currentUser && (currentUser.user_type === 'admin' || currentUser.user_type === 'superAdmin');

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

  const getPointStatus = (point) => {
    const pointRecords = records
      .filter((r) => r.control_point_id === point.id)
      .sort((a, b) => new Date(b.performed_at) - new Date(a.performed_at));
    
    const vizType = company?.overdue_visualization_type || "two_colors";
    const tolerance = company?.overdue_tolerance_percent || 4;
    const interval = point.interval_hours || 0;

    let lastPerformed;
    if (pointRecords.length > 0 && point.first_confirmation_date) {
        // Oba existují - vzít novější
        const lastRecordDate = new Date(pointRecords[0].performed_at);
        const firstConfirmDate = new Date(point.first_confirmation_date);
        lastPerformed = lastRecordDate > firstConfirmDate ? lastRecordDate : firstConfirmDate;
    } else if (pointRecords.length > 0) {
        lastPerformed = new Date(pointRecords[0].performed_at);
    } else if (point.first_confirmation_date) {
        lastPerformed = new Date(point.first_confirmation_date);
    } else {
         return vizType === "traffic_light" ? "critical" : "warning";
    }

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
    const pointRecords = records
      .filter(r => r.control_point_id === point.id)
      .sort((a, b) => new Date(b.performed_at) - new Date(a.performed_at));
    if (!point.interval_hours) return null;

    let lastPerformed;
    if (pointRecords.length > 0 && point.first_confirmation_date) {
        // Oba existují - vzít novější
        const lastRecordDate = new Date(pointRecords[0].performed_at);
        const firstConfirmDate = new Date(point.first_confirmation_date);
        lastPerformed = lastRecordDate > firstConfirmDate ? lastRecordDate : firstConfirmDate;
    } else if (pointRecords.length > 0) {
        lastPerformed = new Date(pointRecords[0].performed_at);
    } else if (point.first_confirmation_date) {
        lastPerformed = new Date(point.first_confirmation_date);
    } else {
        return null;
    }

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

  const lubricationPoints = controlPoints.filter(p => p.type === "lubrication").sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
  const inspectionPoints = controlPoints.filter(p => p.type === "inspection").sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
  const lubricatorPoints = controlPoints.filter(p => p.type === "auto_lubricator").sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
  const preventionPoints = controlPoints.filter(p => p.type === "prevention").sort((a, b) => (a.order_index || 0) - (b.order_index || 0));

  const overduePoints = controlPoints.filter(p => getPointStatus(p) === "overdue");
  const okPoints = controlPoints.filter(p => getPointStatus(p) === "ok");

  const getGroupStatus = (points) => {
    if (points.length === 0) return null;
    const hasCritical = points.some(p => getPointStatus(p) === "critical");
    if (hasCritical) return "critical";
    const hasWarning = points.some(p => getPointStatus(p) === "warning");
    if (hasWarning) return "warning";
    return "ok";
  };

  const lubricationStatus = getGroupStatus(lubricationPoints);
  const inspectionStatus = getGroupStatus(inspectionPoints);
  const lubricatorsStatus = getGroupStatus(lubricatorPoints);
  const preventionStatus = getGroupStatus(preventionPoints);

  const lowStockParts = spareParts.filter(p => p.quantity_in_stock <= (p.minimum_stock || 0));
  const vibrationTabAlertLevelResolved = (!machine?.monitor_vibration || !machineId) ? -1 : (() => { try { return parseInt(localStorage.getItem(`vibro_tab_alert_${machineId}`) || "-1", 10); } catch { return -1; } })();

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

  const renderDocCategory = (category, emptyText) => (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {documentation.filter(doc => doc.category === category).map((doc) => (
        <div key={doc.id} className="group relative aspect-video rounded-lg overflow-hidden border-2 border-slate-200 hover:border-indigo-400 transition-all cursor-pointer bg-slate-50 flex items-center justify-center" onClick={() => { setSelectedDocPreview(doc); setShowDocPreviewDialog(true); }}>
          {doc.file_type === "photo" ? (<img src={doc.file_url} alt={doc.file_name} className="w-full h-full object-cover" />) : (<div className="flex flex-col items-center p-4 text-center">{getFileIcon(doc.file_type)}<p className="text-xs text-slate-600 mt-2 truncate max-w-full">{doc.file_name}</p></div>)}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-all flex items-center justify-center"><Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity bg-red-600 hover:bg-red-700 text-white" onClick={(e) => { e.stopPropagation(); setDeleteDocId(doc.id); }}><X className="w-5 h-5" /></Button></div>
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2"><p className="text-xs text-white truncate">{doc.file_name}</p><p className="text-xs text-white/70">{format(new Date(doc.created_date), "d. M. yyyy", { locale: cs })}</p></div>
        </div>
      ))}
      {documentation.filter(doc => doc.category === category).length === 0 && (<p className="col-span-full text-center text-slate-500 py-8">{emptyText}</p>)}
    </div>
  );

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedUploadFile(file);
      setUploadFileName(file.name);
    }
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

  const renderPointsList = (points, type) => {
    if (points.length === 0) {
      return (
        <Card>
          <CardContent className="p-12 text-center">
            <Droplet className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500">
              {type === "lubrication" ? "Nejsou definovány žádné mazací body" :
               type === "inspection" ? "Nejsou definovány žádné inspekční body" :
               type === "prevention" ? "Nejsou definovány žádné preventivní body" :
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
          const pointRecords = records
            .filter(r => r.control_point_id === point.id)
            .sort((a, b) => new Date(b.performed_at) - new Date(a.performed_at));
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
                      ) : type === "inspection" || type === "prevention" ? (
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
        <Tabs defaultValue={
          window.location.hash === "#vibration" ? "vibro-diag" :
          window.location.hash === "#thermo" ? "thermo" :
          window.location.hash === "#tribo" ? "tribo" :
          window.location.hash === "#maintenance" ? "maintenance" :
          urlParams.get("tab") || "overview"
        } className="space-y-6">
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
            
            {machine?.monitor_vibration && (
              <TabsTrigger value="vibro-diag" className="flex-1 min-w-[100px] gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-blue-700 data-[state=active]:text-white">
                <Activity className="w-4 h-4" />
                <span className="hidden md:inline">Vibrace</span>
                {vibrationTabAlertLevelResolved >= 0 && (
                  <div className={`w-2.5 h-2.5 rounded-full ml-1 flex-shrink-0 ${
                    vibrationTabAlertLevelResolved === 0 ? "bg-green-500" :
                    vibrationTabAlertLevelResolved === 1 ? "bg-yellow-400" :
                    vibrationTabAlertLevelResolved === 2 ? "bg-orange-500" :
                    "bg-red-600 animate-pulse"
                  }`}
                    title={
                      vibrationTabAlertLevelResolved === 0 ? "Vibrace: OK" :
                      vibrationTabAlertLevelResolved === 1 ? "Vibrace: Pozor (A/B)" :
                      vibrationTabAlertLevelResolved === 2 ? "Vibrace: Alarm (B/C)" :
                      "Vibrace: KRITICKÉ (C/D)"
                    }
                  />
                )}
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
            <TabsTrigger value="predictive" className="flex-1 min-w-[100px] gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-cyan-600 data-[state=active]:to-cyan-700 data-[state=active]:text-white">
              <Brain className="w-4 h-4" />
              <span className="hidden md:inline">AI Predikce</span>
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
                                      : point.type === "prevention" ? "Prevence"
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
                            onClick={() => navigate(createPageUrl(`IssueDetail?id=${issue.id}`))}
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
            <Tabs defaultValue={urlParams.get("subtab") || "lubrication"} className="space-y-6">
              <TabsList className={`grid w-full ${preventionPoints.length > 0 ? "grid-cols-4" : "grid-cols-3"} bg-white shadow-sm`}>
                <TabsTrigger value="lubrication" className="gap-2">
                  <Droplet className="w-4 h-4" />
                  Mazání ({lubricationPoints.length})
                  {lubricationStatus && (
                    <div className={`w-2 h-2 rounded-full ml-1 ${
                      lubricationStatus === "critical" ? "bg-red-500" : lubricationStatus === "warning" ? "bg-yellow-500" : "bg-green-500"
                    }`} />
                  )}
                </TabsTrigger>
                <TabsTrigger value="inspection" className="gap-2">
                  <CheckCircle className="w-4 h-4" />
                  Inspekce ({inspectionPoints.length})
                  {inspectionStatus && (
                    <div className={`w-2 h-2 rounded-full ml-1 ${
                      inspectionStatus === "critical" ? "bg-red-500" : inspectionStatus === "warning" ? "bg-yellow-500" : "bg-green-500"
                    }`} />
                  )}
                </TabsTrigger>
                <TabsTrigger value="lubricators" className="gap-2">
                  <Droplet className="w-4 h-4" />
                  Maznice ({lubricatorPoints.length})
                  {lubricatorsStatus && (
                    <div className={`w-2 h-2 rounded-full ml-1 ${
                      lubricatorsStatus === "critical" ? "bg-red-500" : lubricatorsStatus === "warning" ? "bg-yellow-500" : "bg-green-500"
                    }`} />
                  )}
                </TabsTrigger>
                {preventionPoints.length > 0 && (
                  <TabsTrigger value="prevention" className="gap-2">
                    <ClipboardCheck className="w-4 h-4" />
                    Prevence ({preventionPoints.length})
                    {preventionStatus && (
                      <div className={`w-2 h-2 rounded-full ml-1 ${
                        preventionStatus === "critical" ? "bg-red-500" : preventionStatus === "warning" ? "bg-yellow-500" : "bg-green-500"
                      }`} />
                    )}
                  </TabsTrigger>
                )}
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

              <TabsContent value="prevention">
                {renderPointsList(preventionPoints, "prevention")}
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
                      {renderDocCategory("operational", "Žádná provozní dokumentace nebyla přidána.")}
                    </TabsContent>
                    <TabsContent value="other">
                      {renderDocCategory("other", "Žádná další dokumentace nebyla přidána.")}
                    </TabsContent>
                  </Tabs>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Údržba a servis */}
          <TabsContent value="maintenance">
            <MaintenanceTab
              machine={machine}
              machineId={machineId}
              line={line}
              currentUser={currentUser}
              allUsers={allUsers}
              maintenanceRecords={maintenanceRecords}
              plannedMaintenance={plannedMaintenance}
              issues={issues}
              controlPoints={controlPoints}
              records={records}
              inspectionRecords={inspectionRecords}
              getUserDisplayName={getUserDisplayName}
            />
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
          <TabsContent value="vibro-diag" className="space-y-6">
            <VibrationCardMQTT machine={machine} />
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

          {/* AI Prediktivní údržba */}
          <TabsContent value="predictive" className="space-y-6">
            <Card className="border-none shadow-lg bg-gradient-to-br from-slate-900 to-slate-800 text-white overflow-hidden relative">
                <div className="absolute top-0 right-0 p-32 bg-cyan-500/10 rounded-full blur-3xl -mr-16 -mt-16"></div>
                <div className="absolute bottom-0 left-0 p-32 bg-purple-500/10 rounded-full blur-3xl -ml-16 -mb-16"></div>
                
                <CardContent className="p-8 relative z-10">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                        <div>
                            <h2 className="text-3xl font-bold mb-2 flex items-center gap-3">
                                <Sparkles className="w-8 h-8 text-cyan-400" />
                                AI Prediktivní Analýza
                            </h2>
                            <p className="text-slate-300 max-w-xl">
                                Využijte umělou inteligenci k analýze historických dat, identifikaci vzorců a předpovědi potenciálních poruch.
                            </p>
                        </div>
                        <Button 
                            size="lg" 
                            onClick={() => runPredictionMutation.mutate()} 
                            disabled={runPredictionMutation.isLoading}
                            className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-lg shadow-cyan-500/25 border-0"
                        >
                            {runPredictionMutation.isLoading ? (
                                <>
                                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                    Analyzuji data...
                                </>
                            ) : (
                                <>
                                    <Cpu className="w-5 h-5 mr-2" />
                                    Spustit novou analýzu
                                </>
                            )}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {predictiveAnalysis.length > 0 ? (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Latest Analysis - Main Card */}
                    <div className="lg:col-span-2 space-y-6">
                        <Card className="border-t-4 border-t-cyan-500 shadow-lg">
                            <CardHeader>
                                <div className="flex justify-between items-start">
                                    <div>
                                        <CardTitle className="flex items-center gap-2 text-xl">
                                            <Activity className="w-6 h-6 text-cyan-600" />
                                            Výsledek poslední analýzy
                                        </CardTitle>
                                        <p className="text-sm text-slate-500 mt-1">
                                            {format(new Date(predictiveAnalysis[0].analysis_date), "d. MMMM yyyy HH:mm", { locale: cs })}
                                        </p>
                                    </div>
                                    {predictiveAnalysis[0].failure_probability > 50 ? (
                                        <Badge variant="destructive" className="text-sm py-1 px-3">
                                            Vysoké riziko
                                        </Badge>
                                    ) : (
                                        <Badge className="bg-green-100 text-green-700 hover:bg-green-200 text-sm py-1 px-3">
                                            Stabilní stav
                                        </Badge>
                                    )}
                                    {canDeletePredictions && (
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="text-slate-400 hover:text-red-600 hover:bg-red-50 -mr-2"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if(confirm("Opravdu smazat tuto predikci?")) {
                                                    deletePredictionMutation.mutate(predictiveAnalysis[0].id);
                                                }
                                            }}
                                        >
                                            <Trash2 className="w-5 h-5" />
                                        </Button>
                                    )}
                                </div>
                            </CardHeader>
                            <CardContent className="p-6 pt-0">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                                        <h4 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Zdraví stroje</h4>
                                        <div className="flex items-end gap-2">
                                            <span className="text-5xl font-bold text-slate-900">{predictiveAnalysis[0].health_score}</span>
                                            <span className="text-xl text-slate-400 mb-1">/ 100</span>
                                        </div>
                                        <div className="w-full bg-slate-200 rounded-full h-2 mt-3">
                                            <div 
                                                className={`h-2 rounded-full transition-all duration-1000 ${
                                                    predictiveAnalysis[0].health_score > 80 ? 'bg-green-500' : 
                                                    predictiveAnalysis[0].health_score > 50 ? 'bg-yellow-500' : 'bg-red-500'
                                                }`}
                                                style={{ width: `${predictiveAnalysis[0].health_score}%` }}
                                            />
                                        </div>
                                    </div>

                                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                                        <h4 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Pravděpodobnost selhání (30 dní)</h4>
                                        <div className="flex items-end gap-2">
                                            <span className={`text-5xl font-bold ${
                                                predictiveAnalysis[0].failure_probability > 50 ? 'text-red-600' : 
                                                predictiveAnalysis[0].failure_probability > 20 ? 'text-orange-500' : 'text-green-600'
                                            }`}>{predictiveAnalysis[0].failure_probability}%</span>
                                        </div>
                                        <div className="w-full bg-slate-200 rounded-full h-2 mt-3">
                                            <div 
                                                className={`h-2 rounded-full transition-all duration-1000 ${
                                                    predictiveAnalysis[0].failure_probability > 50 ? 'bg-red-500' : 
                                                    predictiveAnalysis[0].failure_probability > 20 ? 'bg-orange-500' : 'bg-green-500'
                                                }`}
                                                style={{ width: `${predictiveAnalysis[0].failure_probability}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-6">
                                    <div>
                                        <h3 className="font-semibold text-slate-900 flex items-center gap-2 mb-3">
                                            <AlertTriangle className="w-5 h-5 text-orange-500" />
                                            Identifikované problémy
                                        </h3>
                                        <div className="bg-orange-50 border border-orange-100 rounded-lg p-4 text-slate-800">
                                            {predictiveAnalysis[0].predicted_issues}
                                        </div>
                                    </div>

                                    <div>
                                        <h3 className="font-semibold text-slate-900 flex items-center gap-2 mb-3">
                                            <CheckCircle className="w-5 h-5 text-green-600" />
                                            Doporučená opatření
                                        </h3>
                                        <div className="bg-green-50 border border-green-100 rounded-lg p-4 text-slate-800 whitespace-pre-line">
                                            {predictiveAnalysis[0].recommendations}
                                        </div>
                                    </div>

                                    <div>
                                        <h3 className="font-semibold text-slate-900 flex items-center gap-2 mb-3">
                                            <Brain className="w-5 h-5 text-purple-600" />
                                            AI Reasoning
                                        </h3>
                                        <p className="text-slate-600 text-sm italic bg-slate-50 p-4 rounded-lg border border-slate-100">
                                            "{predictiveAnalysis[0].reasoning}"
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* History Sidebar */}
                    <div>
                        <Card className="h-full shadow-lg">
                            <CardHeader>
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <Clock className="w-5 h-5 text-slate-500" />
                                    Historie predikcí
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4 relative before:absolute before:left-4 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-100">
                                    {predictiveAnalysis.slice(1).map((analysis) => (
                                        <div key={analysis.id} className="relative pl-10">
                                            <div className={`absolute left-[13px] top-1.5 w-2.5 h-2.5 rounded-full border-2 border-white ${
                                                analysis.health_score > 80 ? 'bg-green-500' : 
                                                analysis.health_score > 50 ? 'bg-yellow-500' : 'bg-red-500'
                                            }`}></div>
                                            
                                            <div className="bg-white border border-slate-200 rounded-lg p-3 hover:shadow-md transition-shadow cursor-pointer group relative">
                                                <div className="flex justify-between items-start mb-1">
                                                    <span className="text-xs font-bold text-slate-500">
                                                        {format(new Date(analysis.analysis_date), "d.M.yyyy", { locale: cs })}
                                                    </span>
                                                    <Badge variant="outline" className={
                                                        analysis.health_score > 80 ? "text-green-600 border-green-200 bg-green-50" : 
                                                        analysis.health_score > 50 ? "text-yellow-600 border-yellow-200 bg-yellow-50" : "text-red-600 border-red-200 bg-red-50"
                                                    }>
                                                        {analysis.health_score}%
                                                    </Badge>
                                                </div>
                                                <p className="text-xs text-slate-600 line-clamp-2 mb-2">
                                                    {analysis.predicted_issues}
                                                </p>
                                                <div className="text-xs text-slate-400">
                                                    Riziko: {analysis.failure_probability}%
                                                </div>
                                                {canDeletePredictions && (
                                                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-6 w-6 text-slate-400 hover:text-red-600 hover:bg-red-50"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                if(confirm("Opravdu smazat tuto predikci?")) {
                                                                    deletePredictionMutation.mutate(analysis.id);
                                                                }
                                                            }}
                                                        >
                                                            <Trash2 className="w-3 h-3" />
                                                        </Button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                    {predictiveAnalysis.length <= 1 && (
                                        <p className="text-center text-slate-400 text-sm py-4 pl-4">
                                            Zatím žádná historie
                                        </p>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            ) : (
                <Card className="border-dashed border-2 border-slate-200 bg-slate-50/50">
                    <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                        <Brain className="w-16 h-16 text-slate-300 mb-4" />
                        <h3 className="text-xl font-bold text-slate-700 mb-2">Zatím nebyla provedena žádná analýza</h3>
                        <p className="text-slate-500 max-w-md mb-6">
                            Klikněte na tlačítko "Spustit novou analýzu" pro vygenerování první AI predikce stavu tohoto stroje.
                        </p>
                        <Button 
                            onClick={() => runPredictionMutation.mutate()} 
                            disabled={runPredictionMutation.isLoading}
                            variant="outline"
                        >
                            {runPredictionMutation.isLoading ? "Pracuji..." : "Spustit analýzu nyní"}
                        </Button>
                    </CardContent>
                </Card>
            )}
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

        {/* Dialog pro nahrání dokumentace */}
        <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nahrát dokumentaci</DialogTitle>
              <DialogDescription>
                Nahrajte novou dokumentaci ke stroji {machine.name}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="category">Kategorie *</Label>
                <Select
                  value={uploadingCategory}
                  onValueChange={setUploadingCategory}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="drawing">Výkresová dokumentace</SelectItem>
                    <SelectItem value="operational">Provozní dokumentace</SelectItem>
                    <SelectItem value="other">Ostatní</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="file">Soubor *</Label>
                <div className="flex gap-2 mt-1.5">
                  <input
                    ref={fileInputRef}
                    type="file"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    {selectedUploadFile ? "Změnit soubor" : "Vybrat soubor"}
                  </Button>
                </div>
                {selectedUploadFile && (
                  <p className="text-xs text-slate-500 mt-1">
                    Vybráno: {selectedUploadFile.name}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="filename">Název souboru *</Label>
                <Input
                  id="filename"
                  value={uploadFileName}
                  onChange={(e) => setUploadFileName(e.target.value)}
                  placeholder="Zadejte název souboru"
                  className="mt-1.5"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowUploadDialog(false);
                  setSelectedUploadFile(null);
                  setUploadFileName("");
                }}
              >
                Zrušit
              </Button>
              <Button
                onClick={handleFileUpload}
                disabled={!selectedUploadFile || !uploadFileName || isUploading}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Nahrávám...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Nahrát
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