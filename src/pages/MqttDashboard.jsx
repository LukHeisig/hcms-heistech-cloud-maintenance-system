import React, { useState, useMemo, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Wifi, WifiOff, Activity, Cpu, MessageSquare, Thermometer,
  BatteryFull, BatteryMedium, BatteryLow, Signal, RefreshCw,
  ArrowLeft, Database, BarChart2
} from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { format, formatDistanceToNow } from "date-fns";
import { cs } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

const REPORT_TYPE_LABELS = {
  0: "Raw Data", 1: "FFT", 2: "Feature", 3: "Battery",
  4: "Status", 5: "RT Raw", 6: "RT FFT", 9: "OA Only",
  10: "RT OA", 11: "Ask CMD", 12: "HeartBeat",
};

function BatteryDisplay({ level, voltage }) {
  const color = level <= 1 ? "text-red-500" : level <= 2 ? "text-yellow-500" : "text-green-500";
  const Icon = level <= 1 ? BatteryLow : level <= 2 ? BatteryMedium : BatteryFull;
  return (
    <span className={`flex items-center gap-1 ${color} text-sm`}>
      <Icon className="w-4 h-4" />
      {voltage != null ? `${voltage}V` : ["0-5%","5-20%","20-35%","35-50%","50-100%"][level] ?? "–"}
    </span>
  );
}

function StatusBadge({ lastSeen }) {
  if (!lastSeen) return <Badge variant="outline" className="text-slate-400">Neznámý</Badge>;
  const diffH = (Date.now() - new Date(lastSeen).getTime()) / 3600000;
  if (diffH < 1) return <Badge className="bg-green-100 text-green-700 border-green-300 border">Online</Badge>;
  if (diffH < 24) return <Badge className="bg-yellow-100 text-yellow-700 border-yellow-300 border">Nedávno</Badge>;
  return <Badge className="bg-red-100 text-red-600 border-red-200 border">Offline</Badge>;
}

