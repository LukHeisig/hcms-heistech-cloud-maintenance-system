import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
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

function StatusBadge({ lastSeen }) {
  if (!lastSeen) return <Badge variant="outline" className="text-slate-400 text-xs">Neznámý</Badge>;
  const diffH = (Date.now() - new Date(lastSeen).getTime()) / 3600000;
  if (diffH < 1) return <Badge className="bg-green-100 text-green-700 border-green-300 text-xs">Online</Badge>;
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
    ? "bg-yellow-500 shadow-[0_0_4px_1px_rgba(234,179,8,0.4)]"
    : "bg-red-600 shadow-[0_0_5px_2px_rgba(220,38,38,0.5)] animate-pulse";
  const title = level <= 1 ? "Vibrace OK" : level === 2 ? "Upozornění — pásmo C" : "Výstraha — pásmo D";
  return <div className={`${size} rounded-full flex-shrink-0 ${style}`} title={title} />;
}

export default function VibrationOnline() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const urlParams = new URLSearchParams(window.location.search);
  const [activeTab, setActiveTab] = useState(urlParams.get("tab") === "alerts" ? "alerts" : "sensors");
  const [search, setSearch] = useState("");
  const [expandedCompanies, setExpandedCompanies] = useState({});

  useEffect(() => {
    base44.auth.me().then(setUser);
  }, []);

  const { data: allCompanies = [] } = useQuery({
    queryKey: ["companies"],
    queryFn: () => base44.entities.Company.list("name", 1000),
    enabled: !!user,
    staleTime: 300000,
  });

  const { data: allLines = [] } = useQuery({
    queryKey: ["allLines"],
    queryFn: () => base44.entities.Line.list("order_index", 1000),
    staleTime: 300000,
  });

  const { data: allMachines = [], isLoading: isLoadingMachines } = useQuery({
    queryKey: ["allMachines"],
    queryFn: () => base44.entities.Machine.list("order_index", 1000),
    staleTime: 300000,
  });

  const { data: allSensors = [], isLoading: isLoadingSensors } = useQuery({
    queryKey: ["aissens_sensors"],
    queryFn: () => base44.entities.AissensSensor.list("-last_seen", 500),
    refetchInterval: 30000,
  });

  const { data: assignments = [] } = useQuery({
    queryKey: ["vibrationAssignments"],
    queryFn: () => base44.entities.VibrationSensorAssignment.list(null, 1000),
    staleTime: 60000,
  });

  // Všechna ID přiřazených senzorů (pro hromadné načtení dat)
  const allAssignedSensorIds = useMemo(() =>
    [...new Set(assignments.map(a => a.sensor_id).filter(Boolean))],
    [assignments]
  );

  // Normy pro výpočet pásem
  const { data: allStandards = [] } = useQuery({
    queryKey: ["vibrationStandards"],
    queryFn: () => base44.entities.VibrationStandard.list(null, 500),
    staleTime: 120000,
  });

  // Poslední SensorData s RMS hodnotami pro všechny přiřazené senzory
  const { data: latestSensorDataMap = {} } = useQuery({
    queryKey: ["vibrationOnlineLatestData", allAssignedSensorIds.join(",")],
    queryFn: async () => {
      if (allAssignedSensorIds.length === 0) return {};
      const results = {};
      await Promise.all(allAssignedSensorIds.map(async (sid) => {
        const recs = await base44.entities.SensorData.filter({ sensor_id: sid, has_fft: true }, "-created_date", 20);
        const latest = recs.find(r => r.vel_rms_x_mm_s != null);
        if (latest) results[sid] = latest;
      }));
      return results;
    },
    enabled: allAssignedSensorIds.length > 0,
    staleTime: 0,
    refetchInterval: 30000,
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
      m.monitor_vibration === true &&
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

  const isLoading = isLoadingMachines || isLoadingSensors || !user;

  const isSuperOrAdmin = user?.user_type === "superAdmin" || user?.user_type === "admin";

  // Počet aktivních alarmů pro badge
  const { data: activeAlerts = [] } = useQuery({
    queryKey: ["vibrationAlerts", "active"],
    queryFn: () => base44.entities.VibrationAlert.filter({ status: "active" }, null, 500),
    enabled: !!user,
    refetchInterval: 60000,
  });

  const alertBadge = useMemo(() => {
    const dCount = activeAlerts.filter(a => a.severity === "D").length;
    const cCount = activeAlerts.filter(a => a.severity === "C").length;
    const bCount = activeAlerts.filter(a => a.severity === "B").length;
    if (dCount > 0) return { count: dCount, label: "D", bg: "bg-red-600", text: "text-white", tabBg: "bg-red-50", tabText: "text-red-700" };
    if (cCount > 0) return { count: cCount, label: "C", bg: "bg-orange-500", text: "text-white", tabBg: "bg-orange-50", tabText: "text-orange-700" };
    if (bCount > 0) return { count: bCount, label: "B", bg: "bg-yellow-400", text: "text-slate-900", tabBg: "bg-yellow-50", tabText: "text-yellow-700" };
    return null;
  }, [activeAlerts]);

  return (
    <div className="p-4 md:p-8 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-xl">
              <Activity className="w-7 h-7 text-blue-600" />
            </div>
            Vibrace online
          </h1>
          <p className="text-slate-500 mt-1">Stroje s aktivním vibračním monitoringem a přiřazeným senzorem</p>
        </div>

        {/* Záložky */}
        <div className="flex gap-1 mb-6 bg-white rounded-xl border border-slate-200 p-1 w-fit">
          <button
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
              activeTab === "sensors" ? "bg-blue-600 text-white shadow" : "text-slate-600 hover:bg-slate-50"
            }`}
            onClick={() => setActiveTab("sensors")}
          >
            <Activity className="w-4 h-4" />
            Senzory
          </button>
          <button
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
              activeTab === "alerts"
                ? (alertBadge ? `${alertBadge.tabBg} ${alertBadge.tabText} shadow` : "bg-slate-100 text-slate-700 shadow")
                : "text-slate-600 hover:bg-slate-50"
            }`}
            onClick={() => setActiveTab("alerts")}
          >
            <Bell className="w-4 h-4" />
            Alarmy
            {alertBadge && (
              <span className={`flex items-center gap-1 text-xs font-bold px-1.5 py-0.5 rounded-full ${alertBadge.bg} ${alertBadge.text}`}>
                <span>Pásmo {alertBadge.label}</span>
                <span className="border-l border-white/40 pl-1">{alertBadge.count}</span>
              </span>
            )}
          </button>
        </div>

        {/* Panel alarmů */}
        {activeTab === "alerts" && (
          <Card className="border-none shadow-sm">
            <CardContent className="p-6">
              <VibrationAlertsPanel user={user} />
            </CardContent>
          </Card>
        )}

        {/* Panel senzorů */}
        {activeTab === "sensors" && <>
        {/* Vyhledávání + vysvětlivky */}
        <div className="flex items-start gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              className="pl-9"
              placeholder="Hledat stroj, linku nebo podnik..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-500 bg-white rounded-lg border border-slate-200 px-3 py-2 flex-shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold text-slate-400 uppercase">Stav:</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" /> OK</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-500" /> Upozornění</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-600" /> Výstraha</span>
            </div>
            <span className="w-px h-4 bg-slate-200" />
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold text-slate-400 uppercase">Senzor:</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded border-2 border-green-300" /> Online</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded border-2 border-yellow-300" /> Offline</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded border-2 border-slate-200" /> Bez senzoru</span>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-24 text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin mr-3" />
            Načítám data...
          </div>
        ) : grouped.length === 0 ? (
          <div className="text-center py-24">
            <WifiOff className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-700 mb-2">
              {search ? "Žádné výsledky" : "Žádné stroje s vibračním monitoringem"}
            </h3>
            <p className="text-slate-500 text-sm">
              {search
                ? "Zkuste jiné hledané slovo."
                : "Aktivujte modul vibrací a přiřaďte senzory ke strojům."}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {grouped.map(({ company, lines }) => {
              const isExpanded = expandedCompanies[company.id] ?? false;
              const totalMachines = lines.reduce((s, l) => s + l.machines.length, 0);
              const onlineCount = lines.reduce((s, l) => {
                return s + l.machines.filter(m => {
                  const sensor = getBestSensorForMachine(m.id);
                  if (!sensor?.last_seen) return false;
                  return (Date.now() - new Date(sensor.last_seen).getTime()) < 3600000;
                }).length;
              }, 0);

              return (
                <div key={company.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                  {/* Company header — vždy zobrazit, klikací pouze pro admin/superAdmin */}
                  <div
                    className={`flex items-center gap-4 p-4 ${isSuperOrAdmin ? "cursor-pointer hover:bg-slate-50" : ""} transition-colors`}
                    onClick={() => isSuperOrAdmin && toggleCompany(company.id)}
                  >
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow flex-shrink-0">
                      <Building2 className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h2 className="font-bold text-slate-900">{company.name}</h2>
                      <p className="text-sm text-slate-500">
                        {totalMachines} strojů · {onlineCount} online
                      </p>
                    </div>
                    {onlineCount > 0 && (
                      <Badge className="bg-green-100 text-green-700 border-green-300">{onlineCount} online</Badge>
                    )}
                    {isSuperOrAdmin && (
                      isExpanded
                        ? <ChevronUp className="w-5 h-5 text-slate-400 flex-shrink-0" />
                        : <ChevronDown className="w-5 h-5 text-slate-400 flex-shrink-0" />
                    )}
                  </div>

                  {/* Lines + Machines — vždy viditelné pro manager/technician, toggle pro admin */}
                  {(!isSuperOrAdmin || isExpanded) && (
                    <div className="border-t border-slate-100 divide-y divide-slate-50">
                      {lines.map(({ line, machines: lineMachines }) => (
                        <div key={line.id} className="p-4 bg-slate-50/60">
                          {/* Line label */}
                          <div className="flex items-center gap-2 mb-3">
                            <Factory className="w-4 h-4 text-slate-400" />
                            <span className="text-sm font-semibold text-slate-600">{line.name}</span>
                            <Badge variant="outline" className="text-xs ml-1">{lineMachines.length}</Badge>
                          </div>

                          {/* Machine cards */}
                          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                            {lineMachines.map(machine => {
                              const sensor = getBestSensorForMachine(machine.id);
                              const sensorCount = getSensorsForMachine(machine.id).length;
                              const diffH = sensor?.last_seen
                                ? (Date.now() - new Date(sensor.last_seen).getTime()) / 3600000
                                : null;
                              const isOnline = diffH != null && diffH < 1;
                              const borderColor = isOnline ? "border-green-200" : sensor ? "border-yellow-200" : "border-slate-200";
                              const alertLevel = getMachineAlertLevel(machine.id, assignments, allStandards, latestSensorDataMap);

                              return (
                                <div
                                  key={machine.id}
                                  onClick={() => navigate(createPageUrl(`Machine?id=${machine.id}#vibration`))}
                                  className={`bg-white rounded-xl border ${borderColor} p-3 cursor-pointer hover:shadow-md transition-all group`}
                                >
                                  <div className="flex items-start justify-between gap-2 mb-2">
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-1.5">
                                        <AlertDot level={alertLevel} />
                                        <p className="font-semibold text-slate-900 text-sm truncate group-hover:text-blue-700 transition-colors">
                                          {machine.name}
                                        </p>
                                      </div>
                                      {machine.location && (
                                        <p className="text-xs text-slate-400 truncate">{machine.location}</p>
                                      )}
                                    </div>
                                    <StatusBadge lastSeen={sensor?.last_seen} />
                                  </div>

                                  {sensor ? (
                                    <div className="space-y-1">
                                      <div className="flex items-center justify-between text-xs text-slate-500">
                                        <span className="flex items-center gap-1">
                                          <code className="text-blue-600 font-mono">{sensor.sensor_id}</code>
                                          {sensorCount > 1 && <span className="text-slate-400">+{sensorCount - 1}</span>}
                                        </span>
                                        {sensor.last_seen && (
                                          <span>{formatDistanceToNow(new Date(sensor.last_seen), { addSuffix: true, locale: cs })}</span>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-3">
                                        {sensor.last_battery_level != null && (
                                          <BatteryIcon level={sensor.last_battery_level} voltage={sensor.last_battery_voltage} />
                                        )}
                                        {sensor.last_temperature != null && (
                                          <span className="flex items-center gap-1 text-xs text-orange-500">
                                            <Thermometer className="w-3.5 h-3.5" />
                                            {sensor.last_temperature.toFixed(1)}°C
                                          </span>
                                        )}
                                        {sensor.last_signal_strength != null && (
                                          <span className="flex items-center gap-1 text-xs text-slate-400">
                                            <Signal className="w-3.5 h-3.5" />
                                            {sensor.last_signal_strength}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  ) : (
                                    <p className="text-xs text-slate-400">Senzor nepřiřazen</p>
                                  )}

                                  <div className="flex items-center justify-end mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <span className="text-xs text-blue-600 flex items-center gap-1">
                                      Otevřít <ChevronRight className="w-3 h-3" />
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        </>}
      </div>
    </div>
  );
}