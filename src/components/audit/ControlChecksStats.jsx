import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { CheckCircle, Search, Filter, Calendar, User as UserIcon, Loader2, FileText, X, Download } from "lucide-react";
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import { cs } from "date-fns/locale";

const RECORD_TYPE_LABELS = {
  lubrication: { label: "Mazání", color: "bg-blue-100 text-blue-700" },
  inspection: { label: "Inspekce", color: "bg-green-100 text-green-700" },
  lubricator_change: { label: "Výměna maznice", color: "bg-orange-100 text-orange-700" },
  prevention: { label: "Prevence", color: "bg-purple-100 text-purple-700" },
};

export default function ControlChecksStats({ visibleUsers, getUserDisplayName, currentUser }) {
  const [lineFilter, setLineFilter] = useState("all");
  const [machineFilter, setMachineFilter] = useState("all");
  const [userFilter, setUserFilter] = useState("all");
  const [dateRangeFilter, setDateRangeFilter] = useState("last30Days");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: lines = [] } = useQuery({
    queryKey: ["allLines"],
    queryFn: () => base44.entities.Line.list(null, 1000),
    staleTime: 300000,
  });

  const { data: machines = [] } = useQuery({
    queryKey: ["allMachines"],
    queryFn: () => base44.entities.Machine.list(null, 1000),
    staleTime: 300000,
  });

  const { data: controlPoints = [] } = useQuery({
    queryKey: ["allControlPoints"],
    queryFn: () => base44.entities.ControlPoint.list(null, 1000),
    staleTime: 300000,
  });

  const { data: controlRecords = [], isLoading } = useQuery({
    queryKey: ["controlRecordsAll"],
    queryFn: () => base44.entities.ControlRecord.list("-performed_at", 5000),
    staleTime: 60000,
  });

  // Omezení dle podniku uživatele
  const visibleLines = useMemo(() => {
    if (!currentUser) return [];
    if (currentUser.user_type === "superAdmin") return lines;
    if (currentUser.user_type === "admin") {
      const assigned = currentUser.assigned_company_ids || [];
      return lines.filter(l => assigned.includes(l.company_id));
    }
    return lines.filter(l => l.company_id === currentUser.company_id);
  }, [lines, currentUser]);

  const visibleLineIds = useMemo(() => new Set(visibleLines.map(l => l.id)), [visibleLines]);

  const visibleMachines = useMemo(
    () => machines.filter(m => visibleLineIds.has(m.line_id)),
    [machines, visibleLineIds]
  );

  const visibleMachineIds = useMemo(() => new Set(visibleMachines.map(m => m.id)), [visibleMachines]);

  // Stroje filtrované dle linky
  const filteredMachines = useMemo(() => {
    if (lineFilter === "all") return visibleMachines;
    return visibleMachines.filter(m => m.line_id === lineFilter);
  }, [visibleMachines, lineFilter]);

  // Mapování kontrolních bodů → stroj → linka
  const cpToMachine = useMemo(() => Object.fromEntries(controlPoints.map(cp => [cp.id, cp.machine_id])), [controlPoints]);
  const machineToLine = useMemo(() => Object.fromEntries(machines.map(m => [m.id, m.line_id])), [machines]);
  const machineMap = useMemo(() => Object.fromEntries(machines.map(m => [m.id, m])), [machines]);
  const lineMap = useMemo(() => Object.fromEntries(lines.map(l => [l.id, l])), [lines]);
  const cpMap = useMemo(() => Object.fromEntries(controlPoints.map(cp => [cp.id, cp])), [controlPoints]);

  const getDateRange = (rangeType) => {
    const now = new Date();
    switch (rangeType) {
      case "today": return { from: new Date(now.setHours(0,0,0,0)), to: new Date() };
      case "thisWeek": return { from: startOfWeek(now, { weekStartsOn: 1 }), to: endOfWeek(now, { weekStartsOn: 1 }) };
      case "lastWeek": {
        const lw = subDays(now, 7);
        return { from: startOfWeek(lw, { weekStartsOn: 1 }), to: endOfWeek(lw, { weekStartsOn: 1 }) };
      }
      case "last30Days": return { from: subDays(now, 30), to: now };
      case "thisMonth": return { from: startOfMonth(now), to: endOfMonth(now) };
      case "lastMonth": {
        const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        return { from: startOfMonth(lm), to: endOfMonth(lm) };
      }
      default: return { from: null, to: null };
    }
  };

  const filteredRecords = useMemo(() => {
    // Pouze kontroly strojů z podniků uživatele
    let records = controlRecords.filter(r => {
      const machineId = cpToMachine[r.control_point_id];
      return machineId && visibleMachineIds.has(machineId);
    });

    // Časový filtr
    if (dateRangeFilter !== "all") {
      const { from, to } = getDateRange(dateRangeFilter);
      if (from && to) {
        records = records.filter(r => {
          const d = new Date(r.performed_at);
          return d >= from && d <= to;
        });
      }
    }

    // Filtr uživatele
    if (userFilter !== "all") {
      records = records.filter(r => r.created_by_id === userFilter || r.created_by === userFilter);
    }

    // Filtr linky
    if (lineFilter !== "all") {
      records = records.filter(r => {
        const machineId = cpToMachine[r.control_point_id];
        return machineId && machineToLine[machineId] === lineFilter;
      });
    }

    // Filtr stroje
    if (machineFilter !== "all") {
      records = records.filter(r => {
        const machineId = cpToMachine[r.control_point_id];
        return machineId === machineFilter;
      });
    }

    // Fulltextové hledání v popisu (note) a názvu kontrolního bodu
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      records = records.filter(r => {
        const cp = cpMap[r.control_point_id];
        return (
          r.note?.toLowerCase().includes(q) ||
          cp?.name?.toLowerCase().includes(q) ||
          cp?.description?.toLowerCase().includes(q)
        );
      });
    }

    return records;
  }, [controlRecords, dateRangeFilter, userFilter, lineFilter, machineFilter, searchQuery, cpToMachine, machineToLine, cpMap, visibleMachineIds]);

  const hasFilters = lineFilter !== "all" || machineFilter !== "all" || userFilter !== "all" || dateRangeFilter !== "last30Days" || searchQuery;

  const handleExport = () => {
    const BOM = "\uFEFF";
    const headers = ["Datum", "Typ kontroly", "Kontrolní bod", "Stroj", "Linka", "Uživatel", "Poznámka"];
    const rows = filteredRecords.map(record => {
      const cp = cpMap[record.control_point_id];
      const machineId = cp ? cpToMachine[cp.id] : null;
      const machine = machineId ? machineMap[machineId] : null;
      const line = machine ? lineMap[machineToLine[machine.id]] : null;
      const typeInfo = RECORD_TYPE_LABELS[record.record_type] || { label: record.record_type };
      const safe = (val) => `"${String(val || "").replace(/"/g, '""')}"`;
      return [
        safe(format(new Date(record.performed_at), "d. M. yyyy HH:mm", { locale: cs })),
        safe(typeInfo.label),
        safe(cp?.name || ""),
        safe(machine?.name || ""),
        safe(line?.name || ""),
        safe(getUserName(record)),
        safe(record.note || ""),
      ].join(";");
    });
    const csvContent = BOM + [headers.join(";"), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `statistiky_kontrol_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const clearFilters = () => {
    setLineFilter("all");
    setMachineFilter("all");
    setUserFilter("all");
    setDateRangeFilter("last30Days");
    setSearchQuery("");
  };

  const getUserName = (record) => {
    // created_by_id or created_by field
    const u = visibleUsers.find(u => u.id === record.created_by_id || u.email === record.created_by);
    if (u) return u.custom_display_name || u.full_name || u.email;
    return record.created_by || "—";
  };

  return (
    <div className="space-y-6">
      {/* Filtry */}
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Filter className="w-5 h-5" />
            Filtry
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {/* Linka */}
            <div>
              <Label>Linka</Label>
              <Select value={lineFilter} onValueChange={(v) => { setLineFilter(v); setMachineFilter("all"); }}>
                <SelectTrigger><SelectValue placeholder="Všechny linky" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Všechny linky</SelectItem>
                  {visibleLines.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Stroj */}
            <div>
              <Label>Stroj</Label>
              <Select value={machineFilter} onValueChange={setMachineFilter}>
                <SelectTrigger><SelectValue placeholder="Všechny stroje" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Všechny stroje</SelectItem>
                  {filteredMachines.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Uživatel */}
            <div>
              <Label>Uživatel</Label>
              <Select value={userFilter} onValueChange={setUserFilter}>
                <SelectTrigger><SelectValue placeholder="Všichni uživatelé" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Všichni uživatelé</SelectItem>
                  {visibleUsers.map(u => (
                    <SelectItem key={u.id} value={u.id}>
                      <div className="flex items-center gap-2">
                        <UserIcon className="w-3 h-3" />
                        {u.custom_display_name || u.full_name || u.email}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Časové období */}
            <div>
              <Label>Časové období</Label>
              <Select value={dateRangeFilter} onValueChange={setDateRangeFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Vše</SelectItem>
                  <SelectItem value="today">Dnes</SelectItem>
                  <SelectItem value="thisWeek">Tento týden</SelectItem>
                  <SelectItem value="lastWeek">Minulý týden</SelectItem>
                  <SelectItem value="last30Days">Posledních 30 dní</SelectItem>
                  <SelectItem value="thisMonth">Tento měsíc</SelectItem>
                  <SelectItem value="lastMonth">Minulý měsíc</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Hledat */}
            <div>
              <Label>Hledat v popisu</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Vyhledat..."
                  className="pl-10"
                />
              </div>
            </div>
          </div>

          {hasFilters && (
            <div className="mt-4">
              <Button variant="outline" size="sm" onClick={clearFilters} className="gap-2">
                <X className="w-3 h-3" /> Vymazat filtry
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Seznam kontrol */}
      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              Potvrzené kontroly
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-base">{filteredRecords.length} záznamů</Badge>
              <Button variant="outline" size="icon" onClick={handleExport} title="Exportovat do CSV" disabled={filteredRecords.length === 0}>
                <Download className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <p className="text-lg font-semibold text-slate-900 mb-1">Žádné záznamy</p>
              <p className="text-slate-500">Žádné kontroly neodpovídají vybraným filtrům</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredRecords.map((record) => {
                const cp = cpMap[record.control_point_id];
                const machineId = cp ? cpToMachine[cp.id] : null;
                const machine = machineId ? machineMap[machineId] : null;
                const line = machine ? lineMap[machineToLine[machine.id]] : null;
                const typeInfo = RECORD_TYPE_LABELS[record.record_type] || { label: record.record_type, color: "bg-slate-100 text-slate-700" };

                return (
                  <div key={record.id} className="flex items-start gap-4 p-4 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
                    <div className="flex-shrink-0 mt-1">
                      <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center">
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <Badge className={typeInfo.color}>{typeInfo.label}</Badge>
                        {cp && <span className="font-semibold text-sm text-slate-900">{cp.name}</span>}
                        {cp?.number && <span className="text-xs text-slate-500">#{cp.number}</span>}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                        {line && (
                          <span className="flex items-center gap-1">
                            <span className="font-medium text-blue-700">{line.name}</span>
                          </span>
                        )}
                        {machine && (
                          <>
                            <span>›</span>
                            <span className="font-medium text-slate-700">{machine.name}</span>
                          </>
                        )}
                      </div>
                      {record.note && (
                        <p className="text-xs text-slate-600 mt-1 italic">"{record.note}"</p>
                      )}
                      <div className="flex items-center gap-4 text-xs text-slate-400 mt-1.5">
                        <span className="flex items-center gap-1">
                          <UserIcon className="w-3 h-3" />
                          {getUserName(record)}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {format(new Date(record.performed_at), "d. M. yyyy HH:mm", { locale: cs })}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}