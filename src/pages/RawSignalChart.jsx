import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from "recharts";
import { ArrowLeft, RefreshCw, Activity, Thermometer, Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { format } from "date-fns";
import { cs } from "date-fns/locale";

// Downsample array to max N points for performance
function downsample(arr, maxPoints) {
  if (!arr || arr.length <= maxPoints) return arr;
  const step = Math.ceil(arr.length / maxPoints);
  const result = [];
  for (let i = 0; i < arr.length; i += step) {
    result.push(arr[i]);
  }
  return result;
}

// Convert m/s² to g (1g = 9.81 m/s²)
function toG(value) {
  if (value === null || value === undefined) return null;
  return value / 9.81;
}

export default function RawSignalChart() {
  const navigate = useNavigate();
  const [selectedSensorId, setSelectedSensorId] = useState(null);
  const [selectedRecordId, setSelectedRecordId] = useState(null);

  // Fetch last Raw Data records (report_type=0 with has_raw=true)
  const { data: rawRecords = [], isLoading, refetch } = useQuery({
    queryKey: ["rawSensorData"],
    queryFn: async () => {
      const records = await base44.entities.SensorData.list("-created_date", 200);
      return records.filter(r => r.report_type === 0 && r.has_raw && r.raw_x_json);
    },
    refetchInterval: 30000,
  });

  // Available sensors
  const sensors = useMemo(() => {
    const ids = [...new Set(rawRecords.map(r => r.sensor_id))];
    return ids;
  }, [rawRecords]);

  // Auto-select first sensor
  const activeSensor = selectedSensorId || sensors[0];

  // Records for selected sensor
  const sensorRecords = useMemo(() => {
    return rawRecords.filter(r => r.sensor_id === activeSensor);
  }, [rawRecords, activeSensor]);

  // Auto-select latest record
  const activeRecordId = selectedRecordId || sensorRecords[0]?.id;
  const activeRecord = sensorRecords.find(r => r.id === activeRecordId) || sensorRecords[0];

  // Parse raw data and build chart data
  const chartData = useMemo(() => {
    if (!activeRecord?.raw_x_json) return [];
    try {
      const rawX = JSON.parse(activeRecord.raw_x_json);
      const rawY = JSON.parse(activeRecord.raw_y_json || "[]");
      const rawZ = JSON.parse(activeRecord.raw_z_json || "[]");

      const len = Math.max(rawX.length, rawY.length, rawZ.length);
      // AISSENS: fs = 26700 Hz, recording time = 2s
      const fs = 26700;
      const dtMs = 1000 / fs;

      // Downsample to 2000 points for chart performance
      const maxPoints = 2000;
      const step = Math.max(1, Math.ceil(len / maxPoints));

      const result = [];
      for (let i = 0; i < len; i += step) {
        result.push({
          t: Math.round(i * dtMs),
          x: toG(rawX[i]) ?? null,
          y: toG(rawY[i]) ?? null,
          z: toG(rawZ[i]) ?? null,
        });
      }
      return result;
    } catch (e) {
      return [];
    }
  }, [activeRecord]);

  // Stats
  const stats = useMemo(() => {
    if (!activeRecord?.raw_x_json) return null;
    try {
      const rawX = JSON.parse(activeRecord.raw_x_json);
      const rawY = JSON.parse(activeRecord.raw_y_json || "[]");
      const rawZ = JSON.parse(activeRecord.raw_z_json || "[]");
      const rms = (arr) => Math.sqrt(arr.reduce((s, v) => s + v * v, 0) / arr.length);
      const peak = (arr) => Math.max(...arr.map(Math.abs));
      return {
        samples: rawX.length,
        fs: 26700,
        rmsX: (rms(rawX) / 9.81).toFixed(3),
        rmsY: (rms(rawY) / 9.81).toFixed(3),
        rmsZ: (rms(rawZ) / 9.81).toFixed(3),
        peakX: (peak(rawX) / 9.81).toFixed(3),
        peakY: (peak(rawY) / 9.81).toFixed(3),
        peakZ: (peak(rawZ) / 9.81).toFixed(3),
      };
    } catch { return null; }
  }, [activeRecord]);

  return (
    <div className="p-4 md:p-8 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="sm" onClick={() => navigate(createPageUrl("MqttDashboard"))}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Zpět
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Activity className="w-6 h-6 text-blue-600" />
              Surový vibracní signál — Raw Data
            </h1>
            <p className="text-slate-500 text-sm">Type 0 · 2s záznam · nasamplovaný signál X/Y/Z</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4 mr-2" /> Obnovit
          </Button>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap gap-4 mb-6">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-500">Senzor</label>
            <Select value={activeSensor || ""} onValueChange={(v) => { setSelectedSensorId(v); setSelectedRecordId(null); }}>
              <SelectTrigger className="w-56">
                <SelectValue placeholder="Vyberte senzor..." />
              </SelectTrigger>
              <SelectContent>
                {sensors.map(id => (
                  <SelectItem key={id} value={id}>{id}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-500">Záznam</label>
            <Select value={activeRecordId || ""} onValueChange={setSelectedRecordId}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Nejnovější..." />
              </SelectTrigger>
              <SelectContent>
                {sensorRecords.slice(0, 30).map(r => (
                  <SelectItem key={r.id} value={r.id}>
                    {format(new Date(r.created_date), "d.M.yyyy HH:mm:ss", { locale: cs })}
                    {" "}({r.num_samples ?? "?"} vzorků)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20 text-slate-400">
            <RefreshCw className="w-6 h-6 animate-spin mr-3" /> Načítám data...
          </div>
        ) : rawRecords.length === 0 ? (
          <Card>
            <CardContent className="py-20 text-center text-slate-400">
              <Activity className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p className="text-lg font-medium">Žádná Raw Data zatím nepřišla</p>
              <p className="text-sm mt-1">Senzor musí mít nastaven Measure Mode = Raw Data</p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Stats row */}
            {stats && activeRecord && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <Card>
                  <CardContent className="p-4">
                    <p className="text-xs text-slate-500 mb-1">Počet vzorků</p>
                    <p className="text-2xl font-bold text-slate-900">{stats.samples}</p>
                    <p className="text-xs text-slate-400">26 700 Hz vzorkovací fr.</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-xs text-slate-500 mb-1 flex items-center gap-1">
                      <Thermometer className="w-3 h-3" /> Teplota
                    </p>
                    <p className="text-2xl font-bold text-orange-600">
                      {activeRecord.temperature != null ? `${activeRecord.temperature.toFixed(1)}°C` : "–"}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-xs text-slate-500 mb-1 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Čas záznamu
                    </p>
                    <p className="text-sm font-semibold text-slate-900">
                      {format(new Date(activeRecord.created_date), "d.M.yyyy HH:mm:ss", { locale: cs })}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-xs text-slate-500 mb-1">RMS (g) / Peak (g)</p>
                    <div className="flex gap-2 text-sm font-semibold">
                      <span className="text-blue-600">X:{stats.rmsX}g / {stats.peakX}g</span>
                      <span className="text-green-600">Y:{stats.rmsY}g / {stats.peakY}g</span>
                      <span className="text-red-600">Z:{stats.rmsZ}g / {stats.peakZ}g</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Charts — one per axis for clarity */}
            {chartData.length > 0 ? (
              <div className="space-y-4">
                {[
                  { key: "x", label: "Osa X", color: "#2563eb" },
                  { key: "y", label: "Osa Y", color: "#16a34a" },
                  { key: "z", label: "Osa Z", color: "#dc2626" },
                ].map(({ key, label, color }) => (
                  <Card key={key}>
                    <CardHeader className="pb-2 border-b border-slate-100">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: color }} />
                        {label} — Akcelerační signál (g)
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-2 pt-4">
                      <ResponsiveContainer width="100%" height={200}>
                        <LineChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                          <XAxis
                            dataKey="t"
                            tickFormatter={(v) => `${(v / 1000).toFixed(2)}s`}
                            tick={{ fontSize: 10 }}
                            label={{ value: "čas (s)", position: "insideBottomRight", offset: -10, fontSize: 10 }}
                          />
                          <YAxis tick={{ fontSize: 10 }} width={55} label={{ value: "g", angle: -90, position: "insideLeft", fontSize: 10 }} />
                          <Tooltip
                            formatter={(v) => [v, label]}
                            labelFormatter={(l) => `t = ${(l / 1000).toFixed(3)} s`}
                          />
                          <Line
                            type="monotone"
                            dataKey={key}
                            stroke={color}
                            dot={false}
                            strokeWidth={1}
                            isAnimationActive={false}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="py-12 text-center text-slate-400">
                  <p>Vybraný záznam neobsahuje vzorky.</p>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}