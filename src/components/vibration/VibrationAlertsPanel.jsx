import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from "@/components/ui/dialog";
import {
  AlertTriangle, Bell, BellOff, CheckCircle2, ChevronRight, Thermometer,
  Activity, Zap, Filter, RefreshCw
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { cs } from "date-fns/locale";

const SEVERITY_CONFIG = {
  B: { label: "Pásmo B — OK", bg: "bg-green-50", text: "text-green-800", border: "border-green-300", dot: "bg-green-700" },
  C: { label: "Pásmo C — Upozornění", bg: "bg-yellow-100", text: "text-yellow-800", border: "border-yellow-300", dot: "bg-yellow-500" },
  D: { label: "Pásmo D — Výstraha", bg: "bg-red-100", text: "text-red-700", border: "border-red-300", dot: "bg-red-600 animate-pulse" },
};

const ALERT_TYPE_CONFIG = {
  velocity:     { label: "Rychlost vibrace", icon: Activity, color: "text-blue-600" },
  acceleration: { label: "Zrychlení", icon: Zap, color: "text-green-700" },
  envelope:     { label: "Obálka", icon: Activity, color: "text-orange-600" },
  temperature:  { label: "Teplota", icon: Thermometer, color: "text-red-500" },
  battery:      { label: "Baterie", icon: BellOff, color: "text-yellow-600" },
};

const STATUS_CONFIG = {
  active:       { label: "Aktivní", badge: "bg-red-100 text-red-700 border-red-300" },
  acknowledged: { label: "Kvitováno", badge: "bg-slate-100 text-slate-500 border-slate-300" },
};

function AlertCard({ alert, onAcknowledge }) {
  const navigate = useNavigate();
  const sev = SEVERITY_CONFIG[alert.severity] || SEVERITY_CONFIG.B;
  const typeConf = ALERT_TYPE_CONFIG[alert.alert_type] || ALERT_TYPE_CONFIG.velocity;
  const TypeIcon = typeConf.icon;
  const isActive = alert.status === "active";

  const formatValue = (val, unit) => {
    if (val == null) return "—";
    return `${val.toFixed ? val.toFixed(2) : val} ${unit}`.trim();
  };

  const limitInfo = () => {
    const parts = [];
    if (alert.limit_ab != null) parts.push(`A/B: ${alert.limit_ab}`);
    if (alert.limit_bc != null) parts.push(`B/C: ${alert.limit_bc}`);
    if (alert.limit_cd != null) parts.push(`C/D: ${alert.limit_cd}`);
    return parts.join(" · ");
  };

  return (
    <div className={`rounded-xl border ${sev.border} ${isActive ? sev.bg : "bg-slate-50"} p-4 transition-all`}>
      <div className="flex items-start gap-3">
        {/* Severity dot */}
        <div className={`w-3 h-3 rounded-full flex-shrink-0 mt-1 ${isActive ? sev.dot : "bg-slate-300"}`} />

        <div className="flex-1 min-w-0">
          {/* Hlavička */}
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <TypeIcon className={`w-4 h-4 ${isActive ? typeConf.color : "text-slate-400"} flex-shrink-0`} />
              <span className={`font-semibold text-sm ${isActive ? "text-slate-900" : "text-slate-500"}`}>
                {alert.machine_name}
              </span>
              <span className="text-slate-400 text-xs">—</span>
              <span className="text-slate-600 text-xs">{alert.measurement_point}</span>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <Badge className={`text-xs ${STATUS_CONFIG[alert.status]?.badge}`}>
                {STATUS_CONFIG[alert.status]?.label}
              </Badge>
              <Badge className={`text-xs ${sev.bg} ${sev.text} ${sev.border} border`}>
                {sev.label}
              </Badge>
            </div>
          </div>

          {/* Hodnoty */}
          <div className="mt-2 flex flex-wrap gap-3 text-sm">
            <div>
              <span className="text-slate-500 text-xs">{alert.metric_label}: </span>
              <span className={`font-bold font-mono ${isActive ? sev.text : "text-slate-500"}`}>
                {formatValue(alert.value, alert.metric_unit)}
              </span>
            </div>
            {limitInfo() && (
              <div className="text-slate-400 text-xs self-end">{limitInfo()} {alert.metric_unit}</div>
            )}
          </div>

          {/* Datum */}
          <div className="mt-1.5 flex items-center gap-3 text-xs text-slate-400 flex-wrap">
            <span>
              {alert.created_date && formatDistanceToNow(
                new Date(/[Zz]$|[+-]\d{2}:\d{2}$/.test(String(alert.created_date))
                  ? alert.created_date
                  : alert.created_date + "Z"),
                { addSuffix: true, locale: cs }
              )}
            </span>
            {alert.acknowledged_by && (
              <span className="text-slate-400">
                Kvitoval: <span className="font-medium">{alert.acknowledged_by}</span>
                {alert.acknowledge_note && <span> — {alert.acknowledge_note}</span>}
              </span>
            )}
          </div>
        </div>

        {/* Akce */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50"
            onClick={() => navigate(createPageUrl(`Machine?id=${alert.machine_id}&open_trend=${alert.metric_key}#vibration`))}
            title="Otevřít vibrační kartu a trend"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
          {isActive && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-green-700 hover:text-green-800 hover:bg-green-50"
              onClick={() => onAcknowledge(alert)}
              title="Kvitovat alarm"
            >
              <CheckCircle2 className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function VibrationAlertsPanel({ user }) {
  const queryClient = useQueryClient();
  const [filterStatus, setFilterStatus] = useState("active");
  const [ackDialog, setAckDialog] = useState(null); // alert object
  const [ackNote, setAckNote] = useState("");
  const [ackLoading, setAckLoading] = useState(false);

  const { data: alerts = [], isLoading, refetch } = useQuery({
    queryKey: ["vibrationAlerts", filterStatus],
    queryFn: () => {
      if (filterStatus === "all") return base44.entities.VibrationAlert.list("-created_date", 200);
      return base44.entities.VibrationAlert.filter({ status: filterStatus }, "-created_date", 200);
    },
    enabled: !!user,
    refetchInterval: 60000,
  });

  const activeCount = useMemo(() => alerts.filter(a => a.status === "active").length, [alerts]);

  const handleAcknowledge = async () => {
    if (!ackDialog) return;
    setAckLoading(true);
    await base44.entities.VibrationAlert.update(ackDialog.id, {
      status: "acknowledged",
      acknowledged_by: user?.email || user?.full_name || "neznámý",
      acknowledged_at: new Date().toISOString(),
      acknowledge_note: ackNote.trim() || null,
    });
    setAckDialog(null);
    setAckNote("");
    setAckLoading(false);
    queryClient.invalidateQueries({ queryKey: ["vibrationAlerts"] });
  };

  const severityOrder = { D: 0, C: 1, B: 2 };
  const sortedAlerts = useMemo(() =>
    [...alerts].sort((a, b) => {
      if (a.status !== b.status) return a.status === "active" ? -1 : 1;
      return (severityOrder[a.severity] ?? 9) - (severityOrder[b.severity] ?? 9);
    }), [alerts]
  );

  return (
    <div className="space-y-4">
      {/* Hlavička panelu */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-slate-700" />
          <h2 className="text-lg font-bold text-slate-900">Alarmy vibrací</h2>
          {filterStatus === "active" && activeCount > 0 && (
            <Badge className="bg-red-600 text-white text-xs">{activeCount} aktivních</Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Filtr stavu */}
          <div className="flex rounded-lg border border-slate-200 overflow-hidden text-xs">
            {["active", "acknowledged", "all"].map(s => (
              <button
                key={s}
                className={`px-3 py-1.5 font-medium transition-colors ${
                  filterStatus === s ? "bg-blue-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50"
                }`}
                onClick={() => setFilterStatus(s)}
              >
                {s === "active" ? "Aktivní" : s === "acknowledged" ? "Kvitované" : "Vše"}
              </button>
            ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => refetch()}
            title="Obnovit"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Popis systému */}
      {filterStatus === "active" && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5 text-xs text-blue-800 flex items-start gap-2">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span>
            <strong>Aktivní alarm</strong> blokuje vznik nového identického alarmu, dokud ho technik nekví­tuje.
            Kvitování potvrzuje, že alarm byl prošetřen.
          </span>
        </div>
      )}

      {/* Seznam alarmů */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-slate-400">
          <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Načítám alarmy...
        </div>
      ) : sortedAlerts.length === 0 ? (
        <div className="text-center py-12">
          <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto mb-3" />
          <p className="font-semibold text-slate-700">
            {filterStatus === "active" ? "Žádné aktivní alarmy" : "Žádné záznamy"}
          </p>
          <p className="text-sm text-slate-400 mt-1">Vibrační senzory jsou v pořádku.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sortedAlerts.map(alert => (
            <AlertCard
              key={alert.id}
              alert={alert}
              onAcknowledge={(a) => { setAckDialog(a); setAckNote(""); }}
            />
          ))}
        </div>
      )}

      {/* Dialog kvitování */}
      <Dialog open={!!ackDialog} onOpenChange={open => !open && setAckDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-700">
              <CheckCircle2 className="w-5 h-5" /> Kvitovat alarm
            </DialogTitle>
            <DialogDescription>
              Potvrďte, že alarm byl prošetřen a analyzován. Tím se uvolní slot pro případný nový alarm stejného typu.
            </DialogDescription>
          </DialogHeader>
          {ackDialog && (
            <div className="space-y-3">
              <div className="bg-slate-50 rounded-lg p-3 text-sm">
                <p className="font-semibold text-slate-900">{ackDialog.machine_name} — {ackDialog.measurement_point}</p>
                <p className="text-slate-600">{ackDialog.metric_label}: <span className="font-mono font-bold">{ackDialog.value?.toFixed(2)} {ackDialog.metric_unit}</span></p>
                <p className="text-xs text-slate-400 mt-1">Pásmo {ackDialog.severity}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Poznámka (volitelné)</label>
                <textarea
                  value={ackNote}
                  onChange={e => setAckNote(e.target.value)}
                  placeholder="Popis zjištění nebo přijatého opatření..."
                  className="w-full h-20 text-sm px-3 py-2 border border-slate-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-green-300"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAckDialog(null)}>Zrušit</Button>
            <Button
              className="bg-green-600 hover:bg-green-700 text-white gap-2"
              onClick={handleAcknowledge}
              disabled={ackLoading}
            >
              <CheckCircle2 className="w-4 h-4" />
              {ackLoading ? "Ukládám..." : "Kvitovat alarm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}