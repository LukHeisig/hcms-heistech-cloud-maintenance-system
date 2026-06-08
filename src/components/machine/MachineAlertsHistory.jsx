import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bell, Filter, CheckCircle2, AlertTriangle, Thermometer, Battery, Activity, X } from "lucide-react";
import { format } from "date-fns";
import { cs } from "date-fns/locale";

const SEVERITY_CONFIG = {
  D: { label: "Pásmo D — Výstraha", bg: "bg-red-100", text: "text-red-800", border: "border-red-300", dot: "bg-red-600" },
  C: { label: "Pásmo C — Upozornění", bg: "bg-yellow-100", text: "text-yellow-800", border: "border-yellow-300", dot: "bg-yellow-500" },
  B: { label: "Pásmo B — OK", bg: "bg-green-50", text: "text-green-800", border: "border-green-300", dot: "bg-green-700" },
};

const ALERT_TYPE_CONFIG = {
  velocity: { label: "Rychlost vibrací", icon: Activity, color: "text-blue-600" },
  acceleration: { label: "Zrychlení vibrací", icon: Activity, color: "text-indigo-600" },
  envelope: { label: "Obálka vibrací", icon: Activity, color: "text-violet-600" },
  temperature: { label: "Teplota", icon: Thermometer, color: "text-red-600" },
  battery: { label: "Baterie", icon: Battery, color: "text-slate-600" },
};

const STATUS_CONFIG = {
  active: { label: "Aktivní", bg: "bg-red-50", text: "text-red-700" },
  acknowledged: { label: "Kvitováno", bg: "bg-slate-100", text: "text-slate-600" },
};

