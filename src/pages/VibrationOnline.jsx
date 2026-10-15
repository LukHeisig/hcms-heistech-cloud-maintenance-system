import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { moduleData } from "@/lib/moduleData";
import { useAuth } from "@/lib/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { formatMachineName } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Activity,
  Building2,
  Factory,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Search,
  Wifi,
  WifiOff,
  Thermometer,
  Battery,
  BatteryLow,
  BatteryMedium,
  BatteryFull,
  Loader2,
  Signal,
  Bell,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { cs } from "date-fns/locale";
import VibrationAlertsPanel from "@/components/vibration/VibrationAlertsPanel";
import VibrationServiceBoard from "@/components/vibration/VibrationServiceBoard";

function StatusBadge({ lastSeen }) {
  if (!lastSeen) return <Badge variant="outline" className="text-slate-400 text-xs">Neznámý</Badge>;
  const diffH = (Date.now() - new Date(lastSeen).getTime()) / 3600000;
  if (diffH < 12) return <Badge className="bg-green-100 text-green-700 border-green-300 text-xs">Online</Badge>;
  if (diffH < 24) return <Badge className="bg-yellow-100 text-yellow-700 border-yellow-300 text-xs">Nedávno</Badge>;
  return <Badge className="bg-red-100 text-red-600 border-red-200 text-xs">Offline</Badge>;
}

function BatteryIcon({ level, voltage }) {
  const color = level <= 1 ? "text-red-500" : level <= 2 ? "text-yellow-500" : "text-green-500";
  const Icon = level <= 1 ? BatteryLow : level <= 2 ? BatteryMedium : BatteryFull;
  return (
    <span className={`flex items-center gap-1 text-xs ${color}`}>
      <Icon className="w-3.5 h-3.5" />
      {voltage != null ? `${voltage}V` : `L${level}`}
    </span>
  );
}

// Pomocná funkce pro výpočet pásma limitu (0=A, 1=B, 2=C, 3=D, -1=bez dat/normy)
function getLimitLevel(value, limitA, limitB, limitC) {
  if (value == null || limitA == null) return -1;
  if (value < limitA) return 0;
  if (value < limitB) return 1;
  if (value < limitC) return 2;
  return 3;
}

// Vypočítá globální vibrační stav stroje — nejhorší pásmo napříč všemi senzory
function getMachineAlertLevel(machineId, assignments, allStandards, latestSensorDataMap) {
  const machineAssignments = assignments.filter(a => a.machine_id === machineId && a.sensor_id);
  if (machineAssignments.length === 0) return -1;

  const levels = [];
  for (const a of machineAssignments) {
    const velStd = allStandards.find(s => s.id === a.vel_standard_id);
    const accStd = allStandards.find(s => s.id === a.acc_standard_id);
    const latest = latestSensorDataMap[a.sensor_id];
    if (!latest || (!velStd && !accStd)) continue;

    const rowLevels = [
      getLimitLevel(latest.vel_rms_x_mm_s, velStd?.limit_ab, velStd?.limit_bc, velStd?.limit_cd),
      getLimitLevel(latest.vel_rms_y_mm_s, velStd?.limit_ab, velStd?.limit_bc, velStd?.limit_cd),
      getLimitLevel(latest.vel_rms_z_mm_s, velStd?.limit_ab, velStd?.limit_bc, velStd?.limit_cd),
      getLimitLevel(latest.rms_z_g ?? latest.oa_acc_z, accStd?.acc_limit_ab, accStd?.acc_limit_bc, accStd?.acc_limit_cd),
      getLimitLevel(latest.env_rms_z, accStd?.acc_limit_ab, accStd?.acc_limit_bc, accStd?.acc_limit_cd),
    ].filter(l => l >= 0);

    if (rowLevels.length > 0) levels.push(Math.max(...rowLevels));
  }

  return levels.length > 0 ? Math.max(...levels) : -1;
}

// Semafor puntík pro globální stav stroje
function AlertDot({ level, size = "w-2.5 h-2.5" }) {
  if (level < 0) return null;
  const style = level <= 1
    ? "bg-green-500 shadow-[0_0_4px_1px_rgba(34,197,94,0.3)]"
    : level === 2
    ? "bg-orange-500 shadow-[0_0_4px_1px_rgba(249,115,22,0.4)]"
    : "bg-red-600 shadow-[0_0_5px_2px_rgba(220,38,38,0.5)] animate-pulse";
  const title = level <= 1 ? "Vibrace OK" : level === 2 ? "Upozornění — pásmo C" : "Výstraha — pásmo D";
  return <div className={`${size} rounded-full flex-shrink-0 ${style}`} title={title} />;
}

