import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
} from "lucide-react";
import { format } from "date-fns";
import { cs } from "date-fns/locale";

export default function AuditLog() {
  const [user, setUser] = useState(null);
  const [entityTypeFilter, setEntityTypeFilter] = useState("all");
  const [userFilter, setUserFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    const currentUser = await base44.auth.me();
    setUser(currentUser);
  };

  const { data: allLogs = [], isLoading } = useQuery({
    queryKey: ["auditLogs"],
    queryFn: () => base44.entities.AuditLog.list("-created_date", 500),
    enabled: !!user,
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ["allUsers"],
    queryFn: () => base44.entities.User.list(),
  });

  const { data: companies = [] } = useQuery({
    queryKey: ["companies"],
    queryFn: () => base44.entities.Company.list(),
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

  // Hierarchické filtrování logů podle role uživatele
  const filteredLogs = useMemo(() => {
    if (!user) return [];

    let logs = allLogs;

    // Filtrování podle hierarchie - každý vidí aktivity uživatelů pod ním
    if (user.user_type === "superAdmin") {
      // SuperAdmin vidí vše
      logs = logs;
    } else if (user.user_type === "admin") {
      // Admin vidí pouze logy z přiřazených podniků
      const assignedCompanyIds = user.assigned_company_ids || [];
      logs = logs.filter(log => 
        !log.company_id || assignedCompanyIds.includes(log.company_id)
      );
    } else if (user.user_type === "manager") {
      // Manager vidí pouze logy ze svého podniku
      logs = logs.filter(log => 
        !log.company_id || log.company_id === user.company_id
      );
    } else {
      // Technician nevidí audit log
      return [];
    }

    // Filtrování podle typu entity
    if (entityTypeFilter !== "all") {
      logs = logs.filter(log => log.entity_type === entityTypeFilter);
    }

    // Filtrování podle uživatele
    if (userFilter.trim()) {
      logs = logs.filter(log => 
        log.changed_by.toLowerCase().includes(userFilter.toLowerCase())
      );
    }

    // Textové vyhledávání v popisu
    if (searchQuery.trim()) {
      logs = logs.filter(log =>
        log.change_description.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Filtrování podle data
    if (dateFrom) {
      const fromDate = new Date(dateFrom);
      fromDate.setHours(0, 0, 0, 0);
      logs = logs.filter(log => new Date(log.created_date) >= fromDate);
    }

    if (dateTo) {
      const toDate = new Date(dateTo);
      toDate.setHours(23, 59, 59, 999);
      logs = logs.filter(log => new Date(log.created_date) <= toDate);
    }

    return logs;
  }, [allLogs, user, entityTypeFilter, userFilter, searchQuery, dateFrom, dateTo]);

  // Pokud uživatel není oprávněn
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

        {/* Filtry */}
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
                <div className="relative">
                  <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    id="userFilter"
                    value={userFilter}
                    onChange={(e) => setUserFilter(e.target.value)}
                    placeholder="Email uživatele..."
                    className="pl-10"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="dateFrom">Od data</Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    id="dateFrom"
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="dateTo">Do data</Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    id="dateTo"
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
            </div>

            <div className="mt-4">
              <Label htmlFor="search">Hledat v popisu</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  id="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Vyhledat v popisu změny..."
                  className="pl-10"
                />
              </div>
            </div>

            {(entityTypeFilter !== "all" || userFilter || searchQuery || dateFrom || dateTo) && (
              <div className="mt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setEntityTypeFilter("all");
                    setUserFilter("");
                    setSearchQuery("");
                    setDateFrom("");
                    setDateTo("");
                  }}
                >
                  Vymazat filtry
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Výsledky */}
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
      </div>
    </div>
  );
}