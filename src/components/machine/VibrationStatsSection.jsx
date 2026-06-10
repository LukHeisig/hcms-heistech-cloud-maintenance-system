import React, { useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, Bell, TrendingUp, Gauge } from "lucide-react";
import { format } from "date-fns";
import { cs } from "date-fns/locale";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const SEVERITY_CONFIG = {
  B: { label: "Pásmo B", bg: "bg-green-100", text: "text-green-700" },
  C: { label: "Pásmo C — Upozornění", bg: "bg-yellow-100", text: "text-yellow-700" },
  D: { label: "Pásmo D — Výstraha", bg: "bg-red-100", text: "text-red-700" },
};

export default function VibrationStatsSection({ machineId }) {
  const { data: assignments = [] } = useQuery({
    queryKey: ["vibrationAssignments", machineId],
    queryFn: () => base44.entities.VibrationSensorAssignment.filter({ machine_id: machineId }),
    staleTime: 120000,
  });

  const assignedSensorIds = React.useMemo(() =>
    [...new Set(assignments.map(a => a.sensor_id).filter(Boolean))],
    [assignments]
  );

  const { data: vibrationStandards = [] } = useQuery({
    queryKey: ["vibrationStandards"],
    queryFn: () => base44.entities.VibrationStandard.list(null, 500),
    staleTime: 300000,
  });
  const standardsById = React.useMemo(() =>
    Object.fromEntries(vibrationStandards.map(s => [s.id, s])),
    [vibrationStandards]
  );

  // Trend points last 30 days
  const { data: trendPoints = [] } = useQuery({
    queryKey: ["vibTrendPointsStats", assignedSensorIds.join(",")],
    queryFn: async () => {
      if (assignedSensorIds.length === 0) return [];
      const since = Math.floor(Date.now() / 1000) - 30 * 24 * 3600;
      const results = await Promise.all(
        assignedSensorIds.map(sid =>
          base44.entities.SensorTrendPoint.filter({ sensor_id: sid }, "-timestamp_unix", 500)
        )
      );
      return results.flat().filter(p => (p.timestamp_unix || 0) >= since);
    },
    enabled: assignedSensorIds.length > 0,
    staleTime: 120000,
  });

  // Latest sensor data per sensor
  const { data: latestData = [] } = useQuery({
    queryKey: ["latestVibDataStats", assignedSensorIds.join(",")],
    queryFn: async () => {
      if (assignedSensorIds.length === 0) return [];
      const results = await Promise.all(
        assignedSensorIds.map(sid =>
          base44.entities.SensorData.filter({ sensor_id: sid, has_fft: true }, "-created_date", 20)
            .then(recs => recs.find(r => r.vel_rms_x_mm_s != null) ?? null)
        )
      );
      return results.filter(Boolean);
    },
    enabled: assignedSensorIds.length > 0,
    staleTime: 60000,
  });

  // Active alerts for machine
  const { data: activeAlerts = [] } = useQuery({
    queryKey: ["machineVibAlerts", machineId],
    queryFn: () => base44.entities.VibrationAlert.filter({ machine_id: machineId, status: "active" }),
    staleTime: 60000,
  });

  // Historical alerts (acknowledged) - for total count
  const { data: allAlerts = [] } = useQuery({
    queryKey: ["machineAllVibAlerts", machineId],
    queryFn: () => base44.entities.VibrationAlert.filter({ machine_id: machineId }, "-created_date", 200),
    staleTime: 120000,
  });

  // Build chart data: aggregate trend points by day, take max vel_rms across axes
  const chartData = React.useMemo(() => {
    if (trendPoints.length === 0) return [];
    const byDay = {};
    trendPoints.forEach(p => {
      const day = format(new Date(p.timestamp_unix * 1000), "d.M.", { locale: cs });
      if (!byDay[day]) byDay[day] = { day, velMax: null, accZ: null, envZ: null, count: 0 };
      const vel = Math.max(p.vel_rms_x_mm_s ?? 0, p.vel_rms_y_mm_s ?? 0, p.vel_rms_z_mm_s ?? 0);
      if (byDay[day].velMax == null || vel > byDay[day].velMax) byDay[day].velMax = vel;
      if (p.rms_z_g != null && (byDay[day].accZ == null || p.rms_z_g > byDay[day].accZ)) byDay[day].accZ = p.rms_z_g;
      if (p.env_rms_z != null && (byDay[day].envZ == null || p.env_rms_z > byDay[day].envZ)) byDay[day].envZ = p.env_rms_z;
      byDay[day].count++;
    });
    // Sort by date ascending
    return Object.values(byDay).sort((a, b) => {
      const parseDay = (s) => { const [d, m] = s.replace(".", "").split("."); return parseInt(m) * 31 + parseInt(d); };
      return parseDay(a.day) - parseDay(b.day);
    });
  }, [trendPoints]);

  // Limit lines from first assignment with vel standard
  const velLimits = React.useMemo(() => {
    for (const a of assignments) {
      const std = standardsById[a.vel_standard_id];
      if (std) return { bc: std.limit_bc, cd: std.limit_cd };
    }
    return null;
  }, [assignments, standardsById]);

  const totalMeasurements = trendPoints.length;
  const alarmsC = allAlerts.filter(a => a.severity === "C").length;
  const alarmsD = allAlerts.filter(a => a.severity === "D").length;
  const activeCount = activeAlerts.length;

  if (assignedSensorIds.length === 0) {
    return (
      <Card className="border-none shadow-lg">
        <CardContent className="p-8 text-center">
          <Activity className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">Žádné senzory nejsou přiřazeny k tomuto stroji.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI dlaždice */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4 border border-blue-200">
          <p className="text-sm text-blue-700 mb-1 flex items-center gap-1"><Activity className="w-4 h-4" /> Měření (30 dní)</p>
          <p className="text-3xl font-bold text-blue-900">{totalMeasurements}</p>
        </div>
        <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl p-4 border border-slate-200">
          <p className="text-sm text-slate-600 mb-1 flex items-center gap-1"><Gauge className="w-4 h-4" /> Přiřazené senzory</p>
          <p className="text-3xl font-bold text-slate-900">{assignedSensorIds.length}</p>
        </div>
        <div className={`rounded-xl p-4 border ${activeCount > 0 ? "bg-gradient-to-br from-red-50 to-red-100 border-red-200" : "bg-gradient-to-br from-green-50 to-green-100 border-green-200"}`}>
          <p className={`text-sm mb-1 flex items-center gap-1 ${activeCount > 0 ? "text-red-700" : "text-green-700"}`}>
            <Bell className="w-4 h-4" /> Aktivní alarmy
          </p>
          <p className={`text-3xl font-bold ${activeCount > 0 ? "text-red-900" : "text-green-900"}`}>{activeCount}</p>
        </div>
        <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-xl p-4 border border-yellow-200">
          <p className="text-sm text-yellow-700 mb-1 flex items-center gap-1"><TrendingUp className="w-4 h-4" /> Alarmy celkem</p>
          <p className="text-3xl font-bold text-yellow-900">{allAlerts.length}</p>
          <p className="text-xs text-yellow-600 mt-1">C: {alarmsC} · D: {alarmsD}</p>
        </div>
      </div>

      {/* Trend graf velocity */}
      {chartData.length > 1 && (
        <Card className="border-none shadow-lg">
          <CardHeader className="border-b border-slate-100">
            <CardTitle className="flex items-center gap-2 text-sm">
              <TrendingUp className="w-4 h-4 text-blue-600" />
              Trend max. rychlosti vibrací — posledních 30 dní [mm/s]
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(v, name) => [v != null ? v.toFixed(3) : "—", name]}
                  labelFormatter={(l) => `Den: ${l}`}
                />
                <Line
                  type="monotone"
                  dataKey="velMax"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={false}
                  name="Vel max [mm/s]"
                  connectNulls
                />
                {velLimits?.bc != null && (
                  <Line dataKey={() => velLimits.bc} stroke="#f59e0b" strokeWidth={1} strokeDasharray="4 2" dot={false} name={`Limit B/C (${velLimits.bc})`} />
                )}
                {velLimits?.cd != null && (
                  <Line dataKey={() => velLimits.cd} stroke="#ef4444" strokeWidth={1} strokeDasharray="4 2" dot={false} name={`Limit C/D (${velLimits.cd})`} />
                )}
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Poslední naměřené hodnoty */}
      {latestData.length > 0 && (
        <Card className="border-none shadow-lg">
          <CardHeader className="border-b border-slate-100">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Activity className="w-4 h-4 text-blue-600" />
              Poslední naměřené hodnoty
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-slate-500 uppercase border-b border-slate-200">
                    <th className="text-left py-2 pr-4">Senzor</th>
                    <th className="text-center px-2">Vel X</th>
                    <th className="text-center px-2">Vel Y</th>
                    <th className="text-center px-2">Vel Z</th>
                    <th className="text-center px-2">Acc Z</th>
                    <th className="text-center px-2">Obálka Z</th>
                    <th className="text-center px-2">Teplota</th>
                    <th className="text-right pl-2">Čas</th>
                  </tr>
                </thead>
                <tbody>
                  {latestData.map(rec => (
                    <tr key={rec.id} className="border-b border-slate-100 last:border-0">
                      <td className="py-2 pr-4 font-mono text-xs text-blue-700">{rec.sensor_id}</td>
                      {[rec.vel_rms_x_mm_s, rec.vel_rms_y_mm_s, rec.vel_rms_z_mm_s].map((v, i) => (
                        <td key={i} className="text-center px-2 font-mono font-semibold text-blue-700">
                          {v != null ? v.toFixed(2) : "—"}
                        </td>
                      ))}
                      <td className="text-center px-2 font-mono font-semibold text-green-700">
                        {(rec.rms_z_g ?? rec.oa_acc_z) != null ? (rec.rms_z_g ?? rec.oa_acc_z).toFixed(3) : "—"}
                      </td>
                      <td className="text-center px-2 font-mono font-semibold text-orange-600">
                        {rec.env_rms_z != null ? rec.env_rms_z.toFixed(3) : "—"}
                      </td>
                      <td className="text-center px-2 font-mono font-semibold text-purple-600">
                        {rec.temperature != null ? `${rec.temperature.toFixed(1)}°` : "—"}
                      </td>
                      <td className="text-right pl-2 text-xs text-slate-400">
                        {rec.created_date ? format(new Date(rec.created_date.endsWith("Z") ? rec.created_date : rec.created_date + "Z"), "d.M. HH:mm", { locale: cs }) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Aktivní alarmy detail */}
      {activeAlerts.length > 0 && (
        <Card className="border-none shadow-lg border-l-4 border-l-red-500">
          <CardHeader className="border-b border-slate-100">
            <CardTitle className="flex items-center gap-2 text-sm text-red-700">
              <Bell className="w-4 h-4" />
              Aktivní vibrační alarmy ({activeAlerts.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="space-y-2">
              {activeAlerts.map(alert => {
                const sev = SEVERITY_CONFIG[alert.severity] || SEVERITY_CONFIG.C;
                return (
                  <div key={alert.id} className={`flex items-center justify-between p-3 rounded-lg ${sev.bg}`}>
                    <div>
                      <p className={`font-semibold text-sm ${sev.text}`}>{alert.metric_label}: <span className="font-mono">{alert.value?.toFixed(2)} {alert.metric_unit}</span></p>
                      <p className="text-xs text-slate-500">{alert.measurement_point} · {format(new Date(alert.created_date.endsWith("Z") ? alert.created_date : alert.created_date + "Z"), "d.M. HH:mm", { locale: cs })}</p>
                    </div>
                    <Badge className={`${sev.bg} ${sev.text} border-0 text-xs`}>{sev.label}</Badge>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}