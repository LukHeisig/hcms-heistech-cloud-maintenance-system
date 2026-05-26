import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from "recharts";
import { TrendingUp, RefreshCw } from "lucide-react";
import { format } from "date-fns";

// Mapování metrik na SensorFFTData pole
// oa_x/oa_y/oa_z jsou RMS rychlosti, oa_acc_z je RMS zrychlení Z
const METRIC_DEFS = {
  vel_xyz: {
    label: "Rychlost X, Y, Z [mm/s]",
    lines: [
      { key: "vel_rms_x_mm_s", fftKey: "oa_x", name: "Vel X", color: "#3b82f6" },
      { key: "vel_rms_y_mm_s", fftKey: "oa_y", name: "Vel Y", color: "#10b981" },
      { key: "vel_rms_z_mm_s", fftKey: "oa_z", name: "Vel Z", color: "#f59e0b" },
    ],
  },
  vel_x: {
    label: "Rychlost X [mm/s]",
    lines: [{ key: "vel_rms_x_mm_s", fftKey: "oa_x", name: "Vel X", color: "#3b82f6" }],
  },
  vel_y: {
    label: "Rychlost Y [mm/s]",
    lines: [{ key: "vel_rms_y_mm_s", fftKey: "oa_y", name: "Vel Y", color: "#10b981" }],
  },
  vel_z: {
    label: "Rychlost Z [mm/s]",
    lines: [{ key: "vel_rms_z_mm_s", fftKey: "oa_z", name: "Vel Z", color: "#f59e0b" }],
  },
  acc_z: {
    label: "Zrychlení Z [g]",
    lines: [{ key: "oa_acc_z", fftKey: "oa_acc_z", name: "Acc Z", color: "#10b981" }],
  },
  env_z: {
    label: "Obálka Z [g]",
    lines: [{ key: "env_rms_z", fftKey: "oa_acc_z", name: "Obálka Z", color: "#f97316" }],
  },
};

const CUSTOM_TOOLTIP = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg px-3 py-2 text-xs">
      <p className="font-semibold text-slate-600 mb-1">{label}</p>
      {payload.map(p => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full inline-block" style={{ background: p.color }} />
          <span className="text-slate-600">{p.name}:</span>
          <span className="font-semibold" style={{ color: p.color }}>{p.value?.toFixed(3)}</span>
        </div>
      ))}
    </div>
  );
};

export default function VibrationTrendChart({ sensorId, metricKey, sensorLabel }) {
  const metricDef = METRIC_DEFS[metricKey] || METRIC_DEFS.vel_xyz;

  // Pomocná funkce pro výpočet RMS ze spektra
  const calcRMS = (json, freqRes, minF, maxF) => {
    if (!json) return null;
    try {
      const amps = JSON.parse(json);
      let sumSq = 0;
      for (let i = 0; i < amps.length; i++) {
        const f = i * freqRes;
        if (f >= minF && f <= maxF && f > 0) sumSq += amps[i] * amps[i];
      }
      return Math.sqrt(sumSq / 2);
    } catch { return null; }
  };

  // Načteme FFT záznamy a přepočítáme RMS ze spekter
  const { data: historyData = [], isLoading } = useQuery({
    queryKey: ["sensorTrend", sensorId, metricKey],
    queryFn: async () => {
      const records = await base44.entities.SensorFFTData.filter(
        { sensor_id: sensorId },
        "timestamp_unix",
        200
      );
      return records.map(r => {
        const freqRes = r.frequency_resolution || 3.259;
        const ts = r.timestamp_unix
          ? format(new Date(r.timestamp_unix * 1000), "dd.MM HH:mm")
          : format(new Date(r.created_date), "dd.MM HH:mm");
        return {
          ts,
          // Přednostně skalární hodnoty, fallback na výpočet ze spektra
          vel_rms_x_mm_s: r.oa_x ?? calcRMS(r.vel_x_json, freqRes, 2, 1000),
          vel_rms_y_mm_s: r.oa_y ?? calcRMS(r.vel_y_json, freqRes, 2, 1000),
          vel_rms_z_mm_s: r.oa_z ?? calcRMS(r.vel_z_json, freqRes, 2, 1000),
          oa_acc_z:       r.oa_acc_z ?? calcRMS(r.acc_z_json, freqRes, 2, 6000),
          env_rms_z:      calcRMS(r.env_z_json, freqRes, 2, 1000),
        };
      }).filter(r => metricDef.lines.some(l => r[l.key] != null));
    },
    enabled: !!sensorId,
    staleTime: 30000,
  });

  const chartData = useMemo(() => {
    return historyData.map(r => {
      const point = { ts: r.ts };
      metricDef.lines.forEach(l => { point[l.key] = r[l.key]; });
      return point;
    });
  }, [historyData, metricDef]);

  return (
    <Card className="border-none shadow-lg">
      <CardHeader className="border-b border-slate-100 bg-slate-50/50 py-3 px-4">
        <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-blue-600" />
          Trend — <span className="text-blue-700">{sensorLabel}</span>
          <span className="text-slate-400 font-normal ml-1">· {metricDef.label}</span>
          {isLoading && <RefreshCw className="w-3 h-3 animate-spin text-slate-400 ml-auto" />}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        {!isLoading && chartData.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-slate-400 text-sm">
            Žádná historická data pro tento senzor a metriku.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis
                dataKey="ts"
                tick={{ fontSize: 10 }}
                interval="preserveStartEnd"
                angle={-30}
                textAnchor="end"
                height={40}
              />
              <YAxis domain={["auto", "auto"]} tick={{ fontSize: 10 }} width={50} />
              <Tooltip content={<CUSTOM_TOOLTIP />} />
              {metricDef.lines.length > 1 && <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />}
              {metricDef.lines.map(l => (
                <Line
                  key={l.key}
                  type="monotone"
                  dataKey={l.key}
                  name={l.name}
                  stroke={l.color}
                  strokeWidth={2}
                  dot={{ r: 2, fill: l.color }}
                  activeDot={{ r: 4 }}
                  isAnimationActive={false}
                  connectNulls={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

// Exportujeme i mapování metrik pro použití v tabulce
export { METRIC_DEFS };