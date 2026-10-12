import React, { useState, useEffect, useCallback, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useViewMode } from "@/components/ViewModeContext";
import {
  AlertTriangle,
  Droplet,
  ClipboardCheck,
  Wrench,
  Activity,
  ArrowRight,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Clock,
  ArrowLeft,
  Building2,
  Factory,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { cs } from "date-fns/locale";
import LineSelection from "../components/dashboard/LineSelection";
import MachineSelection from "../components/dashboard/MachineSelection";
import PointsList from "../components/dashboard/PointsList";
import ControlPointDetail from "../components/dashboard/ControlPointDetail";
import VibrationAlarmFrequencyChart from "../components/dashboard/VibrationAlarmFrequencyChart";
import { getEffectiveHoursSince, getNextDueDate } from "@/lib/intervalCalculations";
import { throttled } from "@/lib/requestQueue";
import { userHasModule } from "@/lib/companyModules";
import useVibrationDashboard from "@/hooks/useVibrationDashboard";
import VibrationKpiCards from "@/components/dashboard/VibrationKpiCards";
import VibrationLineMachines from "@/components/dashboard/VibrationLineMachines";
import RecentVibrationAlerts from "@/components/dashboard/RecentVibrationAlerts";
import ModuleDashboard from "@/components/dashboard/ModuleDashboard";
import DemipCompanySelection from "@/components/dashboard/DemipCompanySelection";

const formatInterval = (hours) => {
  if (!hours) return "-";
  if (hours % 730 === 0) {
    const months = hours / 730;
    return `${months} ${months === 1 ? 'měsíc' : months < 5 ? 'měsíce' : 'měsíců'}`;
  }
  if (hours % 168 === 0) {
    const weeks = hours / 168;
    return `${weeks} ${weeks === 1 ? 'týden' : weeks < 5 ? 'týdny' : 'týdnů'}`;
  }
  return `${hours} ${hours === 1 ? 'hodina' : hours < 5 ? 'hodiny' : 'hodin'}`;
};

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState("lubrication");
  const [expandedCompanies, setExpandedCompanies] = useState({});
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { viewMode } = useViewMode();
  const location = useLocation();

  const urlParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const selectedCompany = urlParams.get('company');
  const selectedLine = urlParams.get('line');
  const selectedMachine = urlParams.get('machine');

  const selectedPoint = urlParams.get('point');
  const nfcScanned = urlParams.get('nfc_scanned') === 'true';

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    const currentUser = await base44.auth.me();
    setUser(currentUser);
  };

  const { data: allCompanies = [], isLoading: isLoadingCompanies } = useQuery({
    queryKey: ["companies"],
    queryFn: () => throttled(() => base44.entities.Company.list("name", 1000)),
    enabled: user?.user_type === "admin" || user?.user_type === "superAdmin",
    staleTime: 300000,
  });

  const { data: userCompany, isLoading: isLoadingUserCompany } = useQuery({
    queryKey: ["userCompany", user?.company_id],
    queryFn: () => throttled(() => base44.entities.Company.filter({ id: user.company_id })).then(res => res[0]),
    enabled: !!user?.company_id && user?.user_type !== "admin" && user?.user_type !== "superAdmin",
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ["allUsers"],
    queryFn: async () => {
      const { data } = await throttled(() => base44.functions.invoke("getUsers"));
      return data;
    },
    staleTime: 600000, // 10 minutes
    gcTime: 900000, // 15 minutes
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

  const companies = React.useMemo(() => {
    if (!user) return [];
    if (user.user_type === "superAdmin") return allCompanies;
    if (user.user_type === "admin") {
      return allCompanies.filter(c =>
        user.assigned_company_ids?.includes(c.id)
      );
    }
    return [];
  }, [allCompanies, user]);

  const { data: lines = [], isLoading: isLoadingLines } = useQuery({
    queryKey: ["lines", user?.company_id],
    queryFn: () =>
      user?.company_id
        ? throttled(() => base44.entities.Line.filter({ company_id: user.company_id }, "order_index"))
        : [],
    enabled: !!user?.company_id && user?.user_type !== "admin" && user?.user_type !== "superAdmin",
  });

  const { data: allLines = [], isLoading: isLoadingAllLines } = useQuery({
    queryKey: ["allLines"],
    queryFn: () => throttled(() => base44.entities.Line.list("order_index", 1000)),
    staleTime: 300000,
  });

  const { data: allMachines = [], isLoading: isLoadingMachines } = useQuery({
    queryKey: ["allMachines"],
    queryFn: () => throttled(() => base44.entities.Machine.list("order_index", 1000)),
    enabled: !!user,
    staleTime: 300000,
  });

  // Filtrovat stroje podle company_id pro non-admin uživatele
  const machines = React.useMemo(() => {
    if (!user) return [];
    if (user.user_type === "admin" || user.user_type === "superAdmin") {
      return allMachines;
    }
    // Pro manager/technician vrátit pouze stroje z jejich podniku
    const userLineIds = lines.map(l => l.id);
    return allMachines.filter(m => userLineIds.includes(m.line_id));
  }, [user, allMachines, lines]);

  const { data: allControlPoints = [], isLoading: isLoadingControlPoints } = useQuery({
    queryKey: ["allControlPoints"],
    queryFn: () => throttled(() => base44.entities.ControlPoint.list("order_index", 1000)),
    enabled: !!user,
    staleTime: 300000,
  });

  // Filtrovat kontrolní body podle company_id pro non-admin uživatele
  const controlPoints = React.useMemo(() => {
    if (!user) return [];
    if (user.user_type === "admin" || user.user_type === "superAdmin") {
      return allControlPoints;
    }
    // Pro manager/technician vrátit pouze body z jejich strojů
    const userMachineIds = machines.map(m => m.id);
    return allControlPoints.filter(cp => userMachineIds.includes(cp.machine_id));
  }, [user, allControlPoints, machines]);

  const { data: allRecords = [] } = useQuery({
    queryKey: ["allRecords", user?.id],
    queryFn: () => throttled(() => base44.entities.ControlRecord.list("-performed_at", 5000)),
    enabled: !!user,
    staleTime: 300000,
  });

  const { data: selectedPointRecords = [] } = useQuery({
    queryKey: ["pointRecords", selectedPoint, user?.id],
    queryFn: () => throttled(() => base44.entities.ControlRecord.filter({ control_point_id: selectedPoint }, "-performed_at", 50)),
    enabled: !!selectedPoint,
  });

  // Filtrovat záznamy podle company_id pro non-admin uživatele
  const records = React.useMemo(() => {
    if (!user) return [];
    if (user.user_type === "admin" || user.user_type === "superAdmin") {
      return allRecords;
    }
    // Pro manager/technician vrátit pouze záznamy z jejich bodů
    const userPointIds = controlPoints.map(p => p.id);
    return allRecords.filter(r => userPointIds.includes(r.control_point_id));
  }, [user, allRecords, controlPoints]);

  const { data: allIssues = [] } = useQuery({
    queryKey: ["allIssues"],
    queryFn: () => throttled(() => base44.entities.Issue.filter({ status: "reported" }, null, 1000)),
    enabled: !!user,
    staleTime: 300000,
  });

  // Filtrovat závady podle company_id pro non-admin uživatele
  const issues = React.useMemo(() => {
    if (!user) return [];
    if (user.user_type === "admin" || user.user_type === "superAdmin") {
      return allIssues;
    }
    // Pro manager/technician vrátit pouze závady z jejich bodů
    const userPointIds = controlPoints.map(p => p.id);
    const userMachineIds = machines.map(m => m.id);
    return allIssues.filter(issue =>
      (issue.control_point_id && userPointIds.includes(issue.control_point_id)) ||
      (issue.machine_id && userMachineIds.includes(issue.machine_id))
    );
  }, [user, allIssues, controlPoints, machines]);

  const { data: documentation = [] } = useQuery({
    queryKey: ["documentation", selectedPoint],
    queryFn: () => throttled(() => base44.entities.Documentation.filter({ control_point_id: selectedPoint })),
    enabled: !!selectedPoint && viewMode === 'demip',
  });

  useEffect(() => {
    if (user && !user.company_id && user.user_type !== "admin" && user.user_type !== "superAdmin") {
      navigate(createPageUrl("PendingApproval"));
    }
  }, [user, navigate]);

  // Automaticky nastavit activeTab podle parametru v URL nebo maintenance_category stroje
  useEffect(() => {
    if (selectedMachine && allMachines.length > 0) {
      // Filtrovat body pro vybraný stroj
      const machinePoints = controlPoints.filter(p => p.machine_id === selectedMachine);
      
      const counts = {
        lubrication: machinePoints.filter(p => p.type === 'lubrication').length,
        inspection: machinePoints.filter(p => p.type === 'inspection').length,
        lubricator: machinePoints.filter(p => p.type === 'auto_lubricator').length,
        prevention: machinePoints.filter(p => p.type === 'prevention').length
      };

      const categoryParam = urlParams.get('category');
      
      // 1. Pokud je v URL kategorie a má data, použít ji
      if (categoryParam && counts[categoryParam] > 0) {
        setActiveTab(categoryParam);
        return;
      }

      // 2. Pokud URL kategorie nemá data (nebo není v URL), najít kategorii s nejvíce body
      const maxCategory = Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b);
      
      if (counts[maxCategory] > 0) {
         setActiveTab(maxCategory);
      } else {
         // 3. Fallback pokud nejsou žádné body
         if (categoryParam) {
            setActiveTab(categoryParam);
         } else {
            const machine = allMachines.find(m => m.id === selectedMachine);
            if (machine?.maintenance_category === "prevention") {
               setActiveTab("prevention");
            } else {
               setActiveTab("lubrication");
            }
         }
      }
    }
  }, [selectedMachine, allMachines, urlParams, controlPoints]);

  const getPointStatus = useCallback((point) => {
    const pointRecords = records
      .filter((r) => r.control_point_id === point.id)
      .sort((a, b) => new Date(b.performed_at) - new Date(a.performed_at));
    
    // Check company settings
    const machine = allMachines.find(m => m.id === point.machine_id);
    const line = allLines.find(l => l.id === machine?.line_id);
    const company = allCompanies.find(c => c.id === line?.company_id) || (line?.company_id === userCompany?.id ? userCompany : null);
    
    const vizType = company?.overdue_visualization_type || "two_colors";
    const tolerance = company?.overdue_tolerance_percent || 4;

    const interval = point.interval_hours || 0;

    let lastPerformed;
    if (pointRecords.length > 0 && point.first_confirmation_date) {
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
    const hoursSince = getEffectiveHoursSince(lastPerformed, now, line?.excluded_days);

    if (hoursSince <= interval) return "ok";
    
    if (vizType === "two_colors") {
        return "warning"; // Yellow for overdue
    } else {
        // traffic_light
        const overdueHours = hoursSince - interval;
        const minYellowHours = (company?.min_yellow_window_minutes || 0) / 60;
        
        // Minimum time window overrides percentage for short intervals
        if (overdueHours <= minYellowHours) {
            return "warning"; // Yellow: within minimum window
        }
        
        const overduePercent = (overdueHours / interval) * 100;
        if (overduePercent <= tolerance) {
            return "warning"; // Yellow: within percentage tolerance
        } else {
            return "critical"; // Red
        }
    }
  }, [records, allMachines, allLines, allCompanies, userCompany]);

  const getNextControlDate = useCallback((point, overrideRecords) => {
    // Prioritně použít overrideRecords (detailní pohled), jinak globální records
    const sourceRecords = overrideRecords || records;
    const pointRecords = sourceRecords
      .filter(r => r.control_point_id === point.id)
      .sort((a, b) => new Date(b.performed_at) - new Date(a.performed_at));
    if (!point.interval_hours) return null;

    let lastPerformed;
    if (pointRecords.length > 0) {
        // Máme záznamy - vzít nejnovější záznam (ignorujeme first_confirmation_date, protože záznamy mají vyšší prioritu)
        lastPerformed = new Date(pointRecords[0].performed_at);
    } else if (point.first_confirmation_date) {
        // Žádné záznamy, ale máme datum prvního potvrzení
        lastPerformed = new Date(point.first_confirmation_date);
    } else {
        // Nic nemáme - nezobrazovat
        return null;
    }

    const machine = allMachines.find(m => m.id === point.machine_id);
    const line = allLines.find(l => l.id === machine?.line_id);
    return getNextDueDate(lastPerformed, point.interval_hours, line?.excluded_days);
  }, [records, allMachines, allLines]);

  const activeCompanies = React.useMemo(() => {
    if (user?.user_type === "admin" || user?.user_type === "superAdmin") {
      return companies.filter(c =>
        c.is_active !== false &&
        !c.name.toLowerCase().includes('demo')
      );
    }
    return companies;
  }, [companies, user]);

  // Auto-expand if only one company
  useEffect(() => {
    if (activeCompanies && activeCompanies.length === 1 && !selectedCompany) {
      setExpandedCompanies({ [activeCompanies[0].id]: true });
    }
  }, [activeCompanies, selectedCompany]);

  const activeCompanyIds = React.useMemo(() => activeCompanies.map(c => c.id), [activeCompanies]);

  const totalLinesCount = React.useMemo(() => {
    if (user?.user_type === "admin" || user?.user_type === "superAdmin") {
      return allLines.filter(l => activeCompanyIds.includes(l.company_id)).length;
    }
    return lines.length;
  }, [user, allLines, lines, activeCompanyIds]);

  const activeControlPoints = React.useMemo(() => {
    if (user?.user_type === "admin" || user?.user_type === "superAdmin") {
      const activeLinesIds = allLines
        .filter(l => activeCompanyIds.includes(l.company_id))
        .map(l => l.id);
      const activeMachineIds = machines // This `machines` is the useMemo, which for admins is `allMachines`. Correct.
        .filter(m => activeLinesIds.includes(m.line_id))
        .map(m => m.id);
      return controlPoints.filter(cp => activeMachineIds.includes(cp.machine_id)); // This `controlPoints` is the useMemo, which for admins is `allControlPoints`. Correct.
    }
    return controlPoints;
  }, [user, allLines, machines, controlPoints, activeCompanyIds]);

  const overduePointsCount = React.useMemo(() => {
    return activeControlPoints.filter(
      (point) => {
          const status = getPointStatus(point);
          return status === "overdue" || status === "warning" || status === "critical";
      }
    ).length;
  }, [activeControlPoints, getPointStatus]);

  const activeRecords = React.useMemo(() => {
    if (user?.user_type === "admin" || user?.user_type === "superAdmin") {
      const activePointIds = activeControlPoints.map(p => p.id);
      return allRecords.filter(r => activePointIds.includes(r.control_point_id)); // Changed from records to allRecords, as records is now filtered.
    }
    return records;
  }, [user, records, activeControlPoints, allRecords]);

  const totalRecordsThisMonthCount = React.useMemo(() => {
    return activeRecords.filter((r) => {
      const date = new Date(r.performed_at);
      const now = new Date();
      return (
        date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()
      );
    }).length;
  }, [activeRecords]);

  const activeIssues = React.useMemo(() => {
    if (user?.user_type === "admin" || user?.user_type === "superAdmin") {
      const activePointIds = activeControlPoints.map(p => p.id);
      const activeMachineIds = machines
        .filter(m => {
          const line = allLines.find(l => l.id === m.line_id);
          return line && activeCompanyIds.includes(line.company_id);
        })
        .map(m => m.id);
      return allIssues.filter(issue => // Changed from issues to allIssues
        (issue.control_point_id && activePointIds.includes(issue.control_point_id)) ||
        (issue.machine_id && activeMachineIds.includes(issue.machine_id))
      );
    }
    return issues;
  }, [user, issues, activeControlPoints, allIssues, machines, allLines, activeCompanyIds]);



  const moduleCtx = { userCompany, adminCompanies: allCompanies };
  const modDemip = userHasModule(user, "enable_demip", moduleCtx);
  const modMaintenance = userHasModule(user, "enable_maintenance", moduleCtx);
  const modVibration = userHasModule(user, "enable_vibration", moduleCtx);
  const isCompanyUser = !!user && user.user_type !== "admin" && user.user_type !== "superAdmin";
  const vibMachineIds = useMemo(() => {
    if (isCompanyUser) return machines.map(m => m.id);
    const companyIds = activeCompanies.filter(c => c.enable_vibration === true).map(c => c.id);
    const lineIds = allLines.filter(l => companyIds.includes(l.company_id)).map(l => l.id);
    return machines.filter(m => lineIds.includes(m.line_id)).map(m => m.id);
  }, [machines, isCompanyUser, activeCompanies, allLines]);
  const vib = useVibrationDashboard(vibMachineIds, modVibration);
  const machinesLabel = (n) => `${n} ${n === 1 ? "stroj" : n >= 2 && n <= 4 ? "stroje" : "strojů"}`;

  const demipCompanies = (user?.user_type === "admin" || user?.user_type === "superAdmin")
    ? activeCompanies.filter(c => c.enable_demip === true)
    : [];

  const demipAllLines = (user?.user_type === "admin" || user?.user_type === "superAdmin")
    ? allLines
    : lines;

  const demipMachines = useMemo(() => machines, [machines]); // Use the useMemo 'machines' which is already filtered correctly by role.

  const demipControlPoints = (user?.user_type === "admin" || user?.user_type === "superAdmin")
    ? activeControlPoints
    : controlPoints; // Use the useMemo 'controlPoints' which is already filtered correctly by role.

  const demipIssues = (user?.user_type === "admin" || user?.user_type === "superAdmin")
    ? activeIssues
    : issues; // Use the useMemo 'issues' which is already filtered correctly by role.

  if (viewMode === 'demip') {
    if (selectedPoint) {
      const currentPoint = demipControlPoints.find(p => p.id === selectedPoint);
      const isDataLoading = isLoadingAllLines || isLoadingMachines || isLoadingControlPoints || (user?.user_type !== "admin" && user?.user_type !== "superAdmin" && isLoadingLines);
      if (!currentPoint) {
        if (isDataLoading) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;
        return <div className="p-8"><div className="bg-red-100 border-2 border-red-600 rounded-lg p-4"><h3 className="text-red-900 font-bold text-lg mb-2">❌ KONTROLNÍ BOD NENALEZEN</h3><p className="text-slate-600">Kontrolní bod s tímto ID nebyl nalezen.</p></div></div>;
      }
      const currentMachineForPoint = demipMachines.find(m => m.id === currentPoint.machine_id);
      const currentLineForPoint = demipAllLines.find(l => l.id === currentMachineForPoint?.line_id);
      const pointIssues = demipIssues.filter(i => i.control_point_id === selectedPoint);
      const status = getPointStatus(currentPoint);
      const nextDate = getNextControlDate(currentPoint, selectedPointRecords);
      const activeCompanySettings = (user?.user_type === "admin" || user?.user_type === "superAdmin")
        ? allCompanies.find(c => c.id === currentLineForPoint?.company_id)
        : userCompany;
      return (
        <ControlPointDetail
          currentPoint={currentPoint}
          currentMachineForPoint={currentMachineForPoint}
          currentLineForPoint={currentLineForPoint}
          selectedPointRecords={selectedPointRecords}
          pointIssues={pointIssues}
          documentation={documentation}
          status={status}
          nextDate={nextDate}
          user={user}
          selectedPoint={selectedPoint}
          selectedCompany={selectedCompany}
          selectedLine={selectedLine}
          selectedMachine={selectedMachine}
          activeTab={activeTab}
          nfcScanned={nfcScanned}
          activeCompanySettings={activeCompanySettings}
          getUserDisplayName={getUserDisplayName}
          urlParams={urlParams}
        />
      );
    }
  }

        if (viewMode === 'demip') {
    if (!user) return <div className="flex min-h-64 items-center justify-center" role="status" aria-label="Načítání"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

    const companyId = selectedCompany || user?.company_id;
    const currentCompany = allCompanies.find(c => c.id === companyId);
    const companyLines = demipAllLines.filter(l => l.company_id === companyId);

    const currentLine = demipAllLines.find(l => l.id === selectedLine);
    const lineMachines = demipMachines.filter(m => m.line_id === selectedLine);

    const currentMachine = demipMachines.find(m => m.id === selectedMachine);
    const machinePoints = demipControlPoints.filter(p => p.machine_id === selectedMachine);

    return (
      <div className="relative">
        <div className="p-4 md:p-8 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
          {((user?.user_type === "admin" || user?.user_type === "superAdmin") && !selectedCompany) && (
            <DemipCompanySelection
              companies={demipCompanies}
              lines={demipAllLines}
              machines={demipMachines}
              loading={isLoadingCompanies || isLoadingAllLines || isLoadingMachines}
            />
          )}

          {(!selectedLine && !(user?.user_type === "admin" || user?.user_type === "superAdmin")) && (
            <LineSelection
              user={user}
              selectedCompany={selectedCompany}
              currentCompany={currentCompany}
              companyLines={companyLines}
              demipMachines={demipMachines}
              demipControlPoints={demipControlPoints}
              getPointStatus={getPointStatus}
            />
          )}

          {((user?.user_type === "admin" || user?.user_type === "superAdmin") && selectedCompany && !selectedLine) && (
            <LineSelection
              user={user}
              selectedCompany={selectedCompany}
              currentCompany={currentCompany}
              companyLines={companyLines}
              demipMachines={demipMachines}
              demipControlPoints={demipControlPoints}
              getPointStatus={getPointStatus}
            />
          )}

          {(selectedLine && !selectedMachine) && (
            <MachineSelection
              selectedCompany={selectedCompany}
              selectedLine={selectedLine}
              currentLine={currentLine}
              lineMachines={lineMachines}
              demipControlPoints={demipControlPoints}
              getPointStatus={getPointStatus}
            />
          )}

          {(selectedMachine && !selectedPoint) && (
            <PointsList
              selectedCompany={selectedCompany}
              selectedLine={selectedLine}
              selectedMachine={selectedMachine}
              currentLine={currentLine}
              currentMachine={currentMachine}
              machinePoints={machinePoints}
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              records={records}
              demipIssues={demipIssues}
              getPointStatus={getPointStatus}
              getNextControlDate={getNextControlDate}
            />
          )}
        </div>


      </div>
      );
      }

  if (viewMode === 'maintenance' || viewMode === 'demip') {
    const admin = user?.user_type === "admin" || user?.user_type === "superAdmin";
    const visibleCompanies = admin ? activeCompanies : userCompany ? [userCompany] : [];
    const visibleLines = admin ? allLines.filter(line => activeCompanyIds.includes(line.company_id)) : lines;
    const vibrationCompanies = visibleCompanies.filter(company => company.enable_vibration === true);
    const vibrationLines = visibleLines.filter(line => vibrationCompanies.some(company => company.id === line.company_id));
    const vibrationMachines = machines.filter(machine => vibrationLines.some(line => line.id === machine.line_id));
    return <ModuleDashboard
      demipEnabled={modDemip} vibrationEnabled={modVibration}
      loading={!user || (admin ? isLoadingCompanies : isLoadingUserCompany)}
      description={admin ? user?.user_type === "superAdmin" ? "Přehled všech podniků v systému" : `Přehled vašich ${activeCompanies.length} přiřazených podniků` : userCompany?.name || "Přehled podniku"}
      demip={{
        companies: visibleCompanies.filter(company => company.enable_demip === true), lines: visibleLines,
        machines, points: admin ? activeControlPoints : controlPoints,
        records: admin ? activeRecords : records, issues: user?.user_type === "technician" ? [] : admin ? activeIssues : issues,
        getPointStatus, getUserDisplayName, overdue: overduePointsCount, monthlyRecords: totalRecordsThisMonthCount,
        admin, superAdmin: user?.user_type === "superAdmin", loading: isLoadingAllLines || isLoadingLines || isLoadingMachines || isLoadingControlPoints,
      }}
      vibration={{ user, companies: vibrationCompanies, lines: vibrationLines, machines: vibrationMachines, vib, loading: isLoadingMachines || isLoadingAllLines || isLoadingLines }}
    />;
  }

  return <div className="p-8">Dashboard - DEMIP režim je ve vývoji</div>;
}