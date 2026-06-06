import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from "recharts";
import { Activity, AlertTriangle } from "lucide-react";
import { subDays, format } from "date-fns";
import { cs } from "date-fns/locale";

const SEVERITY_COLORS = { D: "#dc2626", C: "#f97316", B: "#eab308" };

const PERIOD_OPTIONS = [
  { label: "7 dní", days: 7 },
  { label: "30 dní", days: 30 },
  { label: "90 dní", days: 90 },
];

export default function VibrationAlarmFrequencyChart({ user, machines = [], lines = [], companies = [] }) {
  const navigate = useNavigate();
  const [periodDays, setPeriodDays] = useState(30);

  const { data: alerts = [], isLoading } = useQuery({
    queryKey: ["vibrationAlerts", "all", periodDays],
    queryFn: () => base44.entities.VibrationAlert.list("-created_date", 1000),
    enabled: !!user,
    staleTime: 120000,
  });

  const since = useMemo(() => subDays(new Date(), periodDays), [periodDays]);

  // Filter by period and role
  const visibleCompanyIds = useMemo(() => {
    if (!user) return [];
    if (user.user_type === "superAdmin") return companies.map(c => c.id);
    if (user.user_type === "admin") return user.assigned_company_ids || [];
    return user.company_id ? [user.company_id] : [];
  }, [user, companies]);

  const visibleMachineIds = useMemo(() => {
    return machines
      .filter(m => {
        const line = lines.find(l => l.id === m.line_id);
        return line && visibleCompanyIds.includes(line.company_id);
      })
      .map(m => m.id);
  }, [machines, lines, visibleCompanyIds]);

  const filteredAlerts = useMemo(() => {
    return alerts.filter(a => {
      const date = new Date(a.created_date);
      if (date < since) return false;
      return visibleMachineIds.includes(a.machine_id);
    });
  }, [alerts, since, visibleMachineIds]);

  // Group by machine
  const chartData = useMemo(() => {
    const machineMap = {};
    for (const alert of filteredAlerts) {
      const machineId = alert.machine_id;
      if (!machineMap[machineId]) {
        const machine = machines.find(m => m.id === machineId);
        machineMap[machineId] = {
          machineId,
          name: alert.machine_name || machine?.name || machineId,
          total: 0,
          D: 0, C: 0, B: 0,
        };
      }
      machineMap[machineId].total += 1;
      if (alert.severity in machineMap[machineId]) {
        machineMap[machineId][alert.severity] += 1;
      }
    }
    return Object.values(machineMap)
      .sort((a, b) => b.total - a.total)
      .slice(0, 15); // top 15
  }, [filteredAlerts, machines]);

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    const item = chartData.find(d => d.name === label);
    return (
      <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-3 text-xs">
        <p className="font-bold text-slate-900 mb-1.5 max-w-[180px] break-words">{label}</p>
        {["D", "C", "B"].map(sev => item?.[sev] > 0 && (
          <div key={sev} className="flex items-center gap-2 mb-0.5">
            <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: SEVERITY_COLORS[sev] }} />
            <span className="text-slate-600">Pásmo {sev}:</span>
            <span className="font-bold text-slate-900">{item[sev]}</span>
          </div>
        ))}
        <div className="border-t border-slate-100 mt-1.5 pt-1.5 flex items-center justify-between gap-4">
          <span className="text-slate-500">Celkem</span>
          <span className="font-bold text-slate-900">{item?.total}</span>
        </div>
      </div>
    );
  };

  if (isLoading) return null;
  if (chartData.length === 0) return null;

  // Determine bar color by worst severity
  const getBarColor = (entry) => {
    if (entry.D > 0) return SEVERITY_COLORS.D;
    if (entry.C > 0) return SEVERITY_COLORS.C;
    return SEVERITY_COLORS.B;
  };

  return (
    <Card className="border-none shadow-lg">
      <CardHeader className="border-b border-slate-100 pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <AlertTriangle className="w-5 h-5 text-orange-500" />
            Frekvence alarmů — stroje
          </CardTitle>
          <div className="flex rounded-lg border border-slate-200 overflow-hidden text-xs">
            {PERIOD_OPTIONS.map(opt => (
              <button
                key={opt.days}
                className={`px-3 py-1.5 font-medium transition-colors ${
                  periodDays === opt.days ? "bg-blue-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50"
                }`}
                onClick={() => setPeriodDays(opt.days)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <p className="text-xs text-slate-500 mt-1">
          Top stroje s nejvyšším počtem vibrač­ních alarmů za posledních {periodDays} dní
        </p>
      </CardHeader>
      <CardContent className="pt-4 pb-2">
        <ResponsiveContainer width="100%" height={Math.max(180, chartData.length * 36)}>
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 0, right: 40, left: 0, bottom: 0 }}
            barSize={18}
          >
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
            <XAxis
              type="number"
              allowDecimals={false}
              tick={{ fontSize: 11, fill: "#94a3b8" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="name"
              width={140}
              tick={{ fontSize: 11, fill: "#475569" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={v => v.length > 18 ? v.slice(0, 17) + "…" : v}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "#f8fafc" }} />
            <Bar
              dataKey="total"
              radius={[0, 4, 4, 0]}
              cursor="pointer"
              onClick={(data) => {
                const machine = machines.find(m => m.id === data.machineId || m.name === data.name);
                if (machine) navigate(createPageUrl(`Machine?id=${machine.id}#vibration`));
              }}
            >
              {chartData.map((entry, idx) => (
                <Cell key={idx} fill={getBarColor(entry)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        {/* Legenda */}
        <div className="flex items-center gap-4 mt-2 justify-end text-xs text-slate-500">
          {["D", "C", "B"].map(sev => (
            <span key={sev} className="flex items-center gap-1.5">
              <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: SEVERITY_COLORS[sev] }} />
              Pásmo {sev}
            </span>
          ))}
          <span className="text-slate-400 italic">· barva = nejhorší pásmo</span>
        </div>
      </CardContent>
    </Card>
  );
}