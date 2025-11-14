import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Users,
  Wifi,
  WifiOff,
  Clock,
  AlertCircle,
  Activity,
  Search,
  Filter,
  Crown,
  Shield,
  User,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { cs } from "date-fns/locale";

export default function UserMonitoring() {
  const [currentUser, setCurrentUser] = useState(null);
  const [userFilter, setUserFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    loadCurrentUser();
  }, []);

  const loadCurrentUser = async () => {
    const user = await base44.auth.me();
    setCurrentUser(user);
  };

  const { data: allUsers = [], isLoading, refetch } = useQuery({
    queryKey: ["allUsers"],
    queryFn: () => base44.entities.User.list("-last_active_at"),
    refetchInterval: 30000,
  });

  const { data: allCompanies = [] } = useQuery({
    queryKey: ["companies"],
    queryFn: () => base44.entities.Company.list(),
  });

  const { data: auditLogs = [] } = useQuery({
    queryKey: ["auditLogs"],
    queryFn: () => base44.entities.AuditLog.list("-created_date", 500),
  });

  const visibleUsers = useMemo(() => {
    if (!currentUser) return [];

    if (currentUser.user_type === "superAdmin") {
      return allUsers;
    }

    if (currentUser.user_type === "admin") {
      const assignedCompanyIds = currentUser.assigned_company_ids || [];
      return allUsers.filter(u => 
        u.id === currentUser.id ||
        (u.company_id && assignedCompanyIds.includes(u.company_id))
      );
    }

    return [];
  }, [currentUser, allUsers]);

  const getUserDisplayName = (userObj) => {
    if (!userObj) return "Neznámý";
    return userObj.custom_display_name || userObj.full_name || userObj.email;
  };

  const getCompanyName = (companyId) => {
    if (!companyId) return "Není přiřazen";
    const company = allCompanies.find(c => c.id === companyId);
    return company ? company.name : "Neznámý podnik";
  };

  const getUserActivityStatus = (lastActiveAt) => {
    if (!lastActiveAt) return { 
      status: "unknown", 
      label: "Nikdy nepřihlášen", 
      color: "text-slate-400",
      bgColor: "bg-slate-100",
      borderColor: "border-slate-300",
      icon: AlertCircle
    };
    
    const now = new Date();
    const lastActive = new Date(lastActiveAt);
    const minutesAgo = (now - lastActive) / (1000 * 60);
    
    if (minutesAgo < 5) {
      return { 
        status: "online", 
        label: "Online", 
        color: "text-green-600", 
        bgColor: "bg-green-100", 
        borderColor: "border-green-300",
        icon: Wifi
      };
    } else if (minutesAgo < 60) {
      return { 
        status: "recent", 
        label: "Nedávno aktivní", 
        color: "text-blue-600", 
        bgColor: "bg-blue-100", 
        borderColor: "border-blue-300",
        icon: Clock
      };
    } else {
      return { 
        status: "offline", 
        label: "Offline", 
        color: "text-slate-600", 
        bgColor: "bg-slate-100", 
        borderColor: "border-slate-300",
        icon: WifiOff
      };
    }
  };

  const getUserLastAuditAction = (userEmail) => {
    const userLogs = auditLogs.filter(log => log.changed_by === userEmail);
    if (userLogs.length === 0) return null;
    return userLogs[0];
  };

  const filteredUsers = useMemo(() => {
    let users = visibleUsers;

    if (userFilter !== "all") {
      users = users.filter(u => u.email === userFilter);
    }

    if (roleFilter !== "all") {
      users = users.filter(u => u.user_type === roleFilter);
    }

    if (statusFilter !== "all") {
      users = users.filter(u => {
        const status = getUserActivityStatus(u.last_active_at).status;
        return status === statusFilter;
      });
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      users = users.filter(u =>
        (u.custom_display_name || u.full_name || "").toLowerCase().includes(query) ||
        u.email.toLowerCase().includes(query)
      );
    }

    return users;
  }, [visibleUsers, userFilter, roleFilter, statusFilter, searchQuery]);

  const stats = useMemo(() => {
    const online = filteredUsers.filter(u => getUserActivityStatus(u.last_active_at).status === "online").length;
    const recent = filteredUsers.filter(u => getUserActivityStatus(u.last_active_at).status === "recent").length;
    const offline = filteredUsers.filter(u => getUserActivityStatus(u.last_active_at).status === "offline").length;
    const unknown = filteredUsers.filter(u => getUserActivityStatus(u.last_active_at).status === "unknown").length;

    return { online, recent, offline, unknown };
  }, [filteredUsers]);

  const getUserTypeBadge = (type) => {
    switch (type) {
      case "superAdmin":
        return (
          <Badge className="bg-purple-100 text-purple-800 gap-1">
            <Crown className="w-3 h-3" />
            Super Admin
          </Badge>
        );
      case "admin":
        return (
          <Badge className="bg-red-100 text-red-800 gap-1">
            <Crown className="w-3 h-3" />
            Admin
          </Badge>
        );
      case "manager":
        return (
          <Badge className="bg-blue-100 text-blue-800 gap-1">
            <Shield className="w-3 h-3" />
            Vedoucí
          </Badge>
        );
      case "technician":
        return (
          <Badge className="bg-slate-100 text-slate-800 gap-1">
            <User className="w-3 h-3" />
            Technik
          </Badge>
        );
      default:
        return <Badge variant="outline">Neurčeno</Badge>;
    }
  };

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

  if (!currentUser || (currentUser.user_type !== "admin" && currentUser.user_type !== "superAdmin")) {
    return (
      <div className="p-4 md:p-8 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
        <div className="max-w-7xl mx-auto">
          <Card className="border-orange-200 bg-orange-50">
            <CardContent className="p-12 text-center">
              <Users className="w-16 h-16 text-orange-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-900 mb-2">
                Nemáte oprávnění k monitoringu uživatelů
              </h3>
              <p className="text-slate-600">
                Tato funkce je dostupná pouze pro administrátory a super administrátory.
              </p>
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
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 mb-2">Monitoring uživatelů</h1>
              <p className="text-slate-600">
                Sledování aktivity a online statusu uživatelů v reálném čase
              </p>
            </div>
            <Button
              onClick={() => refetch()}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Aktualizovat
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card className="border-none shadow-lg bg-gradient-to-br from-green-500 to-green-600 text-white">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-green-100 text-sm font-medium mb-1">Online</p>
                  <p className="text-4xl font-bold">{stats.online}</p>
                  <p className="text-green-100 text-xs mt-2">Aktivní do 5 min</p>
                </div>
                <div className="p-3 bg-white/20 rounded-xl">
                  <Wifi className="w-6 h-6" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-lg bg-gradient-to-br from-blue-500 to-blue-600 text-white">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-blue-100 text-sm font-medium mb-1">Nedávno aktivní</p>
                  <p className="text-4xl font-bold">{stats.recent}</p>
                  <p className="text-blue-100 text-xs mt-2">Do 1 hodiny</p>
                </div>
                <div className="p-3 bg-white/20 rounded-xl">
                  <Clock className="w-6 h-6" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-lg bg-gradient-to-br from-slate-500 to-slate-600 text-white">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-slate-100 text-sm font-medium mb-1">Offline</p>
                  <p className="text-4xl font-bold">{stats.offline}</p>
                  <p className="text-slate-100 text-xs mt-2">Déle než 1 h</p>
                </div>
                <div className="p-3 bg-white/20 rounded-xl">
                  <WifiOff className="w-6 h-6" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-lg bg-gradient-to-br from-orange-500 to-orange-600 text-white">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-orange-100 text-sm font-medium mb-1">Celkem</p>
                  <p className="text-4xl font-bold">{filteredUsers.length}</p>
                  <p className="text-orange-100 text-xs mt-2">Sledovaných uživatelů</p>
                </div>
                <div className="p-3 bg-white/20 rounded-xl">
                  <Users className="w-6 h-6" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="mb-6 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Filter className="w-5 h-5" />
              Filtry
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <Label htmlFor="search">Vyhledat</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    id="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Jméno nebo email..."
                    className="pl-10"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="roleFilter">Role</Label>
                <Select value={roleFilter} onValueChange={setRoleFilter}>
                  <SelectTrigger id="roleFilter">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Všechny role</SelectItem>
                    <SelectItem value="superAdmin">
                      <div className="flex items-center gap-2">
                        <Crown className="w-4 h-4" />
                        Super Administrátor
                      </div>
                    </SelectItem>
                    <SelectItem value="admin">
                      <div className="flex items-center gap-2">
                        <Crown className="w-4 h-4" />
                        Administrátor
                      </div>
                    </SelectItem>
                    <SelectItem value="manager">
                      <div className="flex items-center gap-2">
                        <Shield className="w-4 h-4" />
                        Vedoucí
                      </div>
                    </SelectItem>
                    <SelectItem value="technician">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4" />
                        Technik
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="statusFilter">Status aktivity</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger id="statusFilter">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Všechny statusy</SelectItem>
                    <SelectItem value="online">
                      <div className="flex items-center gap-2">
                        <Wifi className="w-4 h-4 text-green-600" />
                        Online
                      </div>
                    </SelectItem>
                    <SelectItem value="recent">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-blue-600" />
                        Nedávno aktivní
                      </div>
                    </SelectItem>
                    <SelectItem value="offline">
                      <div className="flex items-center gap-2">
                        <WifiOff className="w-4 h-4 text-slate-600" />
                        Offline
                      </div>
                    </SelectItem>
                    <SelectItem value="unknown">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-slate-400" />
                        Nikdy nepřihlášen
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-end">
                {(roleFilter !== "all" || statusFilter !== "all" || searchQuery.trim()) && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setRoleFilter("all");
                      setStatusFilter("all");
                      setSearchQuery("");
                    }}
                  >
                    Vymazat filtry
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6 shadow-lg border-2 border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertCircle className="w-5 h-5 text-blue-700" />
              Legenda statusů
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
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
              <div className="flex items-center gap-3 bg-white p-3 rounded-lg border border-slate-200">
                <AlertCircle className="w-5 h-5 text-slate-400" />
                <div>
                  <p className="text-sm font-semibold text-slate-900">Nikdy nepřihlášen</p>
                  <p className="text-xs text-slate-600">Bez aktivity</p>
                </div>
              </div>
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
                {filteredUsers.length} uživatelů
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="text-center py-12">
                <Users className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-slate-900 mb-2">
                  Žádní uživatelé
                </h3>
                <p className="text-slate-500">
                  {visibleUsers.length === 0
                    ? "Zatím nejsou žádní uživatelé ke sledování"
                    : "Žádní uživatelé odpovídající vybraným filtrům"}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredUsers.map((monitoredUser) => {
                  const activityStatus = getUserActivityStatus(monitoredUser.last_active_at);
                  const lastAuditAction = getUserLastAuditAction(monitoredUser.email);
                  const StatusIcon = activityStatus.icon;

                  return (
                    <Card
                      key={monitoredUser.id}
                      className={`border-l-4 ${activityStatus.borderColor} transition-all hover:shadow-md`}
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
                              {activityStatus.status === "unknown" && (
                                <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-slate-300 rounded-full border-2 border-white flex items-center justify-center">
                                  <AlertCircle className="w-3 h-3 text-white" />
                                </div>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                              <h3 className="font-bold text-slate-900 text-base">
                                {getUserDisplayName(monitoredUser)}
                              </h3>
                              <Badge className={`${activityStatus.bgColor} ${activityStatus.color} border-0 gap-1`}>
                                <StatusIcon className="w-3 h-3" />
                                {activityStatus.label}
                              </Badge>
                              {getUserTypeBadge(monitoredUser.user_type)}
                            </div>

                            <div className="space-y-2">
                              <div className="flex items-center gap-4 text-sm text-slate-600 flex-wrap">
                                <span>{monitoredUser.email}</span>
                                {monitoredUser.phone && (
                                  <>
                                    <span>•</span>
                                    <span>{monitoredUser.phone}</span>
                                  </>
                                )}
                              </div>

                              <div className="flex items-center gap-4 text-sm text-slate-600">
                                <span>
                                  Podnik: {monitoredUser.user_type === "superAdmin" 
                                    ? <span className="italic text-slate-400">Všechny podniky</span>
                                    : monitoredUser.user_type === "admin"
                                    ? <span className="italic text-slate-400">Přiřazené podniky</span>
                                    : getCompanyName(monitoredUser.company_id)
                                  }
                                </span>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
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
                                        Zatím žádná aktivita
                                      </p>
                                    </div>
                                  </div>
                                )}

                                {lastAuditAction && (
                                  <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                                    <div className="flex items-center gap-2 mb-1">
                                      <Activity className="w-4 h-4 text-blue-600" />
                                      <p className="text-xs font-semibold text-blue-900">Poslední akce:</p>
                                    </div>
                                    <p className="text-xs text-blue-800 mb-1 line-clamp-2">
                                      {lastAuditAction.change_description}
                                    </p>
                                    <div className="flex items-center gap-2 flex-wrap">
                                      {getEntityTypeBadge(lastAuditAction.entity_type)}
                                      <span className="text-xs text-blue-600">
                                        {format(new Date(lastAuditAction.created_date), "d. M. HH:mm", { locale: cs })}
                                      </span>
                                    </div>
                                  </div>
                                )}
                              </div>
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

        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <RefreshCw className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-blue-900 font-medium mb-1">
                  Automatická aktualizace každých 30 sekund
                </p>
                <p className="text-xs text-blue-800">
                  Sledování aktivity probíhá automaticky. Status uživatele se aktualizuje při každém načtení stránky nebo navigaci v aplikaci (throttling 30s).
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}