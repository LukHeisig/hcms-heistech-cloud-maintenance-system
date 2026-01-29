import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FileText,
  Search,
  Filter,
  Calendar,
  User as UserIcon,
  Activity,
  Loader2,
  AlertCircle,
  Users,
  Clock,
  CheckCircle,
  XCircle,
  Wifi,
  WifiOff,
} from "lucide-react";
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, formatDistanceToNow } from "date-fns";
import { cs } from "date-fns/locale";

export default function AuditLog() {
  const [user, setUser] = useState(null);
  const [entityTypeFilter, setEntityTypeFilter] = useState("all");
  const [userFilter, setUserFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [dateRangeFilter, setDateRangeFilter] = useState("all");
  const [monitoringUserFilter, setMonitoringUserFilter] = useState("all");

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    const currentUser = await base44.auth.me();
    setUser(currentUser);
  };

  const twoMonthsAgo = new Date();
  twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);

  const { data: allLogs = [], isLoading } = useQuery({
    queryKey: ["auditLogs"],
    queryFn: async () => {
      const logs = await base44.entities.AuditLog.list("-created_date", 1000);
      return logs.filter(log => new Date(log.created_date) >= twoMonthsAgo);
    },
    enabled: !!user,
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ["allUsers"],
    queryFn: async () => {
      const response = await base44.functions.invoke("getUsers");
      return response.data;
    },
  });

  const { data: companies = [] } = useQuery({
    queryKey: ["companies"],
    queryFn: () => base44.entities.Company.list(),
  });

  const { data: lines = [] } = useQuery({
    queryKey: ["lines"],
    queryFn: () => base44.entities.Line.list(),
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

  const visibleUsers = useMemo(() => {
    if (!user) return [];

    if (user.user_type === "superAdmin") {
      return allUsers;
    }

    if (user.user_type === "admin") {
      const assignedCompanyIds = user.assigned_company_ids || [];
      return allUsers.filter(u => 
        u.id === user.id ||
        (u.company_id && assignedCompanyIds.includes(u.company_id))
      );
    }

    if (user.user_type === "manager") {
      return allUsers.filter(u => 
        u.id === user.id ||
        (u.company_id === user.company_id && u.user_type === "technician")
      );
    }

    return [];
  }, [user, allUsers]);

  const getDateRange = (rangeType) => {
    const now = new Date();
    let fromDate = null;
    let toDate = null;

    switch (rangeType) {
      case "thisWeek":
        fromDate = startOfWeek(now, { weekStartsOn: 1 });
        toDate = endOfWeek(now, { weekStartsOn: 1 });
        break;
      case "lastWeek":
        const lastWeek = subDays(now, 7);
        fromDate = startOfWeek(lastWeek, { weekStartsOn: 1 });
        toDate = endOfWeek(lastWeek, { weekStartsOn: 1 });
        break;
      case "lastMonth":
        const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        fromDate = startOfMonth(lastMonth);
        toDate = endOfMonth(lastMonth);
        break;
      case "last30Days":
        fromDate = subDays(now, 30);
        toDate = now;
        break;
      case "all":
      default:
        return { fromDate: null, toDate: null };
    }

    return { fromDate, toDate };
  };

  const filteredLogs = useMemo(() => {
    if (!user) return [];

    let logs = allLogs;

    if (user.user_type === "superAdmin") {
      logs = logs;
    } else if (user.user_type === "admin") {
      const assignedCompanyIds = user.assigned_company_ids || [];
      logs = logs.filter(log => {
        if (!log.company_id) return true;
        return assignedCompanyIds.includes(log.company_id);
      });
    } else if (user.user_type === "manager") {
      logs = logs.filter(log => 
        !log.company_id || log.company_id === user.company_id
      );
    } else {
      return [];
    }

    if (entityTypeFilter !== "all") {
      logs = logs.filter(log => log.entity_type === entityTypeFilter);
    }

    if (userFilter !== "all") {
      logs = logs.filter(log => log.changed_by === userFilter);
    }

    if (searchQuery.trim()) {
      logs = logs.filter(log =>
        log.change_description.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (dateRangeFilter !== "all") {
      const { fromDate, toDate } = getDateRange(dateRangeFilter);
      if (fromDate && toDate) {
        logs = logs.filter(log => {
          const logDate = new Date(log.created_date);
          return logDate >= fromDate && logDate <= toDate;
        });
      }
    }

    return logs;
  }, [allLogs, user, entityTypeFilter, userFilter, searchQuery, dateRangeFilter]);

  // Monitoring uživatelů - filtrovaný seznam
  const monitoredUsers = useMemo(() => {
    if (monitoringUserFilter === "all") return visibleUsers;
    return visibleUsers.filter(u => u.email === monitoringUserFilter);
  }, [visibleUsers, monitoringUserFilter]);

  // Funkce pro určení aktivity statusu
  const getUserActivityStatus = (lastActiveAt) => {
    if (!lastActiveAt) return { status: "unknown", label: "Nikdy nepřihlášen", color: "text-slate-400" };
    
    const now = new Date();
    const lastActive = new Date(lastActiveAt);
    const minutesAgo = (now - lastActive) / (1000 * 60);
    
    if (minutesAgo < 5) {
      return { status: "online", label: "Online", color: "text-green-600", bgColor: "bg-green-100", borderColor: "border-green-300" };
    } else if (minutesAgo < 60) {
      return { status: "recent", label: "Nedávno aktivní", color: "text-blue-600", bgColor: "bg-blue-100", borderColor: "border-blue-300" };
    } else {
      return { status: "offline", label: "Offline", color: "text-slate-600", bgColor: "bg-slate-100", borderColor: "border-slate-300" };
    }
  };

  // Získat poslední aktivitu z audit logu pro každého uživatele
  const getUserLastActivity = (userEmail) => {
    const userLogs = allLogs.filter(log => log.changed_by === userEmail);
    if (userLogs.length === 0) return null;
    return userLogs[0];
  };

  if (user && user.user_type === "technician") {
    return (
      <div className="p-4 md:p-8 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
        <div className="max-w-7xl mx-auto">
          <Card className="border-orange-200 bg-orange-50">
            <CardContent className="p-12 text-center">
              <Activity className="w-16 h-16 text-orange-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-900 mb-2">
                Nemáte oprávnění k audit logu
              </h3>
              <p className="text-slate-600">
                Audit log je dostupný pouze pro vedoucí a vyšší úrovně.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const getEntityTypeBadge = (entityType) => {
    const colors = {
      Company: "bg-purple-100 text-purple-700",
      Line: "bg-blue-100 text-blue-700",
      Machine: "bg-green-100 text-green-700",
      ControlPoint: "bg-yellow-100 text-yellow-700",
      Issue: "bg-orange-100 text-orange-700",
      User: "bg-pink-100 text-pink-700",
      Auth: "bg-slate-100 text-slate-700",
    };

    const labels = {
      Company: "Podnik",
      Line: "Linka",
      Machine: "Stroj",
      ControlPoint: "Kontrolní bod",
      Issue: "Závada",
      User: "Uživatel",
      Auth: "Autentizace",
    };

    return (
      <Badge className={colors[entityType] || "bg-slate-100 text-slate-700"}>
        {labels[entityType] || entityType}
      </Badge>
    );
  };

  const oldestLogDate = allLogs.length > 0 
    ? new Date(Math.min(...allLogs.map(log => new Date(log.created_date))))
    : null;

  const canAccessMonitoring = user && (user.user_type === "admin" || user.user_type === "superAdmin" || user.user_type === "manager");

  return (
    <div className="p-4 md:p-8 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Audit Log</h1>
          <p className="text-slate-600">
            Historie všech změn a aktivit v systému
            {user?.user_type === "manager" && " (pouze váš podnik)"}
            {user?.user_type === "admin" && " (pouze vaše přiřazené podniky)"}
          </p>
        </div>

        <Card className="mb-6 border-blue-200 bg-blue-50">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-blue-900 font-medium mb-1">
                  Uchování záznamů: 2 měsíce
                </p>
                <p className="text-xs text-blue-800">
                  Starší záznamy jsou automaticky mazány pro úsporu serverového prostoru.
                  {oldestLogDate && ` Nejstarší záznam: ${format(oldestLogDate, "d. M. yyyy", { locale: cs })}`}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="history" className="space-y-6">
          <TabsList className={`bg-white shadow-sm ${canAccessMonitoring ? 'grid w-full grid-cols-2' : ''}`}>
            <TabsTrigger value="history" className="gap-2">
              <Activity className="w-4 h-4" />
              Historie aktivit
            </TabsTrigger>
            {canAccessMonitoring && (
              <TabsTrigger value="monitoring" className="gap-2">
                <Users className="w-4 h-4" />
                Monitoring uživatelů
              </TabsTrigger>
            )}
          </TabsList>

          {/* Historie aktivit */}
          <TabsContent value="history" className="space-y-6">
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Filter className="w-5 h-5" />
                  Filtry
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <Label htmlFor="entityType">Typ entity</Label>
                    <Select value={entityTypeFilter} onValueChange={setEntityTypeFilter}>
                      <SelectTrigger id="entityType">
                        <SelectValue placeholder="Všechny typy" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Všechny typy</SelectItem>
                        <SelectItem value="Company">Podniky</SelectItem>
                        <SelectItem value="Line">Linky</SelectItem>
                        <SelectItem value="Machine">Stroje</SelectItem>
                        <SelectItem value="ControlPoint">Kontrolní body</SelectItem>
                        <SelectItem value="Issue">Závady</SelectItem>
                        <SelectItem value="User">Uživatelé</SelectItem>
                        <SelectItem value="Auth">Autentizace</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="userFilter">Uživatel</Label>
                    <Select value={userFilter} onValueChange={setUserFilter}>
                      <SelectTrigger id="userFilter">
                        <SelectValue placeholder="Všichni uživatelé" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">
                          <div className="flex items-center gap-2">
                            <UserIcon className="w-4 h-4" />
                            Všichni uživatelé
                          </div>
                        </SelectItem>
                        {visibleUsers
                          .sort((a, b) => {
                            const roleOrder = { superAdmin: 0, admin: 1, manager: 2, technician: 3 };
                            const aOrder = roleOrder[a.user_type] || 999;
                            const bOrder = roleOrder[b.user_type] || 999;
                            if (aOrder !== bOrder) return aOrder - bOrder;
                            return (a.custom_display_name || a.full_name || a.email).localeCompare(
                              b.custom_display_name || b.full_name || b.email
                            );
                          })
                          .map((u) => (
                            <SelectItem key={u.id} value={u.email}>
                              <div className="flex items-center gap-2">
                                <UserIcon className="w-4 h-4" />
                                <span className="flex-1">{getUserDisplayName(u.email)}</span>
                                <Badge variant="outline" className="text-xs ml-2">
                                  {u.user_type === "superAdmin" ? "Super Admin" : 
                                   u.user_type === "admin" ? "Admin" :
                                   u.user_type === "manager" ? "Vedoucí" : "Technik"}
                                </Badge>
                              </div>
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="dateRange">Časové období</Label>
                    <Select value={dateRangeFilter} onValueChange={setDateRangeFilter}>
                      <SelectTrigger id="dateRange">
                        <SelectValue placeholder="Vyberte období" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            Vše (poslední 2 měsíce)
                          </div>
                        </SelectItem>
                        <SelectItem value="thisWeek">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            Tento týden
                          </div>
                        </SelectItem>
                        <SelectItem value="lastWeek">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            Minulý týden
                          </div>
                        </SelectItem>
                        <SelectItem value="last30Days">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            Posledních 30 dní
                          </div>
                        </SelectItem>
                        <SelectItem value="lastMonth">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            Minulý měsíc
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="search">Hledat v popisu</Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input
                        id="search"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Vyhledat..."
                        className="pl-10"
                      />
                    </div>
                  </div>
                </div>

                {(entityTypeFilter !== "all" || userFilter !== "all" || searchQuery || dateRangeFilter !== "all") && (
                  <div className="mt-4">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setEntityTypeFilter("all");
                        setUserFilter("all");
                        setSearchQuery("");
                        setDateRangeFilter("all");
                      }}
                    >
                      Vymazat filtry
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="shadow-lg">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="w-5 h-5" />
                    Historie aktivit
                  </CardTitle>
                  <Badge variant="outline" className="text-base">
                    {filteredLogs.length} záznamů
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
                  </div>
                ) : filteredLogs.length === 0 ? (
                  <div className="text-center py-12">
                    <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">
                      Žádné záznamy
                    </h3>
                    <p className="text-slate-500">
                      {allLogs.length === 0 
                        ? "Zatím nebyly zaznamenány žádné aktivity"
                        : "Žádné záznamy odpovídající vybraným filtrům"
                      }
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredLogs.map((log) => (
                      <div
                        key={log.id}
                        className="flex items-start gap-4 p-4 rounded-lg border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all"
                      >
                        <div className="flex-shrink-0 mt-1">
                          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                            <Activity className="w-5 h-5 text-blue-600" />
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            {getEntityTypeBadge(log.entity_type)}
                            {log.user_type && (
                              <Badge variant="outline" className="text-xs">
                                {log.user_type === "superAdmin" ? "Super Admin" : 
                                 log.user_type === "admin" ? "Admin" :
                                 log.user_type === "manager" ? "Vedoucí" : "Technik"}
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-slate-900 mb-2">
                            {log.change_description}
                          </p>
                          <div className="flex items-center gap-4 text-xs text-slate-500">
                            <span className="flex items-center gap-1">
                              <UserIcon className="w-3 h-3" />
                              {getUserDisplayName(log.changed_by)}
                            </span>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {format(new Date(log.created_date), "d. M. yyyy HH:mm:ss", { locale: cs })}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Monitoring uživatelů */}
          {canAccessMonitoring && (
            <TabsContent value="monitoring" className="space-y-6">
              <Card className="shadow-lg">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Filter className="w-5 h-5" />
                      Filtr uživatelů
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="monitoringUserFilter">Uživatel</Label>
                      <Select value={monitoringUserFilter} onValueChange={setMonitoringUserFilter}>
                        <SelectTrigger id="monitoringUserFilter">
                          <SelectValue placeholder="Všichni uživatelé" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">
                            <div className="flex items-center gap-2">
                              <Users className="w-4 h-4" />
                              Všichni uživatelé ({visibleUsers.length})
                            </div>
                          </SelectItem>
                          {visibleUsers
                            .sort((a, b) => {
                              const roleOrder = { superAdmin: 0, admin: 1, manager: 2, technician: 3 };
                              const aOrder = roleOrder[a.user_type] || 999;
                              const bOrder = roleOrder[b.user_type] || 999;
                              if (aOrder !== bOrder) return aOrder - bOrder;
                              return (a.custom_display_name || a.full_name || a.email).localeCompare(
                                b.custom_display_name || b.full_name || b.email
                              );
                            })
                            .map((u) => (
                              <SelectItem key={u.id} value={u.email}>
                                <div className="flex items-center gap-2">
                                  <UserIcon className="w-4 h-4" />
                                  <span className="flex-1">{getUserDisplayName(u.email)}</span>
                                  <Badge variant="outline" className="text-xs ml-2">
                                    {u.user_type === "superAdmin" ? "Super Admin" : 
                                     u.user_type === "admin" ? "Admin" :
                                     u.user_type === "manager" ? "Vedoucí" : "Technik"}
                                  </Badge>
                                </div>
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {monitoringUserFilter !== "all" && (
                      <div className="flex items-end">
                        <Button
                          variant="outline"
                          onClick={() => setMonitoringUserFilter("all")}
                        >
                          Zobrazit všechny
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-lg">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Users className="w-5 h-5" />
                      Aktivita uživatelů
                    </CardTitle>
                    <Badge variant="outline" className="text-base">
                      {monitoredUsers.length} uživatelů
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
                    </div>
                  ) : monitoredUsers.length === 0 ? (
                    <div className="text-center py-12">
                      <Users className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                      <h3 className="text-lg font-semibold text-slate-900 mb-2">
                        Žádní uživatelé
                      </h3>
                      <p className="text-slate-500">
                        Zatím nejsou žádní uživatelé ke sledování
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {monitoredUsers
                        .sort((a, b) => {
                          // Seřadit podle poslední aktivity
                          const aTime = a.last_active_at ? new Date(a.last_active_at).getTime() : 0;
                          const bTime = b.last_active_at ? new Date(b.last_active_at).getTime() : 0;
                          return bTime - aTime;
                        })
                        .map((monitoredUser) => {
                          const activityStatus = getUserActivityStatus(monitoredUser.last_active_at);
                          const lastActivity = getUserLastActivity(monitoredUser.email);

                          return (
                            <Card
                              key={monitoredUser.id}
                              className={`border-l-4 ${activityStatus.borderColor}`}
                            >
                              <CardContent className="p-4">
                                <div className="flex items-start gap-4">
                                  <div className="flex-shrink-0">
                                    <div className="w-14 h-14 bg-gradient-to-br from-slate-400 to-slate-500 rounded-full flex items-center justify-center text-white font-bold text-lg relative">
                                      {(monitoredUser.custom_display_name || monitoredUser.full_name)?.[0] || "?"}
                                      {activityStatus.status === "online" && (
                                        <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 rounded-full border-2 border-white flex items-center justify-center">
                                          <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                                        </div>
                                      )}
                                      {activityStatus.status === "offline" && (
                                        <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-slate-400 rounded-full border-2 border-white flex items-center justify-center">
                                          <WifiOff className="w-3 h-3 text-white" />
                                        </div>
                                      )}
                                      {activityStatus.status === "recent" && (
                                        <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-blue-500 rounded-full border-2 border-white flex items-center justify-center">
                                          <Clock className="w-3 h-3 text-white" />
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                                      <h3 className="font-bold text-slate-900 text-base">
                                        {getUserDisplayName(monitoredUser.email)}
                                      </h3>
                                      <Badge className={`${activityStatus.bgColor} ${activityStatus.color} border-0`}>
                                        {activityStatus.status === "online" && <Wifi className="w-3 h-3 mr-1" />}
                                        {activityStatus.status === "offline" && <WifiOff className="w-3 h-3 mr-1" />}
                                        {activityStatus.status === "recent" && <Clock className="w-3 h-3 mr-1" />}
                                        {activityStatus.label}
                                      </Badge>
                                      <Badge variant="outline" className="text-xs">
                                        {monitoredUser.user_type === "superAdmin" ? "Super Admin" : 
                                         monitoredUser.user_type === "admin" ? "Admin" :
                                         monitoredUser.user_type === "manager" ? "Vedoucí" : "Technik"}
                                      </Badge>
                                    </div>

                                    <p className="text-sm text-slate-600 mb-2">{monitoredUser.email}</p>

                                    <div className="space-y-2">
                                      {monitoredUser.last_active_at ? (
                                        <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                                          <div className="flex items-center gap-2 mb-1">
                                            <Clock className="w-4 h-4 text-slate-600" />
                                            <p className="text-xs font-semibold text-slate-700">Naposledy aktivní:</p>
                                          </div>
                                          <p className="text-sm text-slate-900 font-medium">
                                            {format(new Date(monitoredUser.last_active_at), "d. M. yyyy HH:mm:ss", { locale: cs })}
                                          </p>
                                          <p className="text-xs text-slate-500 mt-1">
                                            {formatDistanceToNow(new Date(monitoredUser.last_active_at), { 
                                              addSuffix: true, 
                                              locale: cs 
                                            })}
                                          </p>
                                        </div>
                                      ) : (
                                        <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                                          <div className="flex items-center gap-2">
                                            <AlertCircle className="w-4 h-4 text-slate-400" />
                                            <p className="text-sm text-slate-500 italic">
                                              Zatím žádná aktivita nezaznamenána
                                            </p>
                                          </div>
                                        </div>
                                      )}

                                      {lastActivity && (
                                        <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                                          <div className="flex items-center gap-2 mb-1">
                                            <Activity className="w-4 h-4 text-blue-600" />
                                            <p className="text-xs font-semibold text-blue-900">Poslední akce v systému:</p>
                                          </div>
                                          <p className="text-xs text-blue-800 mb-1">
                                            {lastActivity.change_description}
                                          </p>
                                          <div className="flex items-center gap-2">
                                            {getEntityTypeBadge(lastActivity.entity_type)}
                                            <span className="text-xs text-blue-600">
                                              {format(new Date(lastActivity.created_date), "d. M. yyyy HH:mm", { locale: cs })}
                                            </span>
                                          </div>
                                        </div>
                                      )}
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

              {/* Legenda */}
              <Card className="shadow-lg border-2 border-blue-200 bg-blue-50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <AlertCircle className="w-5 h-5 text-blue-700" />
                    Legenda statusů
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="flex items-center gap-3 bg-white p-3 rounded-lg border border-green-200">
                      <Wifi className="w-5 h-5 text-green-600" />
                      <div>
                        <p className="text-sm font-semibold text-slate-900">Online</p>
                        <p className="text-xs text-slate-600">Aktivní do 5 minut</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 bg-white p-3 rounded-lg border border-blue-200">
                      <Clock className="w-5 h-5 text-blue-600" />
                      <div>
                        <p className="text-sm font-semibold text-slate-900">Nedávno aktivní</p>
                        <p className="text-xs text-slate-600">Aktivní do 1 hodiny</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 bg-white p-3 rounded-lg border border-slate-200">
                      <WifiOff className="w-5 h-5 text-slate-600" />
                      <div>
                        <p className="text-sm font-semibold text-slate-900">Offline</p>
                        <p className="text-xs text-slate-600">Déle než 1 hodina</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-4 bg-white p-3 rounded-lg border border-blue-200">
                    <p className="text-xs text-blue-900">
                      <strong>ℹ️ Poznámka:</strong> Systém zatím automaticky neaktualizuje "naposledy aktivní" status.
                      Pro implementaci automatického sledování aktivity je potřeba rozšířit aplikaci o pravidelnou aktualizaci při každé interakci uživatele.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
}