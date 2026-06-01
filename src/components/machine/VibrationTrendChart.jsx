import React, { useMemo, useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine, ReferenceArea
} from "recharts";
import { TrendingUp, RefreshCw, ZoomIn, ZoomOut } from "lucide-react";
import { format } from "date-fns";

// Mapování metrik na SensorFFTData pole
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
  temperature: {
    label: "Teplota [°C]",
    lines: [{ key: "temperature", name: "Teplota", color: "#a855f7" }],
    source: "SensorData",
  },
};

// Časové rozsahy
const TIME_RANGES = [
  { label: "Dnes", days: 1 },
  { label: "3 dny", days: 3 },
  { label: "Týden", days: 7 },
  { label: "Měsíc", days: 30 },
  { label: "Rok", days: 365 },
  { label: "Vše", days: null },
];

// SensorData jsou malé záznamy → velkorysé limity jsou OK
const RANGE_LIMIT = { 1: 200, 3: 500, 7: 1000, 30: 2000, 365: 5000, null: 5000 };

// Validace timestamp — pokud je v budoucnosti nebo záporný, vrátí null
const validTimestamp = (ts) => {
  if (!ts) return null;
  const nowSec = Date.now() / 1000;
  if (ts > nowSec + 86400 || ts < 0) return null; // více než 1 den v budoucnosti → ignorovat
  return ts;
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

// limits: { ab, bc, cd } — hodnoty limitů pro zobrazení v grafu (nepovinné)
export default function VibrationTrendChart({ sensorId, metricKey, sensorLabel, onSelectRecord, selectedSensorDataId, limits }) {
  const metricDef = METRIC_DEFS[metricKey] || METRIC_DEFS.vel_xyz;
  const [yScaleMode, setYScaleMode] = useState("auto");
  const [rangeDays, setRangeDays] = useState(3); // null = vše, default = 3 dny

  // Zoom state
  const [zoomLeft, setZoomLeft] = useState(null);
  const [zoomRight, setZoomRight] = useState(null);
  const [zoomDragging, setZoomDragging] = useState(null); // index při drag start
  const [zoomedRange, setZoomedRange] = useState(null); // { left, right } indexy

  const isTemperature = metricDef.source === "SensorData";

  const { data: historyData = [], isLoading } = useQuery({
    queryKey: ["sensorTrend", sensorId, metricKey, rangeDays],
    queryFn: async () => {
      const limit = RANGE_LIMIT[rangeDays] ?? 2000;
      const res = await base44.functions.invoke('getSensorTrend', {
        sensor_id: sensorId,
        days: rangeDays,
        limit,
        is_temperature: isTemperature,
      });
      return (res.data?.data ?? []).filter(r => metricDef.lines.some(l => r[l.key] != null));
    },
    enabled: !!sensorId,
    staleTime: 30000,
  });

  const allChartData = useMemo(() => {
    return historyData.map(r => {
      const point = { ts: r.ts, sensor_data_id: r.sensor_data_id };
      metricDef.lines.forEach(l => { point[l.key] = r[l.key]; });
      return point;
    });
  }, [historyData, metricDef]);

  // Aplikace zoomu
  const chartData = useMemo(() => {
    if (!zoomedRange) return allChartData;
    const { left, right } = zoomedRange;
    return allChartData.slice(Math.min(left, right), Math.max(left, right) + 1);
  }, [allChartData, zoomedRange]);

  // Výpočet rozsahu osy Y
  const yDomain = useMemo(() => {
    const allValues = chartData.flatMap(r => metricDef.lines.map(l => r[l.key]).filter(v => v != null));
    const maxValue = allValues.length > 0 ? Math.max(...allValues) : 0;
    const limitCd = limits?.cd;

    if (yScaleMode === "limit" && limitCd != null) return { yMax: limitCd * 1.2, yMaxLabel: "Limit" };
    if (yScaleMode === "hodnota" && maxValue > 0) return { yMax: maxValue * 1.2, yMaxLabel: "hodnota" };
    // auto
    if (limitCd != null && maxValue > 0) {
      return limitCd * 1.2 >= maxValue * 1.2
        ? { yMax: limitCd * 1.2, yMaxLabel: "Limit" }
        : { yMax: maxValue * 1.2, yMaxLabel: "hodnota" };
    }
    if (limitCd != null) return { yMax: limitCd * 1.2, yMaxLabel: "Limit" };
    if (maxValue > 0) return { yMax: maxValue * 1.2, yMaxLabel: "hodnota" };
    return { yMax: "auto", yMaxLabel: "" };
  }, [chartData, metricDef, limits, yScaleMode]);

  // Zoom handlers
  const handleMouseDown = useCallback((e) => {
    if (!e?.activeLabel) return;
    const idx = allChartData.findIndex(d => d.ts === e.activeLabel);
    setZoomDragging(idx);
    setZoomLeft(idx);
    setZoomRight(null);
  }, [allChartData]);

  const handleMouseMove = useCallback((e) => {
    if (zoomDragging == null || !e?.activeLabel) return;
    const idx = allChartData.findIndex(d => d.ts === e.activeLabel);
    setZoomRight(idx);
  }, [zoomDragging, allChartData]);

  const handleMouseUp = useCallback(() => {
    if (zoomDragging == null) return;
    if (zoomRight != null && zoomLeft != null && Math.abs(zoomRight - zoomLeft) > 1) {
      const l = Math.min(zoomLeft, zoomRight);
      const r = Math.max(zoomLeft, zoomRight);
      // Přepočítáme na indexy do allChartData (pokud je zoom aktivní, přičteme offset)
      const offset = zoomedRange ? zoomedRange.left : 0;
      const newLeft = offset + l - (zoomedRange ? offset : 0);
      // Spočítáme správné indexy relativně k allChartData
      const absLeft = (zoomedRange ? zoomedRange.left : 0) + Math.min(zoomLeft, zoomRight);
      const absRight = (zoomedRange ? zoomedRange.left : 0) + Math.max(zoomLeft, zoomRight);
      setZoomedRange({ left: absLeft, right: absRight });
    }
    setZoomDragging(null);
    setZoomLeft(null);
    setZoomRight(null);
  }, [zoomDragging, zoomLeft, zoomRight, zoomedRange]);

  const resetZoom = () => {
    setZoomedRange(null);
    setZoomLeft(null);
    setZoomRight(null);
    setZoomDragging(null);
  };

  const ButtonGroup = ({ label, options, value, onChange, getLabel, isDisabled }) => (
    <div className="flex items-center gap-1">
      <span className="text-slate-400 mr-1 whitespace-nowrap">{label}</span>
      {options.map(opt => {
        const disabled = isDisabled?.(opt);
        const active = opt === value;
        return (
          <button
            key={opt ?? "all"}
            onClick={() => !disabled && onChange(opt)}
            disabled={disabled}
            className={`px-2 py-0.5 rounded border text-xs font-medium transition-colors whitespace-nowrap ${
              active ? "bg-blue-600 text-white border-blue-600"
              : "bg-white text-slate-500 border-slate-300 hover:border-blue-400 hover:text-blue-600"
            } ${disabled ? "opacity-40 cursor-not-allowed" : ""}`}
          >
            {getLabel(opt)}
          </button>
        );
      })}
    </div>
  );

  const MOBILE_RANGES = [1, 3, 7, 30];

  return (
    <Card className="border-none shadow-lg">
      <CardHeader className="border-b border-slate-100 bg-slate-50/50 py-3 px-4">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2 min-w-0">
            <TrendingUp className="w-4 h-4 text-blue-600 flex-shrink-0" />
            <span className="truncate">Trend — <span className="text-blue-700">{sensorLabel}</span></span>
            <span className="text-slate-400 font-normal hidden sm:inline">· {metricDef.label}</span>
            {isLoading && <RefreshCw className="w-3 h-3 animate-spin text-slate-400 ml-1 flex-shrink-0" />}
          </CardTitle>
        </div>
        {/* Ovládací prvky — zabalené do vlastního řádku */}
        <div className="flex flex-wrap items-center gap-2 text-xs mt-2">
          {/* Časový rozsah — na mobilu jen 4 možnosti */}
          <div className="flex items-center gap-1 flex-wrap">
            <span className="text-slate-400 mr-1 whitespace-nowrap">Historie:</span>
            {TIME_RANGES.filter(r => window.innerWidth >= 1024 || MOBILE_RANGES.includes(r.days)).map(r => (
              <button
                key={r.days ?? "all"}
                onClick={() => { setRangeDays(r.days); resetZoom(); }}
                className={`px-2 py-0.5 rounded border text-xs font-medium transition-colors whitespace-nowrap ${
                  rangeDays === r.days ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-slate-500 border-slate-300 hover:border-blue-400 hover:text-blue-600"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
          {/* Škálování Y — skryto na mobilu */}
          <div className="hidden sm:flex items-center gap-1">
            <ButtonGroup
              label="Osa Y:"
              options={["auto", "limit", "hodnota"]}
              value={yScaleMode}
              onChange={setYScaleMode}
              getLabel={(v) => v === "auto" ? "Auto" : v === "limit" ? "Limit" : "Hodnota"}
              isDisabled={(v) => v === "limit" && !limits?.cd}
            />
          </div>
          {/* Zoom reset */}
          {zoomedRange && (
            <button
              onClick={resetZoom}
              className="flex items-center gap-1 px-2 py-0.5 rounded border text-xs font-medium bg-orange-50 text-orange-600 border-orange-300 hover:bg-orange-100"
              title="Resetovat zoom"
            >
              <ZoomOut className="w-3 h-3" />
              Reset zoom
            </button>
          )}
          {!zoomedRange && (
            <span className="text-slate-300 text-xs hidden sm:flex items-center gap-1">
              <ZoomIn className="w-3 h-3" />
              Táhni pro zoom
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-4">
        {!isLoading && allChartData.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-slate-400 text-sm">
            Žádná historická data pro tento senzor a metriku.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart
              data={chartData}
              margin={{ top: 4, right: 60, left: 0, bottom: 4 }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onClick={(e) => {
                if (zoomDragging != null) return; // ignorovat klik při zoomu
                if (e?.activePayload?.[0]?.payload?.sensor_data_id && onSelectRecord) {
                  onSelectRecord(e.activePayload[0].payload.sensor_data_id);
                }
              }}
              style={{ cursor: zoomDragging != null ? "col-resize" : (onSelectRecord ? "pointer" : "default") }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis
                dataKey="ts"
                tick={{ fontSize: 10 }}
                interval="preserveStartEnd"
                angle={-30}
                textAnchor="end"
                height={40}
              />
              <YAxis
                domain={[0, yDomain.yMax === "auto" ? "auto" : yDomain.yMax]}
                tick={{ fontSize: 10 }}
                width={50}
                label={yDomain.yMax !== "auto" ? { value: yDomain.yMaxLabel, angle: -90, position: "insideLeft", offset: 10, style: { fontSize: 9, fill: "#94a3b8" } } : undefined}
              />
              <Tooltip content={<CUSTOM_TOOLTIP />} />
              {metricDef.lines.length > 1 && <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />}

              {/* Limity dle normy */}
              {limits?.ab != null && (
                <ReferenceLine y={limits.ab} stroke="#22c55e" strokeDasharray="5 3" strokeWidth={1.5}
                  label={{ value: "A/B", position: "right", fontSize: 10, fill: "#22c55e" }} />
              )}
              {limits?.bc != null && (
                <ReferenceLine y={limits.bc} stroke="#f59e0b" strokeDasharray="5 3" strokeWidth={1.5}
                  label={{ value: "B/C", position: "right", fontSize: 10, fill: "#f59e0b" }} />
              )}
              {limits?.cd != null && (
                <ReferenceLine y={limits.cd} stroke="#ef4444" strokeDasharray="5 3" strokeWidth={1.5}
                  label={{ value: "C/D", position: "right", fontSize: 10, fill: "#ef4444" }} />
              )}

              {/* Zoom výběr */}
              {zoomLeft != null && zoomRight != null && (
                <ReferenceArea
                  x1={chartData[Math.min(zoomLeft, zoomRight)]?.ts}
                  x2={chartData[Math.max(zoomLeft, zoomRight)]?.ts}
                  strokeOpacity={0.3}
                  fill="#3b82f6"
                  fillOpacity={0.15}
                />
              )}

              {metricDef.lines.map(l => (
                <Line
                  key={l.key}
                  type="monotone"
                  dataKey={l.key}
                  name={l.name}
                  stroke={l.color}
                  strokeWidth={2}
                  dot={(props) => {
                    const { cx, cy, payload } = props;
                    const isSelected = selectedSensorDataId && payload.sensor_data_id === selectedSensorDataId;
                    return (
                      <circle
                        key={`dot-${props.index}`}
                        cx={cx}
                        cy={cy}
                        r={isSelected ? 6 : 2}
                        fill={isSelected ? "#1d4ed8" : l.color}
                        stroke={isSelected ? "#fff" : "none"}
                        strokeWidth={isSelected ? 2 : 0}
                      />
                    );
                  }}
                  activeDot={{ r: 5 }}
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