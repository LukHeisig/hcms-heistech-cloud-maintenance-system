import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { moduleData } from "@/lib/moduleData";
import { isModuleEnabled } from "@/lib/companyModules";
import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { formatMachineName } from "@/lib/utils";
import { getEffectiveHoursSince } from "@/lib/intervalCalculations";
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
import "@/components/dashboard/equipmentNavigation.css";
import DashboardMachineRow from "@/components/dashboard/DashboardMachineRow";
import LineIssueRow from "@/components/issues/LineIssueRow";

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
    staleTime: 60000,
  });

  const { data: company } = useQuery({
    queryKey: ["company", line?.company_id],
    queryFn: () => base44.entities.Company.filter({ id: line.company_id }).then(res => res[0]),
    enabled: !!line?.company_id,
    staleTime: 60000,
  });

  const { data: machines = [] } = useQuery({
    queryKey: ["machines", lineId],
    queryFn: () => base44.entities.Machine.filter({ line_id: lineId }, "order_index"),
    enabled: !!lineId,
    staleTime: 300000, // 5 minutes
  });

  const { data: allControlPoints = [] } = useQuery({
    queryKey: ["allControlPoints"],
    queryFn: () => base44.entities.ControlPoint.list(null, 2000),
    staleTime: 300000, // 5 minutes
  });





  const { data: allMaintenance = [] } = useQuery({
    queryKey: ["allMaintenance"],
    queryFn: () => base44.entities.MaintenanceRecord.list("-performed_at", 500),
    staleTime: 300000, // 5 minutes
  });

  const { data: allPlannedMaintenance = [] } = useQuery({
    queryKey: ["allPlannedMaintenance"],
    queryFn: () => base44.entities.PlannedMaintenance.list(),
    staleTime: 300000, // 5 minutes
  });

  const { data: allResponsibilities = [] } = useQuery({
    queryKey: ["allResponsibilities"],
    queryFn: () => base44.entities.MachineResponsibility.list(),
    staleTime: 300000, // 5 minutes
  });

  const { data: checkSections = [] } = useQuery({
    queryKey: ["checkSections", lineId],
    queryFn: () => base44.entities.LineCheckSection.filter({ line_id: lineId }, "order_index"),
    enabled: !!lineId,
    staleTime: 300000, // 5 minutes
  });

  const { data: allCheckPoints = [] } = useQuery({
    queryKey: ["lineCheckPoints"],
    queryFn: () => base44.entities.LineCheckPoint.list("order_index"),
    staleTime: 300000, // 5 minutes
  });

  const { data: checkRecords = [] } = useQuery({
    queryKey: ["lineCheckRecords", lineId],
    queryFn: () => base44.entities.LineCheckRecord.filter({ line_id: lineId }, "-created_date"),
    enabled: !!lineId,
    staleTime: 300000, // 5 minutes
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ["allUsers"],
    queryFn: async () => {
      const { data } = await base44.functions.invoke("getUsers");
      return data;
    },
    staleTime: 300000,
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

  const lubricationMachines = useMemo(() => {
    return machines.filter(m => {
      const isLubricationCategory = (m.maintenance_category || "lubrication") === "lubrication";
      const hasLubricationPoints = controlPoints.some(cp => 
        cp.machine_id === m.id && 
        ['lubrication', 'inspection', 'auto_lubricator'].includes(cp.type)
      );
      return isLubricationCategory && hasLubricationPoints;
    });
  }, [machines, controlPoints]);

  const preventionMachines = useMemo(() => {
    return machines.filter(m => 
      controlPoints.some(cp => cp.machine_id === m.id && cp.type === "prevention")
    );
  }, [machines, controlPoints]);

  const pointIds = useMemo(() => controlPoints.map(point => point.id), [controlPoints]);
  const { data: latestChecks = {}, isPending: latestChecksLoading } = useQuery({
    queryKey: ["records", "lineLatest", lineId, pointIds],
    queryFn: async () => {
      const result = await base44.entities.ControlRecord.aggregate({
        query: { control_point_id: { $in: pointIds } },
        groupBy: "control_point_id", max: "performed_at", limit: 1000,
      });
      return Object.fromEntries(result.rows.map(row => [row.control_point_id, row.max_performed_at]));
    },
    enabled: pointIds.length > 0,
    staleTime: 60000,
  });
  const activeIssueQuery = useMemo(() => ({
    status: { $in: ["reported", "work_order_created"] },
    $or: [{ machine_id: { $in: machineIds } }, { control_point_id: { $in: pointIds } }],
  }), [machineIds, pointIds]);
  const { data: issuePages, isPending: issuesLoading, hasNextPage: hasMoreIssues, fetchNextPage: loadMoreIssues, isFetchingNextPage: loadingMoreIssues } = useInfiniteQuery({
    queryKey: ["lineActiveIssues", lineId, activeIssueQuery],
    queryFn: ({ pageParam }) => base44.entities.Issue.filter(activeIssueQuery, { sort: "-created_date", limit: 50, ...(pageParam ? { cursor: pageParam } : {}) }),
    initialPageParam: undefined,
    getNextPageParam: page => page.has_more ? page.next_cursor : undefined,
    enabled: machineIds.length > 0,
    staleTime: 60000,
  });
  const issues = useMemo(() => issuePages?.pages.flatMap(page => page.items) || [], [issuePages]);
  const { data: issueCounts } = useQuery({
    queryKey: ["lineActiveIssueCounts", lineId, machineIds, pointIds],
    queryFn: async () => {
      const [byMachine, byPoint] = await Promise.all([
        base44.entities.Issue.aggregate({ query: { status: activeIssueQuery.status, machine_id: { $in: machineIds } }, groupBy: "machine_id", limit: 1000 }),
        base44.entities.Issue.aggregate({ query: { status: activeIssueQuery.status, machine_id: { $nin: machineIds }, control_point_id: { $in: pointIds } }, groupBy: "control_point_id", limit: 1000 }),
      ]);
      const counts = {};
      for (const row of byMachine.rows) counts[row.machine_id] = row.count;
      for (const row of byPoint.rows) {
        const machineId = controlPoints.find(point => point.id === row.control_point_id)?.machine_id;
        if (machineId) counts[machineId] = (counts[machineId] || 0) + row.count;
      }
      return counts;
    },
    enabled: machineIds.length > 0,
    staleTime: 60000,
  });

  const activeIssuesByYearAndDate = useMemo(() => {
    
    // Group by Year -> Date
    const grouped = {};
    
    issues.forEach(issue => {
        const dateObj = new Date(issue.created_date);
        const year = dateObj.getFullYear();
        const dateKey = format(dateObj, "yyyy-MM-dd");
        
        if (!grouped[year]) grouped[year] = {};
        if (!grouped[year][dateKey]) grouped[year][dateKey] = [];
        
        grouped[year][dateKey].push(issue);
    });
    
    return grouped;
  }, [issues, controlPoints]);

  const maintenanceRecords = useMemo(() => {
    return allMaintenance.filter(m => machineIds.includes(m.machine_id));
  }, [allMaintenance, machineIds]);

  const plannedMaintenance = useMemo(() => {
    return allPlannedMaintenance.filter(pm => machineIds.includes(pm.machine_id));
  }, [allPlannedMaintenance, machineIds]);

  const responsibilities = useMemo(() => {
    return allResponsibilities.filter(r => machineIds.includes(r.machine_id));
  }, [allResponsibilities, machineIds]);

  const modDemip = isModuleEnabled(company, "enable_demip");
  const modMaintenance = isModuleEnabled(company, "enable_maintenance");
  const modVibration = isModuleEnabled(company, "enable_vibration");
  const modThermo = isModuleEnabled(company, "enable_thermo");
  const modTribo = isModuleEnabled(company, "enable_tribo");

  const hasDiagnostics = useMemo(() => {
    return machines.some(m => (modVibration && m.vibration_schema_id) || (modThermo && true) || (modTribo && true));
  }, [machines, modVibration, modThermo, modTribo]);

  // Pokud aktivní záložka není v podniku dostupná, přepni na Přehled
  useEffect(() => {
    if (!company) return;
    const allowed = { lubrication: modDemip, prevention: modMaintenance, checklist: modMaintenance, diagnostics: hasDiagnostics };
    if (allowed[activeTab] === false) setActiveTab("overview");
  }, [company, activeTab, modDemip, modMaintenance, hasDiagnostics]);

  // Vibration monitoring machines
  const vibrationMachineIds = useMemo(() => machines.filter(m => m.vibration_schema_id).map(m => m.id), [machines]);

  // Load VibrationSensorAssignments for vibration machines (includes sensor + standard IDs)
  const { data: lineVibrationAssignments = [] } = useQuery({
    queryKey: ["lineVibrationAssignments", vibrationMachineIds.join(",")],
    queryFn: async () => {
      if (vibrationMachineIds.length === 0) return [];
      const results = [];
      for (const mid of vibrationMachineIds) {
        const assignments = await moduleData.filter("VibrationSensorAssignment", { machine_id: mid });
        results.push(...assignments.map(a => ({ ...a, _machineId: mid })));
      }
      return results;
    },
    enabled: vibrationMachineIds.length > 0,
    staleTime: 120000,
  });

  // Load sensors assigned to vibration machines (for sensor_id lookup)
  const lineSensors = useMemo(() => {
    return lineVibrationAssignments
      .filter(a => a.sensor_id)
      .map(a => ({ sensor_id: a.sensor_id, _machineId: a._machineId }));
  }, [lineVibrationAssignments]);

  // Load latest sensor data for all sensors on this line
  // Use pre-computed values from SensorData (same as VibrationCardMQTT)
  const { data: lineVibroData = {} } = useQuery({
    queryKey: ["lineVibroData", lineVibrationAssignments.map(a => a.sensor_id).filter(Boolean).join(",")],
    queryFn: async () => {
      const sensorIds = [...new Set(lineVibrationAssignments.map(a => a.sensor_id).filter(Boolean))];
      if (sensorIds.length === 0) return {};

      return moduleData.latestSensorData(sensorIds);
    },
    enabled: lineVibrationAssignments.some(a => a.sensor_id),
    staleTime: 60000,
  });

  // Load vibration standards for limit evaluation
  const { data: allVibrationStandards = [] } = useQuery({
    queryKey: ["vibrationStandards"],
    queryFn: () => base44.entities.VibrationStandard.list(null, 500),
    staleTime: 300000,
  });
  const standardsById = useMemo(() => Object.fromEntries(allVibrationStandards.map(s => [s.id, s])), [allVibrationStandards]);

  // Compute vibration alert level for a machine from live data (using DB assignments)
  const computeVibroLevelForMachine = (machineId) => {
    const machineAssignments = lineVibrationAssignments.filter(a => a._machineId === machineId && a.sensor_id);
    if (machineAssignments.length === 0) return -1; // no sensors assigned

    const getLimitLevel = (value, limitA, limitB, limitC) => {
      if (value == null || limitA == null) return -1;
      if (value < limitA) return 0;
      if (value < limitB) return 1;
      if (value < limitC) return 2;
      return 3;
    };

    let worstLevel = -1;
    for (const assignment of machineAssignments) {
      const data = lineVibroData[assignment.sensor_id];
      if (!data) continue;
      const velStd = standardsById[assignment.vel_standard_id];
      const accStd = standardsById[assignment.acc_standard_id];
      const levels = [
        getLimitLevel(data.vel_rms_x_mm_s, velStd?.limit_ab, velStd?.limit_bc, velStd?.limit_cd),
        getLimitLevel(data.vel_rms_y_mm_s, velStd?.limit_ab, velStd?.limit_bc, velStd?.limit_cd),
        getLimitLevel(data.vel_rms_z_mm_s, velStd?.limit_ab, velStd?.limit_bc, velStd?.limit_cd),
        getLimitLevel(data.oa_acc_z, accStd?.acc_limit_ab, accStd?.acc_limit_bc, accStd?.acc_limit_cd),
        getLimitLevel(data.env_rms_z, accStd?.acc_limit_ab, accStd?.acc_limit_bc, accStd?.acc_limit_cd),
      ].filter(l => l >= 0);
      if (levels.length > 0) worstLevel = Math.max(worstLevel, ...levels);
    }

    // If assignments exist but no standards set and sensors have data → show green (0)
    if (worstLevel === -1) {
      const hasSensorData = machineAssignments.some(a => lineVibroData[a.sensor_id]);
      if (hasSensorData) return 0;
    }

    return worstLevel;
  };

  const getVibroAlertLevel = (machineId) => {
    return computeVibroLevelForMachine(machineId);
  };

  const VibroStatusDot = ({ machineId }) => {
    const level = getVibroAlertLevel(machineId);
    if (level < 0) return null;
    const colors = ["bg-green-500", "bg-yellow-400", "bg-orange-500", "bg-red-600"];
    const labels = ["OK", "Varování", "Alarm", "Nebezpečí"];
    return (
      <span title={`Vibrace: ${labels[level] || ""}`} className={`inline-block w-3 h-3 rounded-full flex-shrink-0 ${colors[level] || "bg-slate-300"}`} />
    );
  };

  const getVibroBgText = (machineId) => {
    const level = getVibroAlertLevel(machineId);
    // level 0=A(zelená), 1=B(tmavě zelená), 2=C(žlutá), 3=D(červená)
    const colorPairs = [
      { bg: "bg-green-100", text: "text-green-600" },
      { bg: "bg-green-100", text: "text-green-800" },
      { bg: "bg-yellow-100", text: "text-yellow-700" },
      { bg: "bg-red-100", text: "text-red-600" }
    ];
    if (level < 0) return { bg: "bg-slate-100", text: "text-slate-400" };
    return colorPairs[level] ?? colorPairs[0];
  };

  const getMachineStatusStyles = (machineId) => {
    const mPoints = controlPoints.filter(p => p.machine_id === machineId);
    const hasCritical = mPoints.some(p => getPointStatus(p) === "critical");
    const hasWarning = mPoints.some(p => getPointStatus(p) === "warning");
    
    if (hasCritical) return { bg: "bg-red-100", text: "text-red-600", border: "border-red-200" };
    if (hasWarning) return { bg: "bg-orange-100", text: "text-orange-600", border: "border-orange-200" };

    return { bg: "bg-green-100", text: "text-green-600", border: "border-green-200" };
  };

  const getPointStatus = (point) => {
    if (latestChecksLoading) return "loading";
    const latestPerformedAt = latestChecks[point.id];
    
    const vizType = company?.overdue_visualization_type || "two_colors";
    const tolerance = company?.overdue_tolerance_percent || 4;
    const interval = point.interval_hours || 0;

    let lastPerformed;
    if (latestPerformedAt && point.first_confirmation_date) {
      const lastRecordDate = new Date(latestPerformedAt);
      const firstConfirmDate = new Date(point.first_confirmation_date);
      lastPerformed = lastRecordDate > firstConfirmDate ? lastRecordDate : firstConfirmDate;
    } else if (latestPerformedAt) {
      lastPerformed = new Date(latestPerformedAt);
    } else if (point.first_confirmation_date) {
      lastPerformed = new Date(point.first_confirmation_date);
    } else {
      return vizType === "traffic_light" ? "critical" : "warning";
    }

    const now = new Date();
    const hoursSince = getEffectiveHoursSince(lastPerformed, now, line?.excluded_days);

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

  const overduePoints = useMemo(() => {
    return controlPoints.filter(p => ["warning", "critical"].includes(getPointStatus(p)));
  }, [controlPoints, latestChecks, latestChecksLoading, company, line?.excluded_days]);

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
      issuesCount: Object.values(issueCounts || {}).reduce((total, count) => total + count, 0),
      maintenanceThisMonth: thisMonth.length,
      totalCostThisMonth: totalCost,
      plannedCount: plannedMaintenance.filter(pm => pm.status !== 'completed' && pm.status !== 'cancelled').length,
    };
  }, [machines, controlPoints, overduePoints, issueCounts, maintenanceRecords, plannedMaintenance]);

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
    <div className="equipment-line-detail min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg">
        <div className="max-w-screen-2xl mx-auto p-6">
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

          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold mb-2">{line.name}</h1>
              {line.description && (
                <p className="text-blue-100 text-lg">{line.description}</p>
              )}
            </div>
            {/* Mini statistiky v headeru */}
            <div className="hidden sm:flex gap-3 flex-wrap">
              <div className="flex items-center gap-2 bg-white/15 rounded-lg px-3 py-2">
                <Factory className="w-4 h-4 text-blue-200" />
                <div>
                  <p className="text-[10px] text-blue-200 leading-none">Stroje</p>
                  <p className="text-xl font-bold leading-tight">{stats.machinesCount}</p>
                </div>
              </div>
              {modDemip && <>
              <div className="flex items-center gap-2 bg-white/15 rounded-lg px-3 py-2">
                <Droplet className="w-4 h-4 text-blue-200" />
                <div>
                  <p className="text-[10px] text-blue-200 leading-none">Kontrolní body</p>
                  <p className="text-xl font-bold leading-tight">{stats.pointsCount}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 bg-white/15 rounded-lg px-3 py-2">
                <Clock className="w-4 h-4 text-red-300" />
                <div>
                  <p className="text-[10px] text-blue-200 leading-none">Po termínu</p>
                  <p className={`text-xl font-bold leading-tight ${stats.overdueCount > 0 ? 'text-red-300' : ''}`}>{stats.overdueCount}</p>
                </div>
              </div>
              </>}
              {(modDemip || modMaintenance) && (
              <div className="flex items-center gap-2 bg-white/15 rounded-lg px-3 py-2">
                <AlertTriangle className="w-4 h-4 text-orange-300" />
                <div>
                  <p className="text-[10px] text-blue-200 leading-none">Aktivní závady</p>
                  <p className={`text-xl font-bold leading-tight ${stats.issuesCount > 0 ? 'text-orange-300' : ''}`}>{stats.issuesCount}</p>
                </div>
              </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-screen-2xl mx-auto p-6 space-y-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="flex flex-wrap w-full bg-white shadow-md p-1 h-auto gap-1">
            <TabsTrigger value="overview" className="flex-1 min-w-[100px] gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-blue-700 data-[state=active]:text-white">Přehled</TabsTrigger>
            {hasDiagnostics && <TabsTrigger value="diagnostics" className="flex-1 min-w-[100px] gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-blue-700 data-[state=active]:text-white">
              <span className="hidden sm:inline">Technická diagnostika</span>
              <span className="sm:hidden">Tech. diag.</span>
            </TabsTrigger>}
            {modDemip && <TabsTrigger value="lubrication" className="flex-1 min-w-[100px] gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-blue-700 data-[state=active]:text-white">Mazání</TabsTrigger>}
            {modMaintenance && <>
            <TabsTrigger value="prevention" className="flex-1 min-w-[100px] gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-blue-700 data-[state=active]:text-white">
              <span className="hidden sm:inline">Plán preventivní údržby</span>
              <span className="sm:hidden">Prevence</span>
            </TabsTrigger>
            <TabsTrigger value="checklist" className="flex-1 min-w-[100px] gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-blue-700 data-[state=active]:text-white">
              <span className="hidden sm:inline">Seznam závad</span>
              <span className="sm:hidden">Závady</span>
            </TabsTrigger>
            </>}
          </TabsList>

          {/* Přehled */}
          <TabsContent value="overview" className="space-y-6">
             <div className="rounded-lg border border-border bg-card px-4 pb-3">
                {machines.map(machine => {
                  const machinePoints = controlPoints.filter(p => p.machine_id === machine.id);
                  const styles = getMachineStatusStyles(machine.id);
                  const status = styles.text.includes('red') ? 'critical' : styles.text.includes('orange') ? 'warning' : 'ok';
                  return <DashboardMachineRow key={machine.id} machine={machine} status={status}
                    pointCount={machinePoints.length} showPoints={modDemip} showIndicators
                    overdueCount={latestChecksLoading ? undefined : machinePoints.filter(point => ["warning", "critical"].includes(getPointStatus(point))).length}
                    issueCount={issueCounts ? (issueCounts[machine.id] || 0) : undefined} />;
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
                    {modThermo && machines.some(m => true) && (
                    <TabsTrigger 
                      value="thermo"
                      className="data-[state=active]:border-b-2 data-[state=active]:border-orange-500 data-[state=active]:shadow-none rounded-none px-0 py-2 bg-transparent"
                    >
                      <div className="flex items-center gap-2">
                        <Thermometer className="w-4 h-4" />
                        Termodiagnostika
                      </div>
                    </TabsTrigger>
                    )}
                    {modTribo && machines.some(m => true) && (
                    <TabsTrigger 
                      value="tribo"
                      className="data-[state=active]:border-b-2 data-[state=active]:border-purple-500 data-[state=active]:shadow-none rounded-none px-0 py-2 bg-transparent"
                    >
                      <div className="flex items-center gap-2">
                        <Droplet className="w-4 h-4" />
                        Tribodiagnostika
                      </div>
                    </TabsTrigger>
                    )}
                  </TabsList>

                  <TabsContent value="vibration" className="mt-0">
                    {machines.filter(m => m.vibration_schema_id).length === 0 ? (
                      <p className="text-center text-slate-500 py-8">Žádné stroje s aktivní vibrační diagnostikou</p>
                    ) : (
                      <div className="space-y-2">
                        {machines.filter(m => m.vibration_schema_id).map((machine) => {
                           const vibroBgText = getVibroBgText(machine.id);
                           return (
                             <div
                               key={machine.id}
                               className="flex items-center justify-between p-3 rounded-lg border hover:bg-slate-50 cursor-pointer transition-colors"
                               onClick={() => navigate(createPageUrl(`Machine?id=${machine.id}#vibration`))}
                             >
                               <div className="flex items-center gap-3">
                                 <div className={`p-2 rounded ${vibroBgText.bg} ${vibroBgText.text}`}>
                                   <Activity className="w-5 h-5" />
                                 </div>
                                 <div>
                                   <p className="font-medium text-slate-900">{formatMachineName(machine)}</p>
                                   <div className="flex gap-2 text-xs text-slate-500 items-center">
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
                    {machines.filter(m => true).length === 0 ? (
                      <p className="text-center text-slate-500 py-8">Žádné stroje/rozvaděče s aktivní termodiagnostikou</p>
                    ) : (
                      <div className="space-y-2">
                        {machines.filter(m => true).map((machine) => {
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
                                     <p className="font-medium text-slate-900">{formatMachineName(machine)}</p>
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
                    {machines.filter(m => true).length === 0 ? (
                      <p className="text-center text-slate-500 py-8">Žádné stroje s aktivní tribodiagnostikou</p>
                    ) : (
                      <div className="space-y-2">
                        {machines.filter(m => true).map((machine) => {
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
                                     <p className="font-medium text-slate-900">{formatMachineName(machine)}</p>
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
                  <span className="ml-2 text-sm font-normal text-slate-500">
                    ({lubricationMachines.length} strojů • {
                      controlPoints.filter(p => 
                        lubricationMachines.some(m => m.id === p.machine_id) && 
                        ['lubrication', 'inspection', 'auto_lubricator'].includes(p.type)
                      ).length
                    } bodů)
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {lubricationMachines.length === 0 ? (
                  <p className="text-center text-slate-500 py-8">Žádné stroje v kategorii mazání</p>
                ) : (
                  <div>
                    {lubricationMachines.map((machine) => {
                      const machinePoints = controlPoints.filter(p => p.machine_id === machine.id && ['lubrication', 'inspection', 'auto_lubricator'].includes(p.type));
                      const warningPoints = machinePoints.filter(p => getPointStatus(p) === "warning").length;
                      const criticalPoints = machinePoints.filter(p => getPointStatus(p) === "critical").length;
                      const status = criticalPoints > 0 ? "critical" : warningPoints > 0 ? "warning" : "ok";

                      let targetSubtab = "lubrication";
                      if (machinePoints.some(p => p.type === "lubrication")) targetSubtab = "lubrication";
                      else if (machinePoints.some(p => p.type === "inspection")) targetSubtab = "inspection";
                      else if (machinePoints.some(p => p.type === "auto_lubricator")) targetSubtab = "lubricators";

                      return (
                        <DashboardMachineRow key={machine.id} machine={machine} status={status}
                          pointCount={machinePoints.length}
                          targetUrl={`/Machine?id=${machine.id}&tab=control-points&subtab=${targetSubtab}`} />
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Plán preventivní údržby */}
          <TabsContent value="prevention" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ClipboardCheck className="w-5 h-5" />
                  Stroje - Plán preventivní údržby
                  <span className="ml-2 text-sm font-normal text-slate-500">
                    ({preventionMachines.length} strojů • {
                      controlPoints.filter(p => 
                        preventionMachines.some(m => m.id === p.machine_id) && 
                        p.type === 'prevention'
                      ).length
                    } bodů)
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {preventionMachines.length === 0 ? (
                  <p className="text-center text-slate-500 py-8">Žádné stroje s kontrolním bodem prevence</p>
                ) : (
                  <div>
                    {preventionMachines.map((machine) => {
                      const machinePoints = controlPoints.filter(p => p.machine_id === machine.id && p.type === 'prevention');
                      const warningPoints = machinePoints.filter(p => getPointStatus(p) === "warning").length;
                      const criticalPoints = machinePoints.filter(p => getPointStatus(p) === "critical").length;
                      const status = criticalPoints > 0 ? "critical" : warningPoints > 0 ? "warning" : "ok";
                      return (
                        <DashboardMachineRow key={machine.id} machine={machine} status={status}
                          pointCount={machinePoints.length}
                          targetUrl={`/Machine?id=${machine.id}&tab=control-points&subtab=prevention`} />
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>



          <TabsContent value="checklist" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckSquare className="w-5 h-5" />
                  Seznam závad
                </CardTitle>
              </CardHeader>
              <CardContent>
                {Object.keys(activeIssuesByYearAndDate).length === 0 ? (
                  <div className="text-center py-12">
                     <CheckSquare className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                     <p className="text-slate-500">Na této lince nejsou žádné aktivní závady</p>
                  </div>
                ) : (
                  <div className="space-y-8">
                    {Object.entries(activeIssuesByYearAndDate).sort((a, b) => b[0] - a[0]).map(([year, dates]) => (
                      <div key={year} className="space-y-4">
                        <h3 className="text-xl font-bold text-slate-800 border-b border-slate-200 pb-2">{year}</h3>
                        <div className="space-y-6">
                          {Object.entries(dates).sort((a, b) => new Date(b[0]) - new Date(a[0])).map(([dateKey, dayIssues]) => (
                            <div key={dateKey} className="ml-4 md:ml-0">
                              <h4 className="text-sm font-semibold text-slate-500 mb-2 flex items-center gap-2">
                                <Calendar className="w-4 h-4" />
                                {format(new Date(dateKey), "d. MMMM", { locale: cs })}
                              </h4>
                              <div className="space-y-1 md:space-y-0">
                                {dayIssues.map(issue => {
                                  const point = controlPoints.find(p => p.id === issue.control_point_id);
                                  const machine = machines.find(m => m.id === (issue.machine_id || point?.machine_id));
                                  return (
                                    <LineIssueRow key={issue.id} issue={issue}
                                      machineName={machine ? formatMachineName(machine) : "Neznámý stroj"}
                                      pointName={point?.name || "Závada stroje"}
                                      reporterName={getUserDisplayName(issue.created_by)}
                                      onOpen={() => navigate(createPageUrl(`IssueDetail?id=${issue.id}`))} />
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {hasMoreIssues && <Button variant="outline" className="mt-4" disabled={loadingMoreIssues} onClick={() => loadMoreIssues()}>
                  {loadingMoreIssues ? "Načítání…" : "Načíst další závady"}
                </Button>}
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