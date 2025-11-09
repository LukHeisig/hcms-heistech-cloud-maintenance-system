import React, { useState, useEffect, useCallback, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
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
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { cs } from "date-fns/locale";

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const navigate = useNavigate();
  const { viewMode } = useViewMode();

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    const currentUser = await base44.auth.me();
    setUser(currentUser);
  };

  const { data: allCompanies = [] } = useQuery({
    queryKey: ["companies"],
    queryFn: () => base44.entities.Company.list("name"),
    enabled: user?.user_type === "admin" || user?.user_type === "superAdmin",
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

  const { data: lines = [] } = useQuery({
    queryKey: ["lines", user?.company_id],
    queryFn: () =>
      user?.company_id
        ? base44.entities.Line.filter({ company_id: user.company_id }, "order_index")
        : [],
    enabled: !!user?.company_id && user?.user_type !== "admin" && user?.user_type !== "superAdmin",
  });

  const { data: allLines = [] } = useQuery({
    queryKey: ["allLines"],
    queryFn: () => base44.entities.Line.list(),
  });

  const { data: machines = [] } = useQuery({
    queryKey: ["machines"],
    queryFn: () => base44.entities.Machine.list("order_index"),
    enabled: !!user,
  });

  const { data: controlPoints = [] } = useQuery({
    queryKey: ["controlPoints"],
    queryFn: () => base44.entities.ControlPoint.list(),
    enabled: !!user,
  });

  const { data: records = [] } = useQuery({
    queryKey: ["records"],
    queryFn: () => base44.entities.ControlRecord.list("-performed_at", 100),
    enabled: !!user,
  });

  const { data: issues = [] } = useQuery({
    queryKey: ["issues"],
    queryFn: () => base44.entities.Issue.filter({ status: "reported" }),
    enabled: !!user,
  });

  useEffect(() => {
    if (user && !user.company_id && user.user_type !== "admin" && user.user_type !== "superAdmin") {
      navigate(createPageUrl("Setup"));
    } else if (user && user.user_type !== "admin"  && user.user_type !== "superAdmin" && lines.length === 0 && !user.company_id) {
      navigate(createPageUrl("Setup"));
    }
  }, [user, lines, navigate]);

  const getPointStatus = useCallback((point) => {
    const pointRecords = records.filter((r) => r.control_point_id === point.id);
    if (pointRecords.length === 0) return "overdue";

    const latestRecord = pointRecords[0];
    const lastPerformed = new Date(latestRecord.performed_at);
    const now = new Date();
    const hoursSince = (now - lastPerformed) / (1000 * 60 * 60);

    return hoursSince > point.interval_hours ? "overdue" : "ok";
  }, [records]);

  const getNextControlDate = useCallback((point) => {
    const pointRecords = records.filter(r => r.control_point_id === point.id);
    if (pointRecords.length === 0 || !point.interval_hours) return null;

    const latestRecord = pointRecords[0];
    const lastPerformed = new Date(latestRecord.performed_at);
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
      const activeMachineIds = machines
        .filter(m => activeLinesIds.includes(m.line_id))
        .map(m => m.id);
      return controlPoints.filter(cp => activeMachineIds.includes(cp.machine_id));
    }
    return controlPoints;
  }, [user, allLines, machines, controlPoints, activeCompanyIds]);

  const overduePointsCount = React.useMemo(() => {
    return activeControlPoints.filter(
      (point) => getPointStatus(point) === "overdue"
    ).length;
  }, [activeControlPoints, getPointStatus]);

  const activeRecords = React.useMemo(() => {
    if (user?.user_type === "admin" || user?.user_type === "superAdmin") {
      const activePointIds = activeControlPoints.map(p => p.id);
      return records.filter(r => activePointIds.includes(r.control_point_id));
    }
    return records;
  }, [user, records, activeControlPoints]);

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
      return issues.filter(issue => activePointIds.includes(issue.control_point_id));
    }
    return issues;
  }, [user, issues, activeControlPoints]);

  // Zobrazení pro DEMIP režim - nyní i pro adminy
  if (viewMode === 'demip') {
    const demipPoints = (user?.user_type === "admin" || user?.user_type === "superAdmin") 
      ? activeControlPoints 
      : controlPoints;
    
    const demipMachines = (user?.user_type === "admin" || user?.user_type === "superAdmin")
      ? machines.filter(m => {
          const activeLinesIds = allLines.filter(l => activeCompanyIds.includes(l.company_id)).map(l => l.id);
          return activeLinesIds.includes(m.line_id);
        })
      : machines.filter(m => lines.some(l => l.id === m.line_id));

    const demipMachinesWithPoints = demipMachines.map(machine => {
      const machinePoints = demipPoints.filter(p => p.machine_id === machine.id);
      const overdueCount = machinePoints.filter(p => getPointStatus(p) === "overdue").length;
      const machineLine = (user?.user_type === "admin" || user?.user_type === "superAdmin")
        ? allLines.find(l => l.id === machine.line_id)
        : lines.find(l => l.id === machine.line_id);

      return {
        ...machine,
        lineName: machineLine?.name,
        points: machinePoints,
        totalPoints: machinePoints.length,
        overduePoints: overdueCount,
      };
    }).filter(m => m.totalPoints > 0);

    const demipOverdueCount = demipPoints.filter(p => getPointStatus(p) === "overdue").length;
    const demipIssues = (user?.user_type === "admin" || user?.user_type === "superAdmin")
      ? activeIssues
      : issues;

    return (
      <div className="p-4 md:p-8 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
        <div className="max-w-7xl mx-auto">
          <div className="mb-6">
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 mb-2">
              Přehled výroby - DEMIP
            </h1>
            <p className="text-slate-600">
              {(user?.user_type === "admin" || user?.user_type === "superAdmin")
                ? "Kontrolní body všech přiřazených strojů"
                : "Kontrolní body všech strojů"
              }
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
            <Card className="border-none shadow-lg bg-gradient-to-br from-purple-500 to-purple-600 text-white">
              <CardContent className="p-4">
                <p className="text-purple-100 text-xs font-medium mb-1">Kontrolní body</p>
                <p className="text-2xl md:text-3xl font-bold">{demipPoints.length}</p>
              </CardContent>
            </Card>

            <Card className="border-none shadow-lg bg-gradient-to-br from-red-500 to-red-600 text-white">
              <CardContent className="p-4">
                <p className="text-red-100 text-xs font-medium mb-1">Po termínu</p>
                <p className="text-2xl md:text-3xl font-bold">{demipOverdueCount}</p>
              </CardContent>
            </Card>

            <Card className="border-none shadow-lg bg-gradient-to-br from-green-500 to-green-600 text-white">
              <CardContent className="p-4">
                <p className="text-green-100 text-xs font-medium mb-1">V pořádku</p>
                <p className="text-2xl md:text-3xl font-bold">
                  {demipPoints.length - demipOverdueCount}
                </p>
              </CardContent>
            </Card>

            <Card className="border-none shadow-lg bg-gradient-to-br from-orange-500 to-orange-600 text-white">
              <CardContent className="p-4">
                <p className="text-orange-100 text-xs font-medium mb-1">Aktivní závady</p>
                <p className="text-2xl md:text-3xl font-bold">{demipIssues.length}</p>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            {demipMachinesWithPoints.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <Droplet className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500">Nejsou definovány žádné kontrolní body</p>
                </CardContent>
              </Card>
            ) : (
              demipMachinesWithPoints.map((machine) => (
                <Card key={machine.id} className="border-2 border-slate-200 shadow-lg">
                  <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200 pb-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <CardTitle className="text-lg md:text-xl">{machine.name}</CardTitle>
                          {machine.overduePoints > 0 && (
                            <Badge variant="destructive" className="gap-1">
                              <AlertTriangle className="w-3 h-3" />
                              {machine.overduePoints}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs md:text-sm text-slate-600">{machine.lineName}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-slate-500">Celkem bodů</p>
                        <p className="text-xl md:text-2xl font-bold text-slate-900">
                          {machine.totalPoints}
                        </p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-3 md:p-4">
                    <div className="grid gap-2">
                      {machine.points.map((point) => {
                        const status = getPointStatus(point);
                        const nextDate = getNextControlDate(point);
                        const isOverdue = status === "overdue";
                        const pointIssues = demipIssues.filter(i => i.control_point_id === point.id);

                        return (
                          <Link
                            key={point.id}
                            to={createPageUrl(`ControlPoint?id=${point.id}`)}
                          >
                            <Card
                              className={`border-l-4 transition-all hover:shadow-md ${
                                isOverdue
                                  ? "border-l-yellow-500 bg-yellow-50/50"
                                  : "border-l-green-500 bg-white"
                              }`}
                            >
                              <CardContent className="p-3 md:p-4">
                                <div className="flex items-center gap-3">
                                  <div className={`w-10 h-10 md:w-12 md:h-12 rounded-lg flex items-center justify-center flex-shrink-0 ${
                                    isOverdue ? "bg-yellow-100" : "bg-green-100"
                                  }`}>
                                    {point.type === "lubrication" || point.type === "auto_lubricator" ? (
                                      <Droplet className={`w-5 h-5 md:w-6 md:h-6 ${isOverdue ? "text-yellow-700" : "text-green-700"}`} />
                                    ) : (
                                      <ClipboardCheck className={`w-5 h-5 md:w-6 md:h-6 ${isOverdue ? "text-yellow-700" : "text-green-700"}`} />
                                    )}
                                  </div>

                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                                      <h3 className="font-bold text-sm md:text-base text-slate-900">
                                        {point.number && `${point.number} - `}{point.name}
                                      </h3>
                                      {isOverdue && (
                                        <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-300 text-xs">
                                          <Clock className="w-3 h-3 mr-1" />
                                          Po termínu
                                        </Badge>
                                      )}
                                      {pointIssues.length > 0 && (
                                        <Badge className="bg-orange-500 text-white text-xs">
                                          <AlertTriangle className="w-3 h-3 mr-1" />
                                          {pointIssues.length}
                                        </Badge>
                                      )}
                                    </div>

                                    <div className="text-xs md:text-sm text-slate-600 space-y-0.5">
                                      {point.type === "lubrication" && point.lubricant_type && (
                                        <p>Mazivo: {point.lubricant_type}</p>
                                      )}
                                      {point.interval_hours && (
                                        <p>Interval: {point.interval_hours}h</p>
                                      )}
                                      {nextDate && (
                                        <p className={isOverdue ? "text-yellow-700 font-medium" : ""}>
                                          Další kontrola: {format(nextDate, "d.M. yyyy", { locale: cs })}
                                        </p>
                                      )}
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-2">
                                    <div className={`w-3 h-3 rounded-full ${
                                      isOverdue ? "bg-yellow-500" : "bg-green-500"
                                    }`} />
                                    <ChevronRight className="w-5 h-5 text-slate-400" />
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          </Link>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      </div>
    );
  }

  // Admin dashboard - klasický režim údržby
  if (user?.user_type === "admin" || user?.user_type === "superAdmin") {
    return (
      <div className="p-4 md:p-8 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2">
              Dashboard
            </h1>
            <p className="text-slate-600">
              {user?.user_type === "superAdmin"
                ? "Přehled všech podniků v systému"
                : `Přehled vašich ${activeCompanies.length} přiřazených podniků`
              }
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
                      <Wrench className="w-5 h-5 text-slate-600" />
                      Podniky
                    </CardTitle>
                    {user?.user_type === "superAdmin" && (
                      <Button
                        onClick={() => navigate(createPageUrl("AdminCompanies"))}
                        size="sm"
                        variant="outline"
                      >
                        <ArrowRight className="w-4 h-4 mr-2" />
                        Přidat podnik
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  {activeCompanies.length === 0 ? (
                    <div className="text-center py-12">
                      <Wrench className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                      <h3 className="text-lg font-semibold text-slate-900 mb-2">
                        {user?.user_type === "superAdmin"
                          ? "Zatím nemáte žádné aktivní podniky"
                          : "Nemáte přiřazené žádné aktivní podniky"
                        }
                      </h3>
                      <p className="text-slate-500 mb-6">
                        {user?.user_type === "superAdmin"
                          ? "Začněte vytvořením prvního podniku"
                          : "Kontaktujte superAdmina pro přiřazení podniků"
                        }
                      </p>
                      {user?.user_type === "superAdmin" && (
                        <Button
                          onClick={() => navigate(createPageUrl("AdminCompanies"))}
                          className="bg-gradient-to-r from-red-600 to-red-700"
                        >
                          <ArrowRight className="w-4 h-4 mr-2" />
                          Vytvořit podnik
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {activeCompanies.map((company) => {
                        const companyLines = allLines.filter((l) => l.company_id === company.id);
                        const companyMachines = machines.filter((m) =>
                          companyLines.some((l) => l.id === m.line_id)
                        );
                        const companyPoints = activeControlPoints.filter((point) =>
                          companyMachines.some((m) => m.id === point.machine_id)
                        );
                        const companyOverdue = companyPoints.filter(
                          (point) => getPointStatus(point) === "overdue"
                        ).length;
                        const companyIssues = activeIssues.filter((issue) =>
                          companyPoints.some((point) => point.id === issue.control_point_id)
                        ).length;

                        return (
                          <Link
                            key={company.id}
                            to={createPageUrl(`AdminLines?company=${company.id}`)}
                          >
                            <Card className="hover:shadow-md transition-all border border-slate-200 hover:border-slate-300">
                              <CardContent className="p-5">
                                <div className="flex items-start justify-between">
                                  <div className="flex items-center gap-4 flex-1">
                                    <div className="w-12 h-12 bg-gradient-to-br from-red-600 to-red-700 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
                                      <Wrench className="w-6 h-6 text-white" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-3 mb-2">
                                        <h3 className="text-lg font-bold text-slate-900">
                                          {company.name}
                                        </h3>
                                        {companyOverdue > 0 && (
                                          <Badge variant="destructive" className="gap-1">
                                            <AlertTriangle className="w-3 h-3" />
                                            {companyOverdue}
                                          </Badge>
                                        )}
                                        {companyIssues > 0 && (
                                          <Badge className="bg-orange-100 text-orange-700 gap-1">
                                            <AlertTriangle className="w-3 h-3" />
                                            {companyIssues}
                                          </Badge>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-4 text-sm text-slate-600">
                                        <span className="flex items-center gap-1">
                                          <Activity className="w-4 h-4" />
                                          {companyLines.length} linek
                                        </span>
                                        <span className="flex items-center gap-1">
                                          <Droplet className="w-4 h-4" />
                                          {companyPoints.length} bodů
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                  <ArrowRight className="w-6 h-6 text-slate-400 flex-shrink-0 ml-4" />
                                </div>
                              </CardContent>
                            </Card>
                          </Link>
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
                    <p className="text-center text-slate-500 py-8 text-sm">
                      Zatím nejsou žádné záznamy
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {activeRecords.slice(0, 5).map((record) => {
                        const point = activeControlPoints.find(
                          (cp) => cp.id === record.control_point_id
                        );
                        return (
                          <div
                            key={record.id}
                            className="flex items-start gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors"
                          >
                            <div className="flex-shrink-0 mt-1">
                              {record.record_type === "lubrication" ? (
                                <Droplet className="w-4 h-4 text-blue-600" />
                              ) : (
                                <ClipboardCheck className="w-4 h-4 text-purple-600" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-slate-900 truncate">
                                {point?.name || "Neznámý bod"}
                              </p>
                              <p className="text-xs text-slate-500 mt-1">
                                {format(
                                  new Date(record.performed_at),
                                  "d. M. yyyy HH:mm",
                                  { locale: cs }
                                )}
                              </p>
                              <p className="text-xs text-slate-600 mt-1">
                                {getUserDisplayName(record.created_by)}
                              </p>
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
                        const point = activeControlPoints.find(
                          (cp) => cp.id === issue.control_point_id
                        );
                        return (
                          <div
                            key={issue.id}
                            className="p-3 rounded-lg bg-orange-50 border border-orange-200"
                          >
                            <p className="text-sm font-medium text-slate-900 mb-1">
                              {point?.name || "Neznámý bod"}
                            </p>
                            <p className="text-xs text-slate-600 line-clamp-2">
                              {issue.description}
                            </p>
                            <p className="text-xs text-slate-500 mt-2">
                              {format(new Date(issue.created_date), "d. M. yyyy", {
                                locale: cs,
                              })} • {getUserDisplayName(issue.created_by)}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                    {activeIssues.length > 3 && (
                      <Link
                        to={createPageUrl("IssueApproval")}
                        className="block text-center text-sm text-orange-700 hover:text-orange-800 font-medium mt-4"
                      >
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

  if (lines.length === 0 && user?.company_id) {
    return (
      <div className="p-4 md:p-8 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
        <div className="max-w-3xl mx-auto">
          <Card className="shadow-xl">
            <CardContent className="p-12 text-center">
              <Activity className="w-20 h-20 text-slate-300 mx-auto mb-6" />
              <h2 className="text-2xl font-bold text-slate-900 mb-4">
                Začněte s HCMS
              </h2>
              <p className="text-slate-600 mb-8">
                Zatím nemáte vytvořené žádné linky. Vytvořte demo data nebo začněte s vlastní strukturou.
              </p>
              <div className="flex gap-4 justify-center">
                <Button
                  onClick={() => navigate(createPageUrl("Setup"))}
                  className="bg-gradient-to-r from-red-600 to-red-700"
                >
                  <ArrowRight className="w-4 h-4 mr-2" />
                  Vytvořit demo data
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2">
            Dashboard
          </h1>
          <p className="text-slate-600">
            Přehled stavu mazacích a inspekčních plánů
          </p>
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
                  Výrobní linky
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid gap-4">
                  {lines.map((line) => {
                    const lineMachines = machines.filter((m) => m.line_id === line.id);
                    const linePoints = controlPoints.filter((point) =>
                      lineMachines.some((m) => m.id === point.machine_id)
                    );
                    const lineOverdue = linePoints.filter(
                      (point) => getPointStatus(point) === "overdue"
                    ).length;
                    const lineIssues = issues.filter((issue) =>
                      linePoints.some((point) => point.id === issue.control_point_id)
                    ).length;

                    return (
                      <Link key={line.id} to={createPageUrl(`Lines?line=${line.id}`)}>
                        <Card className="hover:shadow-md transition-all border border-slate-200 hover:border-slate-300">
                          <CardContent className="p-5">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2">
                                  <h3 className="text-lg font-bold text-slate-900">
                                    {line.name}
                                  </h3>
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
                                {lineOverdue > 0 ? (
                                  <div className="w-3 h-3 rounded-full bg-red-500" />
                                ) : (
                                  <div className="w-3 h-3 rounded-full bg-green-500" />
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </Link>
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
                  <p className="text-center text-slate-500 py-8 text-sm">
                    Zatím nejsou žádné záznamy
                  </p>
                ) : (
                  <div className="space-y-3">
                    {records.slice(0, 5).map((record) => {
                      const point = controlPoints.find(
                        (cp) => cp.id === record.control_point_id
                      );
                      return (
                        <div
                          key={record.id}
                          className="flex items-start gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors"
                        >
                          <div className="flex-shrink-0 mt-1">
                            {record.record_type === "lubrication" ? (
                              <Droplet className="w-4 h-4 text-blue-600" />
                            ) : (
                              <ClipboardCheck className="w-4 h-4 text-purple-600" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-900 truncate">
                              {point?.name || "Neznámý bod"}
                            </p>
                            <p className="text-xs text-slate-500 mt-1">
                              {format(
                                new Date(record.performed_at),
                                "d. M. yyyy HH:mm",
                                { locale: cs }
                              )}
                            </p>
                            <p className="text-xs text-slate-600 mt-1">
                              {getUserDisplayName(record.created_by)}
                            </p>
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
                      const point = controlPoints.find(
                        (cp) => cp.id === issue.control_point_id
                      );
                      return (
                        <div
                          key={issue.id}
                          className="p-3 rounded-lg bg-orange-50 border border-orange-200"
                        >
                          <p className="text-sm font-medium text-slate-900 mb-1">
                            {point?.name || "Neznámý bod"}
                          </p>
                          <p className="text-xs text-slate-600 line-clamp-2">
                            {issue.description}
                          </p>
                          <p className="text-xs text-slate-500 mt-2">
                            {format(new Date(issue.created_date), "d. M. yyyy", {
                              locale: cs,
                            })} • {getUserDisplayName(issue.created_by)}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                  {issues.length > 3 && (
                    <Link
                      to={createPageUrl("IssueApproval")}
                      className="block text-center text-sm text-orange-700 hover:text-orange-800 font-medium mt-4"
                    >
                      Zobrazit všechny závady →
                    </Link>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    );
  }
}