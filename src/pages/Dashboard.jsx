import React, { useState, useEffect, useCallback, useMemo } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
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

  // Auto-expand if only one company
  useEffect(() => {
    if (companies && companies.length === 1 && !selectedCompany) {
      setExpandedCompanies({ [companies[0].id]: true });
    }
  }, [companies, selectedCompany]);

  const loadUser = async () => {
    const currentUser = await base44.auth.me();
    setUser(currentUser);
  };

  const { data: allCompanies = [] } = useQuery({
    queryKey: ["companies"],
    queryFn: () => base44.entities.Company.list("name", 1000),
    enabled: user?.user_type === "admin" || user?.user_type === "superAdmin",
  });

  const { data: userCompany } = useQuery({
    queryKey: ["userCompany", user?.company_id],
    queryFn: () => base44.entities.Company.filter({ id: user.company_id }).then(res => res[0]),
    enabled: !!user?.company_id && user?.user_type !== "admin" && user?.user_type !== "superAdmin",
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
        ? base44.entities.Line.filter({ company_id: user.company_id }, "order_index")
        : [],
    enabled: !!user?.company_id && user?.user_type !== "admin" && user?.user_type !== "superAdmin",
  });

  const { data: allLines = [], isLoading: isLoadingAllLines } = useQuery({
    queryKey: ["allLines"],
    queryFn: () => base44.entities.Line.list("order_index", 1000),
    staleTime: 300000,
  });

  const { data: allMachines = [], isLoading: isLoadingMachines } = useQuery({
    queryKey: ["allMachines"],
    queryFn: () => base44.entities.Machine.list("order_index", 1000),
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
    queryFn: () => base44.entities.ControlPoint.list("order_index", 1000),
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
    queryFn: () => base44.entities.ControlRecord.list("-performed_at", 5000),
    enabled: !!user,
    staleTime: 300000,
  });

  const { data: selectedPointRecords = [] } = useQuery({
    queryKey: ["pointRecords", selectedPoint, user?.id],
    queryFn: () => base44.entities.ControlRecord.filter({ control_point_id: selectedPoint }, "-performed_at", 50),
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
    queryFn: () => base44.entities.Issue.filter({ status: "reported" }, null, 1000),
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
    queryFn: () => base44.entities.Documentation.filter({ control_point_id: selectedPoint }),
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
    const hoursSince = (now - lastPerformed) / (1000 * 60 * 60);

    if (hoursSince <= interval) return "ok";
    
    if (vizType === "two_colors") {
        return "warning"; // Yellow for overdue
    } else {
        // traffic_light
        const overduePercent = ((hoursSince - interval) / interval) * 100;
        if (overduePercent <= tolerance) {
            return "warning"; // Yellow
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

    const nextDate = new Date(lastPerformed.getTime() + point.interval_hours * 60 * 60 * 1000);
    return nextDate;
  }, [records]);

  const activeCompanies = React.useMemo(() => {
    if (user?.user_type === "admin" || user?.user_type === "superAdmin") {
      return companies.filter(c =>
        c.is_active !== false &&
        !c.name.toLowerCase().includes('demo')
      );
    }
    return companies;
  }, [companies, user]);

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



  const demipCompanies = (user?.user_type === "admin" || user?.user_type === "superAdmin")
    ? activeCompanies
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
            <div className="max-w-4xl mx-auto">
              <h1 className="text-3xl font-bold text-slate-900 mb-6">Výběr podniku - DEMIP</h1>
              <div className="space-y-2">
                {demipCompanies.map((company) => {
                  const companyLines = demipAllLines.filter(l => l.company_id === company.id);
                  const companyLineIds = companyLines.map(l => l.id);
                  const companyMachines = demipMachines.filter(m => companyLineIds.includes(m.line_id));
                  const companyMachineIds = companyMachines.map(m => m.id);
                  const companyPoints = demipControlPoints.filter(p => companyMachineIds.includes(p.machine_id));
                  const companyOverdue = companyPoints.filter(p => getPointStatus(p) === "overdue").length;

                  return (
                    <div
                      key={company.id}
                      className="group relative bg-white rounded-2xl p-4 shadow-sm border border-slate-100 active:scale-[0.98] transition-all cursor-pointer"
                      onClick={() => navigate(createPageUrl(`Dashboard?company=${company.id}`))}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-blue-200 shadow-lg text-white">
                          <Building2 className="w-6 h-6" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-center mb-1">
                            <h3 className="font-bold text-slate-900 text-lg">{company.name}</h3>
                            {companyOverdue > 0 && (
                              <div className="flex items-center justify-center px-2 py-1 bg-red-100 rounded-full">
                                <span className="text-xs font-bold text-red-600">{companyOverdue} !</span>
                              </div>
                            )}
                          </div>
                          <p className="text-sm text-slate-500 font-medium">
                            {companyLines.length} linek • {companyPoints.length} bodů
                          </p>
                        </div>
                        <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-slate-500 transition-colors" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
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

      if (viewMode === 'maintenance') {
    if (user?.user_type === "admin" || user?.user_type === "superAdmin") {
      return (
        <div className="p-4 md:p-8 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
          <div className="max-w-7xl mx-auto">
            <div className="mb-8">
              <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2">Dashboard</h1>
              <p className="text-slate-600">
                {user?.user_type === "superAdmin"
                  ? "Přehled všech podniků v systému"
                  : `Přehled vašich ${activeCompanies.length} přiřazených podniků`}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-8">
              <Card className="border-none shadow-lg bg-gradient-to-br from-blue-500 to-blue-600 text-white hover:shadow-xl transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-blue-100 text-sm font-medium mb-1">Aktivní podniky</p>
                      <p className="text-4xl font-bold">{activeCompanies.length}</p>
                    </div>
                    <div className="p-3 bg-white/20 rounded-xl">
                      <Wrench className="w-6 h-6" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-none shadow-lg bg-gradient-to-br from-purple-500 to-purple-600 text-white hover:shadow-xl transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-purple-100 text-sm font-medium mb-1">Celkem linek</p>
                      <p className="text-4xl font-bold">{totalLinesCount}</p>
                    </div>
                    <div className="p-3 bg-white/20 rounded-xl">
                      <Activity className="w-6 h-6" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-none shadow-lg bg-gradient-to-br from-red-500 to-red-600 text-white hover:shadow-xl transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-red-100 text-sm font-medium mb-1">Po termínu</p>
                      <p className="text-4xl font-bold">{overduePointsCount}</p>
                    </div>
                    <div className="p-3 bg-white/20 rounded-xl">
                      <AlertTriangle className="w-6 h-6" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-none shadow-lg bg-gradient-to-br from-green-500 to-green-600 text-white hover:shadow-xl transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-green-100 text-sm font-medium mb-1">Záznamů tento měsíc</p>
                      <p className="text-4xl font-bold">{totalRecordsThisMonthCount}</p>
                    </div>
                    <div className="p-3 bg-white/20 rounded-xl">
                      <ClipboardCheck className="w-6 h-6" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <Card className="border-none shadow-lg">
                  <CardHeader className="border-b border-slate-100">
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2 text-xl">
                        <Activity className="w-5 h-5 text-slate-600" />
                        Přehled výroby - Linky
                      </CardTitle>
                      {user?.user_type === "superAdmin" && (
                        <Button
                          onClick={() => navigate(createPageUrl("Admin"))}
                          size="sm"
                          variant="outline"
                        >
                          <ArrowRight className="w-4 h-4 mr-2" />
                          Správa struktury
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="p-6">
                    {activeCompanies.length === 0 ? (
                      <div className="text-center py-12">
                        <Factory className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-slate-900 mb-2">
                          {user?.user_type === "superAdmin"
                            ? "Zatím nemáte žádné aktivní podniky"
                            : "Nemáte přiřazené žádné aktivní podniky"}
                        </h3>
                        <p className="text-slate-500 mb-6">
                          {user?.user_type === "superAdmin"
                            ? "Začněte vytvořením prvního podniku"
                            : "Kontaktujte superAdmina pro přiřazení podniků"}
                        </p>
                        {user?.user_type === "superAdmin" && (
                          <Button
                            onClick={() => navigate(createPageUrl("Admin"))}
                            className="bg-gradient-to-r from-red-600 to-red-700"
                          >
                            <ArrowRight className="w-4 h-4 mr-2" />
                            Správa struktury
                          </Button>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {activeCompanies.map((company) => {
                          const companyLines = allLines
                            .filter((l) => l.company_id === company.id)
                            .sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
                          const companyMachines = allMachines.filter((m) =>
                            companyLines.some((l) => l.id === m.line_id)
                          );
                          const companyPoints = allControlPoints.filter((point) =>
                            companyMachines.some((m) => m.id === point.machine_id)
                          );
                          const companyOverdue = companyPoints.filter(
                            (point) => getPointStatus(point) === "overdue"
                          ).length;
                          const companyIssues = allIssues.filter((issue) =>
                            companyPoints.some((point) => point.id === issue.control_point_id)
                          ).length;

                          const isExpanded = expandedCompanies[company.id] || false;

                          return (
                            <div key={company.id} className="space-y-3">
                              <div 
                                className="flex items-center justify-between cursor-pointer"
                                onClick={() => setExpandedCompanies(prev => ({
                                  ...prev,
                                  [company.id]: !prev[company.id]
                                }))}
                              >
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 bg-gradient-to-br from-red-600 to-red-700 rounded-lg flex items-center justify-center shadow-lg flex-shrink-0">
                                    <Building2 className="w-5 h-5 text-white" />
                                  </div>
                                  <div>
                                    <h3 className="text-lg font-bold text-slate-900">{company.name}</h3>
                                    <p className="text-sm text-slate-600">{companyLines.length} linek</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      navigate(createPageUrl(`Admin`));
                                    }}
                                    size="sm"
                                    variant="ghost"
                                  >
                                    Spravovat
                                  </Button>
                                  {isExpanded ? (
                                    <ChevronUp className="w-5 h-5 text-slate-400" />
                                  ) : (
                                    <ChevronDown className="w-5 h-5 text-slate-400" />
                                  )}
                                </div>
                              </div>

                              {isExpanded && (
                              <div className="grid gap-3 pl-13">
                                {companyLines.map((line) => {
                                  const lineMachines = allMachines.filter((m) => m.line_id === line.id);
                                  const linePoints = allControlPoints.filter((point) =>
                                    lineMachines.some((m) => m.id === point.machine_id)
                                  );
                                  const lineOverdue = linePoints.filter((point) => getPointStatus(point) === "overdue").length;
                                  const lineIssues = allIssues.filter((issue) =>
                                    linePoints.some((point) => point.id === issue.control_point_id)
                                  ).length;

                                  // Determine dot color based on point status
                                  const hasCritical = linePoints.some(p => {
                                    const status = getPointStatus(p);
                                    return status === "critical" || status === "overdue";
                                  });
                                  const hasWarning = linePoints.some(p => {
                                    const status = getPointStatus(p);
                                    return status === "warning";
                                  });
                                  const dotColor = hasCritical ? "bg-red-500" : hasWarning ? "bg-yellow-500" : "bg-green-500";

                                  return (
                                    <div
                                      key={line.id}
                                      onClick={() => navigate(createPageUrl(`LineDetail?id=${line.id}&company=${company.id}`))}
                                      className="cursor-pointer"
                                    >
                                      <Card className="hover:shadow-md transition-all border border-slate-200 hover:border-slate-300">
                                        <CardContent className="p-4">
                                          <div className="flex items-start justify-between">
                                            <div className="flex items-center gap-3 flex-1">
                                              <div className={`w-3 h-3 rounded-full ${dotColor} flex-shrink-0`}></div>
                                              <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                  <h4 className="font-semibold text-slate-900 text-sm">{line.name}</h4>
                                                  {lineOverdue > 0 && (
                                                    <Badge variant="destructive" className="gap-1 text-xs">
                                                      <AlertTriangle className="w-3 h-3" />
                                                      {lineOverdue}
                                                    </Badge>
                                                  )}
                                                  {lineIssues > 0 && (
                                                    <Badge className="bg-orange-100 text-orange-700 gap-1 text-xs">
                                                      <AlertTriangle className="w-3 h-3" />
                                                      {lineIssues}
                                                    </Badge>
                                                  )}
                                                </div>
                                                <div className="flex items-center gap-3 text-xs text-slate-600">
                                                  <span>{lineMachines.length} strojů</span>
                                                  <span>·</span>
                                                  <span>{linePoints.length} bodů</span>
                                                </div>
                                              </div>
                                            </div>
                                            <ChevronRight className="w-5 h-5 text-slate-400 flex-shrink-0 ml-2" />
                                          </div>
                                        </CardContent>
                                      </Card>
                                    </div>
                                  );
                                })}
                              </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-6">
                <Card className="border-none shadow-lg">
                  <CardHeader className="border-b border-slate-100">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Activity className="w-5 h-5 text-slate-600" />
                      Poslední záznamy
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4">
                    {activeRecords.length === 0 ? (
                      <p className="text-center text-slate-500 py-8 text-sm">Zatím nejsou žádné záznamy</p>
                    ) : (
                      <div className="space-y-3">
                        {activeRecords.slice(0, 5).map((record) => {
                          const point = allControlPoints.find((cp) => cp.id === record.control_point_id); // Use allControlPoints for lookup
                          return (
                            <div key={record.id} className="flex items-start gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors">
                              <div className="flex-shrink-0 mt-1">
                                {record.record_type === "lubrication" ? (
                                  <Droplet className="w-4 h-4 text-blue-600" />
                                ) : (
                                  <ClipboardCheck className="w-4 h-4 text-purple-600" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-slate-900 truncate">{point?.name || "Neznámý bod"}</p>
                                <p className="text-xs text-slate-500 mt-1">
                                  {format(new Date(record.performed_at), "d. M. yyyy HH:mm", { locale: cs })}
                                </p>
                                <p className="text-xs text-slate-600 mt-1">{getUserDisplayName(record.created_by)}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {activeIssues.length > 0 && (
                  <Card className="border-none shadow-lg border-l-4 border-l-orange-500">
                    <CardHeader className="border-b border-slate-100">
                      <CardTitle className="flex items-center gap-2 text-lg text-orange-700">
                        <AlertTriangle className="w-5 h-5" />
                        Aktivní závady
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4">
                      <div className="space-y-3">
                        {activeIssues.slice(0, 3).map((issue) => {
                          const point = allControlPoints.find((cp) => cp.id === issue.control_point_id); // Use allControlPoints for lookup
                          return (
                            <div key={issue.id} className="p-3 rounded-lg bg-orange-50 border border-orange-200">
                              <p className="text-sm font-medium text-slate-900 mb-1">{point?.name || "Neznámý bod"}</p>
                              <p className="text-xs text-slate-600 line-clamp-2">{issue.description}</p>
                              {issue.photo_url && (
                                <div className="mt-2">
                                  <img src={issue.photo_url} alt="Závada" className="max-h-20 object-contain rounded-md" />
                                </div>
                              )}
                              <p className="text-xs text-slate-500 mt-2">
                                {format(new Date(issue.created_date), "d. M. yyyy", { locale: cs })} • {getUserDisplayName(issue.created_by)}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                      {activeIssues.length > 3 && (
                        <Link to={createPageUrl("IssueApproval")} className="block text-center text-sm text-orange-700 hover:text-orange-800 font-medium mt-4">
                          Zobrazit všechny závady →
                        </Link>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </div>
        </div>
      );
    }



    return (
      <div className="p-4 md:p-8 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2">Dashboard</h1>
            <p className="text-slate-600">Přehled stavu mazacích a inspekčních plánů</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-8">
            <Card className="border-none shadow-lg bg-gradient-to-br from-blue-500 to-blue-600 text-white hover:shadow-xl transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-blue-100 text-sm font-medium mb-1">Celkem linek</p>
                    <p className="text-4xl font-bold">{totalLinesCount}</p>
                  </div>
                  <div className="p-3 bg-white/20 rounded-xl">
                    <Activity className="w-6 h-6" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-lg bg-gradient-to-br from-purple-500 to-purple-600 text-white hover:shadow-xl transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-purple-100 text-sm font-medium mb-1">Kontrolní body</p>
                    <p className="text-4xl font-bold">{controlPoints.length}</p>
                  </div>
                  <div className="p-3 bg-white/20 rounded-xl">
                    <Droplet className="w-6 h-6" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-lg bg-gradient-to-br from-red-500 to-red-600 text-white hover:shadow-xl transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-red-100 text-sm font-medium mb-1">Po termínu</p>
                    <p className="text-4xl font-bold">{overduePointsCount}</p>
                    </div>
                  <div className="p-3 bg-white/20 rounded-xl">
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-lg bg-gradient-to-br from-green-500 to-green-600 text-white hover:shadow-xl transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-green-100 text-sm font-medium mb-1">Záznamů tento měsíc</p>
                    <p className="text-4xl font-bold">{totalRecordsThisMonthCount}</p>
                  </div>
                  <div className="p-3 bg-white/20 rounded-xl">
                    <ClipboardCheck className="w-6 h-6" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Card className="border-none shadow-lg">
                <CardHeader className="border-b border-slate-100">
                  <CardTitle className="flex items-center gap-2 text-xl">
                    <Activity className="w-5 h-5 text-slate-600" />
                    Přehled výroby - Linky
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="grid gap-4">
                    {lines.map((line) => {
                      const lineMachines = machines.filter((m) => m.line_id === line.id);
                      const linePoints = controlPoints.filter((point) =>
                        lineMachines.some((m) => m.id === point.machine_id)
                      );
                      const lineOverdue = linePoints.filter((point) => getPointStatus(point) === "overdue").length;
                      const lineIssues = issues.filter((issue) =>
                        linePoints.some((point) => point.id === issue.control_point_id)
                      ).length;

                      // Determine dot color based on point status
                      const hasCritical = linePoints.some(p => {
                        const status = getPointStatus(p);
                        return status === "critical" || status === "overdue";
                      });
                      const hasWarning = linePoints.some(p => {
                        const status = getPointStatus(p);
                        return status === "warning";
                      });
                      const dotColor = hasCritical ? "bg-red-500" : hasWarning ? "bg-yellow-500" : "bg-green-500";

                      return (
                        <div
                          key={line.id}
                          onClick={() => navigate(createPageUrl(`LineDetail?id=${line.id}`))}
                          className="cursor-pointer"
                        >
                          <Card className="hover:shadow-md transition-all border border-slate-200 hover:border-slate-300">
                            <CardContent className="p-5">
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center gap-3 mb-2">
                                    <h3 className="text-lg font-bold text-slate-900">{line.name}</h3>
                                    {lineOverdue > 0 && (
                                      <Badge variant="destructive" className="gap-1">
                                        <AlertTriangle className="w-3 h-3" />
                                        {lineOverdue}
                                      </Badge>
                                    )}
                                    {lineIssues > 0 && (
                                      <Badge className="bg-orange-100 text-orange-700 gap-1">
                                        <AlertTriangle className="w-3 h-3" />
                                        {lineIssues}
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-4 text-sm text-slate-600">
                                    <span className="flex items-center gap-1">
                                      <Activity className="w-4 h-4" />
                                      {lineMachines.length} strojů
                                    </span>
                                    <span className="flex items-center gap-1">
                                      <Droplet className="w-4 h-4" />
                                      {linePoints.length} bodů
                                    </span>
                                  </div>
                                </div>
                                <div className="flex-shrink-0">
                                  <div className={`w-3 h-3 rounded-full ${dotColor}`} />
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card className="border-none shadow-lg">
                <CardHeader className="border-b border-slate-100">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Activity className="w-5 h-5 text-slate-600" />
                    Poslední záznamy
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  {records.length === 0 ? (
                    <p className="text-center text-slate-500 py-8 text-sm">Zatím nejsou žádné záznamy</p>
                  ) : (
                    <div className="space-y-3">
                      {records.slice(0, 5).map((record) => {
                        const point = controlPoints.find((cp) => cp.id === record.control_point_id);
                        return (
                          <div key={record.id} className="flex items-start gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors">
                            <div className="flex-shrink-0 mt-1">
                              {record.record_type === "lubrication" ? (
                                <Droplet className="w-4 h-4 text-blue-600" />
                              ) : (
                                <ClipboardCheck className="w-4 h-4 text-purple-600" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-slate-900 truncate">{point?.name || "Neznámý bod"}</p>
                              <p className="text-xs text-slate-500 mt-1">
                                {format(new Date(record.performed_at), "d. M. yyyy HH:mm", { locale: cs })}
                              </p>
                              <p className="text-xs text-slate-600 mt-1">{getUserDisplayName(record.created_by)}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              {issues.length > 0 && user?.user_type !== "technician" && (
                <Card className="border-none shadow-lg border-l-4 border-l-orange-500">
                  <CardHeader className="border-b border-slate-100">
                    <CardTitle className="flex items-center gap-2 text-lg text-orange-700">
                      <AlertTriangle className="w-5 h-5" />
                      Aktivní závady
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4">
                    <div className="space-y-3">
                      {issues.slice(0, 3).map((issue) => {
                        const point = controlPoints.find((cp) => cp.id === issue.control_point_id);
                        return (
                          <div key={issue.id} className="p-3 rounded-lg bg-orange-50 border border-orange-200">
                            <p className="text-sm font-medium text-slate-900 mb-1">{point?.name || "Neznámý bod"}</p>
                            <p className="text-xs text-slate-600 line-clamp-2">{issue.description}</p>
                            {issue.photo_url && (
                              <div className="mt-2">
                                <img src={issue.photo_url} alt="Závada" className="max-h-20 object-contain rounded-md" />
                              </div>
                            )}
                            <p className="text-xs text-slate-500 mt-2">
                              {format(new Date(issue.created_date), "d. M. yyyy", { locale: cs })} • {getUserDisplayName(issue.created_by)}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                    {issues.length > 3 && (
                      <Link to={createPageUrl("IssueApproval")} className="block text-center text-sm text-orange-700 hover:text-orange-800 font-medium mt-4">
                        Zobrazit všechny závady →
                      </Link>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return <div className="p-8">Dashboard - DEMIP režim je ve vývoji</div>;
}