export default function VibrationOnline() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const urlParams = new URLSearchParams(window.location.search);
  const [activeTab, setActiveTab] = useState(urlParams.get("tab") === "alerts" ? "alerts" : "sensors");
  const [search, setSearch] = useState("");
  const [expandedCompanies, setExpandedCompanies] = useState({});

  const { data: allCompanies = [], isPending: loadingCompanies, error: companiesError } = useQuery({
    queryKey: ["companies"],
    queryFn: () => base44.entities.Company.list("name", 1000),
    enabled: !!user,
    staleTime: 300000,
  });

  const { data: allLines = [], isPending: loadingLines, error: linesError } = useQuery({
    queryKey: ["allLines"],
    queryFn: () => base44.entities.Line.list("order_index", 1000),
    enabled: !!user,
    staleTime: 300000,
  });

  const { data: allMachines = [], isPending: isLoadingMachines, error: machinesError } = useQuery({
    queryKey: ["allMachines"],
    queryFn: () => base44.entities.Machine.list("order_index", 1000),
    enabled: !!user,
    staleTime: 300000,
  });

  const { data: allSensors = [], isPending: isLoadingSensors, error: sensorsError } = useQuery({
    queryKey: ["aissens_sensors"],
    queryFn: () => moduleData.list("AissensSensor", "-last_seen", 500),
    enabled: !!user,
    staleTime: 30000,
    refetchInterval: activeTab === "sensors" ? 30000 : false,
  });

  const { data: assignments = [], isPending: loadingAssignments, error: assignmentsError } = useQuery({
    queryKey: ["vibrationAssignments"],
    queryFn: () => moduleData.list("VibrationSensorAssignment", null, 1000),
    enabled: !!user,
    staleTime: 300000,
  });

  // Všechna ID přiřazených senzorů (pro hromadné načtení dat)
  const allAssignedSensorIds = useMemo(() =>
    [...new Set(assignments.map(a => a.sensor_id).filter(Boolean))],
    [assignments]
  );

  // Normy pro výpočet pásem
  const { data: allStandards = [] } = useQuery({
    queryKey: ["vibStandards"],
    queryFn: () => base44.entities.VibrationStandard.list(null, 500),
    enabled: !!user && activeTab === "sensors",
    staleTime: 600000,
  });

  // Poslední SensorData s RMS hodnotami pro všechny přiřazené senzory
  const { data: latestSensorDataMap = {} } = useQuery({
    queryKey: ["vibrationOnlineLatestData", allAssignedSensorIds.join(",")],
    queryFn: async () => {
      if (allAssignedSensorIds.length === 0) return {};
      return moduleData.latestSensorData(allAssignedSensorIds, [
        "sensor_id", "vel_rms_x_mm_s", "vel_rms_y_mm_s", "vel_rms_z_mm_s",
        "rms_z_g", "oa_acc_z", "env_rms_z", "timestamp_unix", "recorded_at",
      ]);
    },
    enabled: !!user && activeTab === "sensors" && allAssignedSensorIds.length > 0,
    staleTime: 30000,
    refetchInterval: activeTab === "sensors" ? 30000 : false,
  });

  // Určit viditelné společnosti dle role
  const visibleCompanies = useMemo(() => {
    if (!user || !allCompanies.length) return [];
    if (user.user_type === "superAdmin") return allCompanies.filter(c => c.is_active !== false);
    if (user.user_type === "admin") return allCompanies.filter(c => user.assigned_company_ids?.includes(c.id) && c.is_active !== false);
    // manager / technician — company_id
    return allCompanies.filter(c => c.id === user.company_id && c.is_active !== false);
  }, [user, allCompanies]);

  // Viditelné linky (dle viditelných podniků)
  const visibleCompanyIds = useMemo(() => visibleCompanies.map(c => c.id), [visibleCompanies]);

  const visibleLines = useMemo(() =>
    allLines.filter(l => visibleCompanyIds.includes(l.company_id)),
    [allLines, visibleCompanyIds]
  );

  const visibleLineIds = useMemo(() => visibleLines.map(l => l.id), [visibleLines]);

  // Viditelné stroje s aktivní vibrací a namapovaným senzorem
  // Podmínky: monitor_vibration = true, má VibrationSensorAssignment nebo sensor_id
  const assignedMachineIds = useMemo(() =>
    new Set(assignments.map(a => a.machine_id)),
    [assignments]
  );

  const vibrationMachines = useMemo(() => {
    return allMachines.filter(m =>
      visibleLineIds.includes(m.line_id) &&
      assignedMachineIds.has(m.id)
    );
  }, [allMachines, visibleLineIds, assignedMachineIds]);

  // Najít senzory pro stroj (přes VibrationSensorAssignment)
  // assignment.sensor_id je AissensSensor.id (databázové ID záznamu)
  const getSensorsForMachine = (machineId) => {
    const machineAssignments = assignments.filter(a => a.machine_id === machineId && a.sensor_id);
    return machineAssignments
      .map(a => allSensors.find(s => s.id === a.sensor_id || s.sensor_id === a.sensor_id))
      .filter(Boolean);
  };

  // Vrátit nejaktivnější senzor (s nejnovějším last_seen) pro zobrazení stavu
  const getBestSensorForMachine = (machineId) => {
    const sensors = getSensorsForMachine(machineId);
    if (!sensors.length) return null;
    return sensors.sort((a, b) => {
      const ta = a.last_seen ? new Date(a.last_seen).getTime() : 0;
      const tb = b.last_seen ? new Date(b.last_seen).getTime() : 0;
      return tb - ta;
    })[0];
  };

  // Filtrování dle vyhledávání
  const filteredMachines = useMemo(() => {
    if (!search.trim()) return vibrationMachines;
    const q = search.toLowerCase();
    return vibrationMachines.filter(m => {
      const line = allLines.find(l => l.id === m.line_id);
      const company = allCompanies.find(c => c.id === line?.company_id);
      return (
        m.name.toLowerCase().includes(q) ||
        line?.name.toLowerCase().includes(q) ||
        company?.name.toLowerCase().includes(q)
      );
    });
  }, [vibrationMachines, search, allLines, allCompanies]);

  // Seskupení: podnik → linka → stroje
  const grouped = useMemo(() => {
    const result = [];
    for (const company of visibleCompanies) {
      const companyLines = visibleLines
        .filter(l => l.company_id === company.id)
        .sort((a, b) => (a.order_index || 0) - (b.order_index || 0));

      const linesWithMachines = companyLines
        .map(line => {
          const lineMachines = filteredMachines
            .filter(m => m.line_id === line.id)
            .sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
          return { line, machines: lineMachines };
        })
        .filter(lw => lw.machines.length > 0);

      if (linesWithMachines.length > 0) {
        result.push({ company, lines: linesWithMachines });
      }
    }
    return result;
  }, [visibleCompanies, visibleLines, filteredMachines]);

  // Auto-expand pokud jen jedna firma
  useEffect(() => {
    if (grouped.length === 1) {
      setExpandedCompanies({ [grouped[0].company.id]: true });
    }
  }, [grouped.length]);

  const toggleCompany = (id) => {
    setExpandedCompanies(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const loadError = companiesError || linesError || machinesError || sensorsError || assignmentsError;
  const isLoading = !user || loadingCompanies || loadingLines || isLoadingMachines || isLoadingSensors || loadingAssignments;

  const isSuperOrAdmin = user?.user_type === "superAdmin" || user?.user_type === "admin";

  // Počet aktivních alarmů pro badge
  const { data: activeAlerts = [] } = useQuery({
    queryKey: ["vibrationAlerts", "active"],
    queryFn: () => moduleData.filter("VibrationAlert", { status: "active" }, null, 500),
    enabled: !!user,
    staleTime: 60000,
    refetchInterval: 60000,
  });

  // Množina ID strojů, které smí uživatel vidět (null = superAdmin, bez omezení)
  const visibleMachineIdSet = useMemo(() => {
    if (user?.user_type === "superAdmin") return null;
    return new Set(allMachines.filter(m => visibleLineIds.includes(m.line_id)).map(m => m.id));
  }, [user, allMachines, visibleLineIds]);

  const visibleActiveAlerts = useMemo(() =>
    visibleMachineIdSet === null
      ? activeAlerts
      : activeAlerts.filter(a => visibleMachineIdSet.has(a.machine_id)),
    [activeAlerts, visibleMachineIdSet]
  );

  const alertBadge = useMemo(() => {
    const dCount = visibleActiveAlerts.filter(a => a.severity === "D").length;
    const cCount = visibleActiveAlerts.filter(a => a.severity === "C").length;
    const bCount = visibleActiveAlerts.filter(a => a.severity === "B").length;
    if (dCount > 0) return { count: dCount, label: "D", bg: "bg-red-600", text: "text-white", tabBg: "bg-red-50", tabText: "text-red-700" };
    if (cCount > 0) return { count: cCount, label: "C", bg: "bg-orange-500", text: "text-white", tabBg: "bg-orange-50", tabText: "text-orange-700" };
    if (bCount > 0) return { count: bCount, label: "B", bg: "bg-yellow-400", text: "text-slate-900", tabBg: "bg-yellow-50", tabText: "text-yellow-700" };
    return null;
  }, [visibleActiveAlerts]);

  return <VibrationServiceBoard
    user={user} search={search} setSearch={setSearch} activeTab={activeTab} setActiveTab={setActiveTab}
    alertBadge={alertBadge} isLoading={isLoading} loadError={loadError} grouped={grouped}
    visibleMachineIdSet={visibleMachineIdSet} expandedCompanies={expandedCompanies}
    isSuperOrAdmin={isSuperOrAdmin} toggleCompany={toggleCompany}
    getSensorsForMachine={getSensorsForMachine} getBestSensorForMachine={getBestSensorForMachine}
    assignments={assignments} allStandards={allStandards} latestSensorDataMap={latestSensorDataMap}
    getLimitLevel={getLimitLevel} openMachine={id => navigate(createPageUrl(`Machine?id=${id}#vibration`))}
  />;
}