export default function MachineAlertsHistory({ machineId }) {
  const [filterType, setFilterType] = useState("all");
  const [filterSeverity, setFilterSeverity] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");

  const { data: alerts = [], isLoading } = useQuery({
    queryKey: ["machineAlerts", machineId],
    queryFn: () => base44.entities.VibrationAlert.filter({ machine_id: machineId }, "-created_date", 500),
    enabled: !!machineId,
    refetchInterval: 60000,
  });

  const filtered = useMemo(() => {
    return alerts.filter(a => {
      if (filterType !== "all" && a.alert_type !== filterType) return false;
      if (filterSeverity !== "all" && a.severity !== filterSeverity) return false;
      if (filterStatus !== "all" && a.status !== filterStatus) return false;
      if (filterDateFrom) {
        const from = new Date(filterDateFrom);
        if (new Date(a.created_date) < from) return false;
      }
      if (filterDateTo) {
        const to = new Date(filterDateTo);
        to.setHours(23, 59, 59, 999);
        if (new Date(a.created_date) > to) return false;
      }
      return true;
    });
  }, [alerts, filterType, filterSeverity, filterStatus, filterDateFrom, filterDateTo]);

  const hasFilters = filterType !== "all" || filterSeverity !== "all" || filterStatus !== "all" || filterDateFrom || filterDateTo;

  const clearFilters = () => {
    setFilterType("all");
    setFilterSeverity("all");
    setFilterStatus("all");
    setFilterDateFrom("");
    setFilterDateTo("");
  };

  // Stats
  const stats = useMemo(() => ({
    total: alerts.length,
    active: alerts.filter(a => a.status === "active").length,
    D: alerts.filter(a => a.severity === "D").length,
    C: alerts.filter(a => a.severity === "C").length,
    B: alerts.filter(a => a.severity === "B").length,
  }), [alerts]);

  if (isLoading) {
    return <div className="flex items-center justify-center py-12 text-slate-400">Načítám historii alarmů...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
          <p className="text-xs text-slate-500">Celkem</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-red-700">{stats.active}</p>
          <p className="text-xs text-red-500">Aktivní</p>
        </div>
        <div className="bg-red-50 border border-red-300 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-red-700">{stats.D}</p>
          <p className="text-xs text-red-500">Pásmo D</p>
        </div>
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-orange-700">{stats.C}</p>
          <p className="text-xs text-orange-500">Pásmo C</p>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-yellow-700">{stats.B}</p>
          <p className="text-xs text-yellow-600">Pásmo B</p>
        </div>
      </div>

      {/* Filters */}
      <Card className="border border-slate-200 shadow-sm">
        <CardHeader className="py-3 px-4 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <Filter className="w-4 h-4" />
              Filtry
            </div>
            {hasFilters && (
              <Button variant="ghost" size="sm" className="text-xs text-slate-500 h-7" onClick={clearFilters}>
                <X className="w-3 h-3 mr-1" />
                Vymazat filtry
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-3">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Typ alarmu" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Všechny typy</SelectItem>
                <SelectItem value="velocity">Rychlost vibrací</SelectItem>
                <SelectItem value="acceleration">Zrychlení vibrací</SelectItem>
                <SelectItem value="envelope">Obálka vibrací</SelectItem>
                <SelectItem value="temperature">Teplota</SelectItem>
                <SelectItem value="battery">Baterie</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterSeverity} onValueChange={setFilterSeverity}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Závažnost" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Všechna pásma</SelectItem>
                <SelectItem value="D">Pásmo D — Výstraha</SelectItem>
                <SelectItem value="C">Pásmo C — Upozornění</SelectItem>
                <SelectItem value="B">Pásmo B — OK</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Stav" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Všechny stavy</SelectItem>
                <SelectItem value="active">Aktivní</SelectItem>
                <SelectItem value="acknowledged">Kvitováno</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex flex-col gap-0.5">
              <label className="text-[10px] text-slate-400 pl-1">Od</label>
              <input
                type="date"
                value={filterDateFrom}
                onChange={e => setFilterDateFrom(e.target.value)}
                className="h-8 text-xs border border-input rounded-md px-2 bg-white w-full"
              />
            </div>
            <div className="flex flex-col gap-0.5">
              <label className="text-[10px] text-slate-400 pl-1">Do</label>
              <input
                type="date"
                value={filterDateTo}
                onChange={e => setFilterDateTo(e.target.value)}
                className="h-8 text-xs border border-input rounded-md px-2 bg-white w-full"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <Bell className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">{hasFilters ? "Žádné alarmy neodpovídají filtrům" : "Žádné alarmy pro tento stroj"}</p>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-slate-400 px-1">Zobrazeno {filtered.length} z {alerts.length} záznamů</p>
          {filtered.map(alert => {
            const sev = SEVERITY_CONFIG[alert.severity] || SEVERITY_CONFIG.B;
            const typeConf = ALERT_TYPE_CONFIG[alert.alert_type] || ALERT_TYPE_CONFIG.velocity;
            const TypeIcon = typeConf.icon;
            const statusConf = STATUS_CONFIG[alert.status] || STATUS_CONFIG.active;

            return (
              <div
                key={alert.id}
                className={`flex items-start gap-3 p-3 rounded-lg border ${sev.border} ${sev.bg}`}
              >
                <div className={`mt-1 w-2.5 h-2.5 rounded-full flex-shrink-0 ${sev.dot}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className={`text-xs font-bold ${sev.text}`}>{sev.label}</span>
                    <Badge variant="outline" className={`text-xs px-1.5 py-0 ${typeConf.color}`}>
                      <TypeIcon className="w-3 h-3 mr-1 inline" />
                      {typeConf.label}
                    </Badge>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${statusConf.bg} ${statusConf.text}`}>
                      {statusConf.label}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-700">
                    {alert.measurement_point && (
                      <span className="font-medium">{alert.measurement_point}</span>
                    )}
                    <span>
                      {alert.metric_label || alert.metric_key}: <strong>{alert.value?.toFixed(3)} {alert.metric_unit}</strong>
                    </span>
                    {alert.limit_bc && (
                      <span className="text-slate-500">Limit C: {alert.limit_bc} {alert.metric_unit}</span>
                    )}
                    {alert.limit_cd && (
                      <span className="text-slate-500">Limit D: {alert.limit_cd} {alert.metric_unit}</span>
                    )}
                  </div>
                  {alert.status === "acknowledged" && alert.acknowledged_at && (
                    <p className="text-[10px] text-slate-500 mt-1">
                      Kvitoval: {alert.acknowledged_by} — {format(new Date(alert.acknowledged_at), "d.M.yyyy HH:mm", { locale: cs })}
                      {alert.acknowledge_note && ` — "${alert.acknowledge_note}"`}
                    </p>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs text-slate-500">{format(new Date(alert.created_date), "d.M.yyyy", { locale: cs })}</p>
                  <p className="text-[10px] text-slate-400">{format(new Date(alert.created_date), "HH:mm", { locale: cs })}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}