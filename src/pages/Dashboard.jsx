
import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  Factory,
  Droplet,
  ClipboardCheck,
  AlertTriangle,
  CheckCircle,
  Clock,
  TrendingUp,
  Calendar,
  Plus,
  Building2,
  ChevronRight
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { cs } from "date-fns/locale";

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    const currentUser = await base44.auth.me();
    setUser(currentUser);
  };

  const { data: companies = [] } = useQuery({
    queryKey: ["companies"],
    queryFn: () => base44.entities.Company.list("name"),
    enabled: user?.user_type === "admin",
  });

  const { data: lines = [] } = useQuery({
    queryKey: ["lines", user?.company_id],
    queryFn: () =>
      user?.company_id
        ? base44.entities.Line.filter({ company_id: user.company_id }, "order_index")
        : [],
    enabled: !!user?.company_id && user?.user_type !== "admin",
  });

  const { data: allLines = [] } = useQuery({
    queryKey: ["allLines"],
    queryFn: () => base44.entities.Line.list(),
    enabled: user?.user_type === "admin",
  });

  const { data: machines = [] } = useQuery({
    queryKey: ["machines"],
    queryFn: () => base44.entities.Machine.list("order_index"),
  });

  const { data: controlPoints = [] } = useQuery({
    queryKey: ["controlPoints"],
    queryFn: () => base44.entities.ControlPoint.list(),
  });

  const { data: records = [] } = useQuery({
    queryKey: ["records"],
    queryFn: () => base44.entities.ControlRecord.list("-performed_at", 10),
  });

  const { data: issues = [] } = useQuery({
    queryKey: ["issues"],
    queryFn: () => base44.entities.Issue.filter({ status: "reported" }),
  });

  // Pokud uživatel nemá company_id a není admin, přesměrovat na setup
  useEffect(() => {
    if (user && !user.company_id && user.user_type !== "admin") {
      navigate(createPageUrl("Setup"));
    } else if (user && user.user_type !== "admin" && lines.length === 0 && !user.company_id) {
      navigate(createPageUrl("Setup"));
    }
  }, [user, lines, navigate]);

  const getPointStatus = (point) => {
    const pointRecords = records.filter((r) => r.control_point_id === point.id);
    if (pointRecords.length === 0) return "overdue";

    const latestRecord = pointRecords[0];
    const lastPerformed = new Date(latestRecord.performed_at);
    const now = new Date();
    const hoursSince = (now - lastPerformed) / (1000 * 60 * 60);

    return hoursSince > point.interval_hours ? "overdue" : "ok";
  };

  const overduePoints = controlPoints.filter(
    (point) => getPointStatus(point) === "overdue"
  ).length;

  const totalRecordsThisMonth = records.filter((r) => {
    const date = new Date(r.performed_at);
    const now = new Date();
    return (
      date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()
    );
  }).length;

  // Dashboard pro administrátora - zobrazení podniků
  if (user?.user_type === "admin") {
    return (
      <div className="p-4 md:p-8 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2">
              Dashboard
            </h1>
            <p className="text-slate-600">
              Přehled všech podniků v systému
            </p>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-8">
            <Card className="border-none shadow-lg bg-gradient-to-br from-blue-500 to-blue-600 text-white hover:shadow-xl transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-blue-100 text-sm font-medium mb-1">Celkem podniků</p>
                    <p className="text-4xl font-bold">{companies.length}</p>
                  </div>
                  <div className="p-3 bg-white/20 rounded-xl">
                    <Building2 className="w-6 h-6" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-lg bg-gradient-to-br from-purple-500 to-purple-600 text-white hover:shadow-xl transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-purple-100 text-sm font-medium mb-1">Celkem linek</p>
                    <p className="text-4xl font-bold">{allLines.length}</p>
                  </div>
                  <div className="p-3 bg-white/20 rounded-xl">
                    <Factory className="w-6 h-6" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-lg bg-gradient-to-br from-red-500 to-red-600 text-white hover:shadow-xl transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-red-100 text-sm font-medium mb-1">Po termínu</p>
                    <p className="text-4xl font-bold">{overduePoints}</p>
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
                    <p className="text-4xl font-bold">{totalRecordsThisMonth}</p>
                  </div>
                  <div className="p-3 bg-white/20 rounded-xl">
                    <ClipboardCheck className="w-6 h-6" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Podniky */}
            <div className="lg:col-span-2">
              <Card className="border-none shadow-lg">
                <CardHeader className="border-b border-slate-100">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-xl">
                      <Building2 className="w-5 h-5 text-slate-600" />
                      Podniky
                    </CardTitle>
                    <Button
                      onClick={() => navigate(createPageUrl("AdminCompanies"))}
                      size="sm"
                      variant="outline"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Přidat podnik
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  {companies.length === 0 ? (
                    <div className="text-center py-12">
                      <Building2 className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                      <h3 className="text-lg font-semibold text-slate-900 mb-2">
                        Zatím nemáte žádné podniky
                      </h3>
                      <p className="text-slate-500 mb-6">
                        Začněte vytvořením prvního podniku
                      </p>
                      <Button
                        onClick={() => navigate(createPageUrl("AdminCompanies"))}
                        className="bg-gradient-to-r from-red-600 to-red-700"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Vytvořit podnik
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {companies.map((company) => {
                        const companyLines = allLines.filter((l) => l.company_id === company.id);
                        const companyMachines = machines.filter((m) =>
                          companyLines.some((l) => l.id === m.line_id)
                        );
                        const companyPoints = controlPoints.filter((p) =>
                          companyMachines.some((m) => m.id === p.machine_id)
                        );
                        const companyOverdue = companyPoints.filter(
                          (p) => getPointStatus(p) === "overdue"
                        ).length;
                        const companyIssues = issues.filter((issue) =>
                          companyPoints.some((p) => p.id === issue.control_point_id)
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
                                      <Building2 className="w-6 h-6 text-white" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-3 mb-2">
                                        <h3 className="text-lg font-bold text-slate-900">
                                          {company.name}
                                        </h3>
                                        {companyOverdue > 0 && (
                                          <Badge variant="destructive" className="gap-1">
                                            <Clock className="w-3 h-3" />
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
                                          <Factory className="w-4 h-4" />
                                          {companyLines.length} linek
                                        </span>
                                        <span className="flex items-center gap-1">
                                          <Droplet className="w-4 h-4" />
                                          {companyPoints.length} bodů
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                  <ChevronRight className="w-6 h-6 text-slate-400 flex-shrink-0 ml-4" />
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

            {/* Poslední záznamy a závady */}
            <div className="space-y-6">
              {/* Poslední záznamy */}
              <Card className="border-none shadow-lg">
                <CardHeader className="border-b border-slate-100">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Clock className="w-5 h-5 text-slate-600" />
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
                          (p) => p.id === record.control_point_id
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
                                {record.created_by}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Nahlášené závady */}
              {issues.length > 0 && (
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
                          (p) => p.id === issue.control_point_id
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
                              })}
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
      </div>
    );
  }

  // Dashboard pro vedoucí a techniky - zobrazení linek
  // Pokud nejsou žádná data, zobrazit Setup tlačítko
  if (lines.length === 0 && user?.company_id) {
    return (
      <div className="p-4 md:p-8 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
        <div className="max-w-3xl mx-auto">
          <Card className="shadow-xl">
            <CardContent className="p-12 text-center">
              <Factory className="w-20 h-20 text-slate-300 mx-auto mb-6" />
              <h2 className="text-2xl font-bold text-slate-900 mb-4">
                Začněte s DEMIP
              </h2>
              <p className="text-slate-600 mb-8">
                Zatím nemáte vytvořené žádné linky. Vytvořte demo data nebo začněte s vlastní strukturou.
              </p>
              <div className="flex gap-4 justify-center">
                <Button
                  onClick={() => navigate(createPageUrl("Setup"))}
                  className="bg-gradient-to-r from-red-600 to-red-700"
                >
                  <Plus className="w-4 h-4 mr-2" />
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
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2">
            Dashboard
          </h1>
          <p className="text-slate-600">
            Přehled stavu mazacích a inspekčních plánů
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-8">
          <Card className="border-none shadow-lg bg-gradient-to-br from-blue-500 to-blue-600 text-white hover:shadow-xl transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-blue-100 text-sm font-medium mb-1">Celkem linek</p>
                  <p className="text-4xl font-bold">{lines.length}</p>
                </div>
                <div className="p-3 bg-white/20 rounded-xl">
                  <Factory className="w-6 h-6" />
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
                  <p className="text-4xl font-bold">{overduePoints}</p>
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
                  <p className="text-4xl font-bold">{totalRecordsThisMonth}</p>
                </div>
                <div className="p-3 bg-white/20 rounded-xl">
                  <ClipboardCheck className="w-6 h-6" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Linky */}
          <div className="lg:col-span-2">
            <Card className="border-none shadow-lg">
              <CardHeader className="border-b border-slate-100">
                <CardTitle className="flex items-center gap-2 text-xl">
                  <Factory className="w-5 h-5 text-slate-600" />
                  Výrobní linky
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid gap-4">
                  {lines.map((line) => {
                    const lineMachines = machines.filter((m) => m.line_id === line.id);
                    const linePoints = controlPoints.filter((p) =>
                      lineMachines.some((m) => m.id === p.machine_id)
                    );
                    const lineOverdue = linePoints.filter(
                      (p) => getPointStatus(p) === "overdue"
                    ).length;
                    const lineIssues = issues.filter((issue) =>
                      linePoints.some((p) => p.id === issue.control_point_id)
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
                                      <Clock className="w-3 h-3" />
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
                                    <Factory className="w-4 h-4" />
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

          {/* Poslední záznamy a závady */}
          <div className="space-y-6">
            {/* Poslední záznamy */}
            <Card className="border-none shadow-lg">
              <CardHeader className="border-b border-slate-100">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Clock className="w-5 h-5 text-slate-600" />
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
                        (p) => p.id === record.control_point_id
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
                              {record.created_by}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Nahlášené závady */}
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
                        (p) => p.id === issue.control_point_id
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
                            })}
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
    </div>
  );
}