// OA Values table with persistent cache per sensor
function OAValuesTable({ statsData }) {
  const cacheRef = useRef({});

  useEffect(() => {
    if (!statsData || statsData.length === 0) return;
    statsData.forEach(row => {
      if (!cacheRef.current[row.sensor_id]) cacheRef.current[row.sensor_id] = {};
      const c = cacheRef.current[row.sensor_id];
      if (row.oa_x != null && c.oa_ts == null || (row.created_date > (c.oa_ts || ""))) {
        if (row.oa_x != null) { c.oa_x = row.oa_x; c.oa_y = row.oa_y; c.oa_z = row.oa_z; c.oa_ts = row.created_date; }
      }
      if (row.oa_acc_z != null) {
        if (c.oa_acc_z_ts == null || row.created_date > c.oa_acc_z_ts) {
          c.oa_acc_z = row.oa_acc_z; c.oa_acc_z_ts = row.created_date;
        }
      }
      if (row.rms_z_g != null || row.peak_z_g != null) {
        if (c.z_ts == null || row.created_date > c.z_ts) {
          c.rms_z_g = row.rms_z_g; c.peak_z_g = row.peak_z_g; c.z_ts = row.created_date;
        }
      }
    });
  }, [statsData]);

  const sensors = useMemo(() => {
    const ids = [...new Set((statsData || []).map(r => r.sensor_id))];
    return ids.map(id => ({ sensor_id: id, ...cacheRef.current[id] }));
  }, [statsData]);

  const hasRMSData = sensors.some(s => s.rms_z_g != null || s.peak_z_g != null);

  return (
    <Card className="mt-6">
      <CardHeader className="border-b border-slate-100">
        <CardTitle className="flex items-center gap-2 text-base">
          <Activity className="w-5 h-5 text-purple-600" />
          RMS a Peak Z (poslední batch)
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left p-3 font-semibold text-slate-600">Sensor ID</th>
                <th className="text-left p-3 font-semibold text-slate-600">RMS Z (g)</th>
                <th className="text-left p-3 font-semibold text-slate-600">Peak Z (g)</th>
              </tr>
            </thead>
            <tbody>
              {sensors.length === 0 ? (
                <tr>
                  <td colSpan="3" className="p-4 text-center text-slate-400">Žádný senzor nejsou dostupné</td>
                </tr>
              ) : !hasRMSData ? (
                <tr>
                  <td colSpan="3" className="p-4 text-center text-slate-400 text-sm">
                    Čekání na data Raw typu... (staré záznamy data nemají)
                  </td>
                </tr>
              ) : (
                sensors.map(s => (
                  <tr key={s.sensor_id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="p-3 font-mono text-blue-600 font-semibold">{s.sensor_id}</td>
                    <td className="p-3">{s.rms_z_g != null ? s.rms_z_g.toFixed(4) : "–"}</td>
                    <td className="p-3 font-semibold text-orange-600">{s.peak_z_g != null ? s.peak_z_g.toFixed(4) : "–"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

export default function MqttDashboard() {
  const navigate = useNavigate();

  // Fetch last 100 SensorData records, refresh every 5s
  const { data: statsData = [], isLoading: loadingStats } = useQuery({
    queryKey: ["sensorData_dashboard"],
    queryFn: () => base44.entities.SensorData.list("-created_date", 100),
    refetchInterval: 5000,
  });

  // Fetch raw messages (last 50)
  const { data: rawMessages = [], isLoading: loadingMsgs } = useQuery({
    queryKey: ["mqttMessages_dashboard"],
    queryFn: () => base44.entities.MqttMessage.list("-created_date", 50),
    refetchInterval: 10000,
  });

  // Active sensors list — derived from statsData with backfill
  const activeSensors = useMemo(() => {
    const map = new Map();
    const now = Date.now();

    for (const row of statsData) {
      if (!map.has(row.sensor_id)) {
        // First (newest) record for this sensor
        map.set(row.sensor_id, {
          sensor_id: row.sensor_id,
          lastSeen: row.created_date,
          report_type: row.report_type,
          battery_level: row.battery_level,
          battery_voltage: row.battery_voltage,
          temperature: row.temperature,
          rssi: row.rssi,
          interval: row.interval,
        });
      } else {
        // Backfill missing values from older records
        const s = map.get(row.sensor_id);
        if (s.battery_level == null && row.battery_level != null) s.battery_level = row.battery_level;
        if (s.battery_voltage == null && row.battery_voltage != null) s.battery_voltage = row.battery_voltage;
        if (s.rssi == null && row.rssi != null) s.rssi = row.rssi;
        if (s.interval == null && row.interval != null) s.interval = row.interval;
        if (s.temperature == null && row.temperature != null) s.temperature = row.temperature;
      }
    }

    return Array.from(map.values()).sort((a, b) => new Date(b.lastSeen) - new Date(a.lastSeen));
  }, [statsData]);

  const activeLast24h = useMemo(() => {
    const cutoff = Date.now() - 86400000;
    return activeSensors.filter(s => s.lastSeen && new Date(s.lastSeen).getTime() > cutoff).length;
  }, [activeSensors]);

  return (
    <div className="p-4 md:p-8 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex gap-2 mb-2">
            <Button variant="ghost" size="sm" onClick={() => navigate(createPageUrl("MqttSensors"))}>
              <ArrowLeft className="w-4 h-4 mr-2" /> Zpět na správu senzorů
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate(createPageUrl("RawSignalChart"))}>
              <BarChart2 className="w-4 h-4 mr-2" /> Surový signál
            </Button>
          </div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Cpu className="w-6 h-6 text-blue-600" />
              MQTT Dashboard — Live
            </h1>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-6 flex items-start justify-between">
              <div>
                <p className="text-sm text-slate-500">Total Sensors</p>
                <p className="text-3xl font-bold text-slate-900">{activeSensors.length}</p>
                <p className="text-xs text-slate-400 mt-1">Detected in recent history</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-xl"><Cpu className="w-6 h-6 text-blue-600" /></div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6 flex items-start justify-between">
              <div>
                <p className="text-sm text-slate-500">Active Sensors (24h)</p>
                <p className="text-3xl font-bold text-green-600">{activeLast24h}</p>
                <p className="text-xs text-slate-400 mt-1">Transmitting data today</p>
              </div>
              <div className="p-3 bg-green-100 rounded-xl"><Activity className="w-6 h-6 text-green-600" /></div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6 flex items-start justify-between">
              <div>
                <p className="text-sm text-slate-500">Messages Processed</p>
                <p className="text-3xl font-bold text-slate-900">{statsData.length}</p>
                <p className="text-xs text-slate-400 mt-1">In current view batch</p>
              </div>
              <div className="p-3 bg-purple-100 rounded-xl"><Database className="w-6 h-6 text-purple-600" /></div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6 flex items-start justify-between">
              <div>
                <p className="text-sm text-slate-500">Signal Segments</p>
                <p className="text-3xl font-bold text-slate-900">4</p>
                <p className="text-xs text-slate-400 mt-1">RMS/Peak averaging</p>
              </div>
              <div className="p-3 bg-indigo-100 rounded-xl"><Activity className="w-6 h-6 text-indigo-600" /></div>
            </CardContent>
          </Card>
        </div>

        {/* Active Sensors List */}
        <Card className="mb-6">
          <CardHeader className="border-b border-slate-100">
            <CardTitle className="flex items-center gap-2 text-base">
              <Wifi className="w-5 h-5 text-blue-600" />
              Active Sensors List
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loadingStats ? (
              <div className="flex items-center justify-center py-10 text-slate-400">
                <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Načítám...
              </div>
            ) : activeSensors.length === 0 ? (
              <div className="text-center py-10 text-slate-400">
                <WifiOff className="w-10 h-10 mx-auto mb-2" />
                <p>Žádná data zatím nepřišla</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="text-left p-3 font-semibold text-slate-600">Sensor ID</th>
                      <th className="text-left p-3 font-semibold text-slate-600">Last Seen</th>
                      <th className="text-left p-3 font-semibold text-slate-600">Status</th>
                      <th className="text-left p-3 font-semibold text-slate-600">Battery</th>
                      <th className="text-left p-3 font-semibold text-slate-600">Signal</th>
                      <th className="text-left p-3 font-semibold text-slate-600">Interval</th>
                      <th className="text-left p-3 font-semibold text-slate-600">Packets (in batch)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeSensors.map(s => {
                      const count = statsData.filter(r => r.sensor_id === s.sensor_id).length;
                      return (
                        <tr key={s.sensor_id} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="p-3 font-mono text-blue-600 font-semibold">{s.sensor_id}</td>
                          <td className="p-3 text-slate-600">
                            {s.lastSeen
                              ? formatDistanceToNow(new Date(s.lastSeen + 'Z'), { addSuffix: true, locale: cs })
                              : "–"}
                          </td>
                          <td className="p-3"><StatusBadge lastSeen={s.lastSeen} /></td>
                          <td className="p-3">
                            {s.battery_level != null
                              ? <BatteryDisplay level={s.battery_level} voltage={s.battery_voltage} />
                              : "–"}
                          </td>
                          <td className="p-3">
                            {s.rssi != null
                              ? <span className="flex items-center gap-1"><Signal className="w-4 h-4 text-blue-400" />{s.rssi} dBm</span>
                              : "–"}
                          </td>
                          <td className="p-3">{s.interval != null ? `${s.interval}s` : "–"}</td>
                          <td className="p-3 font-semibold">{count}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* OA Values */}
        <OAValuesTable statsData={statsData} />

        {/* RMS/Peak Z Trend Chart */}
        {statsData.length > 0 && (
          <Card className="mt-6">
            <CardHeader className="border-b border-slate-100">
              <CardTitle className="flex items-center gap-2 text-base">
                <BarChart2 className="w-5 h-5 text-green-600" />
                Trend RMS Z a Peak Z
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <ResponsiveContainer width="100%" height={300}>
                <LineChart
                  data={statsData
                    .filter(r => r.rms_z_g != null || r.peak_z_g != null)
                    .slice(-50)
                    .map((r, i) => ({
                      t: i,
                      rms_z: r.rms_z_g,
                      peak_z: r.peak_z_g,
                      sensor: r.sensor_id,
                    }))}
                  margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="t" tick={{ fontSize: 10 }} />
                  <YAxis label={{ value: "g", angle: -90, position: "insideLeft" }} />
                  <Tooltip 
                    formatter={(v) => v != null ? v.toFixed(4) : "–"}
                    labelFormatter={(i) => `Index ${i}`}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="rms_z"
                    stroke="#16a34a"
                    dot={false}
                    strokeWidth={2}
                    isAnimationActive={false}
                    name="RMS Z (g)"
                  />
                  <Line
                    type="monotone"
                    dataKey="peak_z"
                    stroke="#ea580c"
                    dot={false}
                    strokeWidth={2}
                    isAnimationActive={false}
                    name="Peak Z (g)"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Stored Raw Messages */}
        <Card className="mt-6">
          <CardHeader className="border-b border-slate-100">
            <CardTitle className="flex items-center gap-2 text-base">
              <Database className="w-5 h-5 text-slate-600" />
              Stored Raw Messages (posledních 50)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loadingMsgs ? (
              <div className="flex items-center justify-center py-8 text-slate-400">
                <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Načítám...
              </div>
            ) : rawMessages.length === 0 ? (
              <p className="text-center py-8 text-slate-400">Žádné zprávy</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="text-left p-3 font-semibold text-slate-600">Čas</th>
                      <th className="text-left p-3 font-semibold text-slate-600">Topic</th>
                      <th className="text-left p-3 font-semibold text-slate-600">Typ</th>
                      <th className="text-left p-3 font-semibold text-slate-600">Velikost</th>
                      <th className="text-left p-3 font-semibold text-slate-600">Payload (hex)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rawMessages.map(m => (
                      <tr key={m.id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="p-3 text-slate-500 whitespace-nowrap">
                          {new Date(m.created_date + 'Z').toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </td>
                        <td className="p-3 font-mono text-blue-600 text-xs">{m.topic}</td>
                        <td className="p-3">
                          <Badge variant="outline" className="text-xs">
                            {REPORT_TYPE_LABELS[m.report_type] ?? `Type ${m.report_type}`}
                          </Badge>
                        </td>
                        <td className="p-3 text-slate-500">{m.payload_size}B</td>
                        <td className="p-3 font-mono text-xs text-slate-500 max-w-xs truncate">
                          {m.payload_hex?.substring(0, 60)}{m.payload_hex?.length > 60 ? "…" : ""}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}