import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Wifi,
  WifiOff,
  Battery,
  BatteryLow,
  BatteryMedium,
  BatteryFull,
  Activity,
  Cpu,
  Clock,
  Signal,
  Thermometer,
  MessageSquare,
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
  Info,
  Link as LinkIcon,
  LayoutDashboard,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { format, formatDistanceToNow } from "date-fns";
import { cs } from "date-fns/locale";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import DSPVisualization from "@/components/mqtt/DSPVisualization";

const REPORT_TYPE_LABELS = {
  0: "Raw Data",
  1: "FFT",
  2: "Feature",
  3: "Battery",
  4: "Hibernate/Wakeup",
  5: "RT Raw Data",
  6: "RT FFT",
  71: "Raw+FFT",
  9: "OA Only",
  10: "RT OA Only",
  11: "Ask Command",
  12: "Heart Beat",
};

function BatteryIcon({ level, voltage }) {
  const pct = level === 0 ? "0–5%" : level === 1 ? "5–20%" : level === 2 ? "20–35%" : level === 3 ? "35–50%" : "50–100%";
  const color = level <= 1 ? "text-red-500" : level <= 2 ? "text-yellow-500" : "text-green-500";
  const Icon = level <= 1 ? BatteryLow : level <= 2 ? BatteryMedium : BatteryFull;
  return (
    <span className={`flex items-center gap-1 ${color}`} title={`${pct}${voltage ? ` (${voltage}V)` : ""}`}>
      <Icon className="w-4 h-4" />
      {voltage ? `${voltage}V` : pct}
    </span>
  );
}

function SignalBars({ strength }) {
  if (strength == null) return <span className="text-slate-400">–</span>;
  const color = strength >= 3 ? "text-green-500" : strength >= 2 ? "text-yellow-500" : "text-red-500";
  return <span className={`flex items-center gap-1 ${color}`}><Signal className="w-4 h-4" />{strength} dBm</span>;
}

function StatusBadge({ lastSeen }) {
  if (!lastSeen) return <Badge variant="outline" className="text-slate-400">Neznámý</Badge>;
  const diffMs = Date.now() - new Date(lastSeen).getTime();
  const diffH = diffMs / 3600000;
  if (diffH < 1) return <Badge className="bg-green-100 text-green-700 border-green-300">Online</Badge>;
  if (diffH < 24) return <Badge className="bg-yellow-100 text-yellow-700 border-yellow-300">Nedávno</Badge>;
  return <Badge className="bg-red-100 text-red-600 border-red-200">Offline</Badge>;
}

function AllSensorIds({ sensors }) {
  const { data: sensorDataIds = [], isLoading } = useQuery({
    queryKey: ["allSensorDataIds"],
    queryFn: async () => {
      const records = await base44.entities.SensorData.list("-created_date", 200);
      const unique = [...new Set(records.map(r => r.sensor_id).filter(Boolean))];
      return unique.sort();
    },
    staleTime: 60000,
  });

  const [copyDone, setCopyDone] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(sensorDataIds.join("\n"));
    setCopyDone(true);
    setTimeout(() => setCopyDone(false), 2000);
  };

  const registeredIds = new Set(sensors.map(s => s.sensor_id));

  return (
    <Card>
      <CardHeader className="border-b border-slate-100">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Cpu className="w-5 h-5 text-blue-600" />
            Všechna ID senzorů z přijatých dat
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{sensorDataIds.length} unikátních ID</Badge>
            <Button variant="outline" size="sm" onClick={handleCopy} disabled={sensorDataIds.length === 0}>
              {copyDone ? "Zkopírováno ✓" : "Kopírovat vše"}
            </Button>
          </div>
        </div>
        <p className="text-sm text-slate-500 mt-1">
          Všechna unikátní ID senzorů, která kdy odeslala data přes webhook (z tabulky SensorData).
        </p>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-slate-400">
            <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Načítám data...
          </div>
        ) : sensorDataIds.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <WifiOff className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <p>Žádná data senzorů nebyla dosud přijata.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left p-4 text-sm font-semibold text-slate-600">#</th>
                  <th className="text-left p-4 text-sm font-semibold text-slate-600">Sensor ID</th>
                  <th className="text-left p-4 text-sm font-semibold text-slate-600">Stav registrace</th>
                  <th className="text-left p-4 text-sm font-semibold text-slate-600">Vlastní název</th>
                  <th className="text-left p-4 text-sm font-semibold text-slate-600">Poslední aktivita</th>
                </tr>
              </thead>
              <tbody>
                {sensorDataIds.map((sid, idx) => {
                  const registered = sensors.find(s => s.sensor_id === sid);
                  return (
                    <tr key={sid} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="p-4 text-sm text-slate-400">{idx + 1}</td>
                      <td className="p-4">
                        <code className="text-blue-600 font-mono text-sm font-semibold">{sid}</code>
                      </td>
                      <td className="p-4">
                        {registered
                          ? <Badge className="bg-green-100 text-green-700 border-green-300">Registrován</Badge>
                          : <Badge className="bg-yellow-100 text-yellow-700 border-yellow-300">Neregistrován</Badge>
                        }
                      </td>
                      <td className="p-4 text-sm text-slate-600">
                        {registered?.name || <span className="text-slate-400">—</span>}
                      </td>
                      <td className="p-4 text-sm text-slate-600">
                        {registered?.last_seen
                          ? format(new Date(registered.last_seen), "d.M.yyyy HH:mm", { locale: cs })
                          : <span className="text-slate-400">—</span>
                        }
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function MqttSensors() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editSensor, setEditSensor] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [showEdit, setShowEdit] = useState(false);
  const [form, setForm] = useState({ sensor_id: "", name: "", notes: "", machine_id: "" });

  const { data: sensors = [], isLoading, refetch } = useQuery({
    queryKey: ["aissens_sensors"],
    queryFn: () => base44.entities.AissensSensor.list("-last_seen", 500),
    refetchInterval: 30000,
  });

  const { data: machines = [] } = useQuery({
    queryKey: ["allMachines"],
    queryFn: () => base44.entities.Machine.list(null, 1000),
    staleTime: 300000,
  });

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      if (editSensor) {
        return base44.entities.AissensSensor.update(editSensor.id, data);
      } else {
        return base44.entities.AissensSensor.create({ ...data, messages_total: 0, is_active: true });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["aissens_sensors"] });
      setShowEdit(false);
      setEditSensor(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.AissensSensor.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["aissens_sensors"] });
      setDeleteId(null);
    },
  });

  const openAdd = () => {
    setEditSensor(null);
    setForm({ sensor_id: "", name: "", notes: "", machine_id: "" });
    setShowEdit(true);
  };

  const openEdit = (s) => {
    setEditSensor(s);
    setForm({ sensor_id: s.sensor_id, name: s.name || "", notes: s.notes || "", machine_id: s.machine_id || "" });
    setShowEdit(true);
  };

  const handleSave = () => {
    saveMutation.mutate(form);
  };

  // Stats
  const now = Date.now();
  const activeLast24h = sensors.filter(s => s.last_seen && (now - new Date(s.last_seen).getTime()) < 86400000).length;
  const totalMessages = sensors.reduce((sum, s) => sum + (s.messages_total || 0), 0);

  return (
    <div className="p-4 md:p-8 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-xl">
                <Cpu className="w-7 h-7 text-blue-600" />
              </div>
              MQTT Senzory AISSENS
            </h1>
            <p className="text-slate-500 mt-1">Přehled vibračních senzorů komunikujících přes MQTT webhook</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Obnovit
            </Button>
            <Button onClick={openAdd} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="w-4 h-4 mr-2" />
              Přidat senzor
            </Button>
          </div>
        </div>

        <Tabs defaultValue="sensors" className="mb-8">
          <TabsList className="mb-4">
            <TabsTrigger value="sensors">Seznam senzorů a Statistiky</TabsTrigger>
            <TabsTrigger value="dsp">DSP Vizualizace a Analýza</TabsTrigger>
            <TabsTrigger value="all-ids">Všechna ID senzorů</TabsTrigger>
          </TabsList>
          
          <TabsContent value="sensors">

        {/* Stats cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card>
            <CardContent className="p-6 flex items-start justify-between">
              <div>
                <p className="text-sm text-slate-500">Celkem senzorů</p>
                <p className="text-3xl font-bold text-slate-900">{sensors.length}</p>
                <p className="text-xs text-slate-400 mt-1">Detected in recent history</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-xl">
                <Cpu className="w-6 h-6 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 flex items-start justify-between">
              <div>
                <p className="text-sm text-slate-500">Aktivní senzory (24h)</p>
                <p className="text-3xl font-bold text-green-600">{activeLast24h}</p>
                <p className="text-xs text-slate-400 mt-1">Transmitting data today</p>
              </div>
              <div className="p-3 bg-green-100 rounded-xl">
                <Activity className="w-6 h-6 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 flex items-start justify-between">
              <div>
                <p className="text-sm text-slate-500">Přijatých zpráv</p>
                <p className="text-3xl font-bold text-slate-900">{totalMessages.toLocaleString()}</p>
                <p className="text-xs text-slate-400 mt-1">Celkový počet webhooků</p>
              </div>
              <div className="p-3 bg-purple-100 rounded-xl">
                <MessageSquare className="w-6 h-6 text-purple-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Webhook URL info */}
        <Card className="mb-6 bg-blue-50 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-blue-900 mb-1">Webhook endpoint pro příjem dat</p>
                <p className="text-sm text-blue-800">
                  Senzory odesílají data přes HTTP POST na backend funkci <code className="bg-blue-100 px-1 rounded">aissensWebhook</code>.
                  Payload musí obsahovat pole <code className="bg-blue-100 px-1 rounded">sensor_id</code>, <code className="bg-blue-100 px-1 rounded">report_type</code> a <code className="bg-blue-100 px-1 rounded">data</code>.
                  Autorizace přes hlavičku <code className="bg-blue-100 px-1 rounded">x-webhook-token</code> (hodnota z VIBRATION_API_TOKEN).
                </p>
                <p className="text-xs text-blue-600 mt-2">
                  Senzory jsou automaticky registrovány při prvním příjmu zprávy. Data formát dle AISSENS Message Exchange Flow v1.7 (Report Type 0 = Raw Data).
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Sensors table */}
        <Card>
          <CardHeader className="border-b border-slate-100">
            <CardTitle className="flex items-center gap-2">
              <Wifi className="w-5 h-5 text-blue-600" />
              Seznam senzorů
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-16 text-slate-400">
                <RefreshCw className="w-6 h-6 animate-spin mr-3" />
                Načítám senzory...
              </div>
            ) : sensors.length === 0 ? (
              <div className="text-center py-16">
                <WifiOff className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500 font-medium mb-1">Žádné senzory nejsou registrovány</p>
                <p className="text-sm text-slate-400">Senzory se automaticky registrují při prvním příjmu dat z webhooku, nebo je přidejte ručně.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="text-left p-4 text-sm font-semibold text-slate-600">Sensor ID</th>
                      <th className="text-left p-4 text-sm font-semibold text-slate-600">Název / Stroj</th>
                      <th className="text-left p-4 text-sm font-semibold text-slate-600">Poslední zpráva</th>
                      <th className="text-left p-4 text-sm font-semibold text-slate-600">Status</th>
                      <th className="text-left p-4 text-sm font-semibold text-slate-600">Baterie</th>
                      <th className="text-left p-4 text-sm font-semibold text-slate-600">Signál</th>
                      <th className="text-left p-4 text-sm font-semibold text-slate-600">Teplota</th>
                      <th className="text-left p-4 text-sm font-semibold text-slate-600">Typ zprávy</th>
                      <th className="text-left p-4 text-sm font-semibold text-slate-600">Zprávy</th>
                      <th className="text-left p-4 text-sm font-semibold text-slate-600"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {sensors.map((sensor) => {
                      const machine = machines.find(m => m.id === sensor.machine_id);
                      return (
                        <tr key={sensor.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                          <td className="p-4">
                            <code className="text-blue-600 font-mono text-sm font-semibold">{sensor.sensor_id}</code>
                            {sensor.model && <p className="text-xs text-slate-400 mt-0.5">{sensor.model}</p>}
                          </td>
                          <td className="p-4">
                            <p className="font-medium text-slate-900 text-sm">{sensor.name || sensor.sensor_id}</p>
                            {machine && (
                              <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                                <LinkIcon className="w-3 h-3" />
                                {machine.name}
                              </p>
                            )}
                          </td>
                          <td className="p-4 text-sm text-slate-600">
                            {sensor.last_seen ? (
                              <>
                                <p>{formatDistanceToNow(new Date(sensor.last_seen), { addSuffix: true, locale: cs })}</p>
                                <p className="text-xs text-slate-400">{format(new Date(sensor.last_seen), "d.M.yyyy HH:mm", { locale: cs })}</p>
                              </>
                            ) : "–"}
                          </td>
                          <td className="p-4">
                            <StatusBadge lastSeen={sensor.last_seen} />
                          </td>
                          <td className="p-4 text-sm">
                            {sensor.last_battery_level != null
                              ? <BatteryIcon level={sensor.last_battery_level} voltage={sensor.last_battery_voltage} />
                              : "–"}
                          </td>
                          <td className="p-4 text-sm">
                            <SignalBars strength={sensor.last_signal_strength} />
                          </td>
                          <td className="p-4 text-sm text-slate-600">
                            {sensor.last_temperature != null
                              ? <span className="flex items-center gap-1"><Thermometer className="w-4 h-4 text-orange-400" />{sensor.last_temperature.toFixed(1)}°C</span>
                              : "–"}
                          </td>
                          <td className="p-4">
                            {sensor.last_report_type != null ? (
                              <Badge variant="outline" className="text-xs whitespace-nowrap">
                                {REPORT_TYPE_LABELS[sensor.last_report_type] ?? `Type ${sensor.last_report_type}`}
                              </Badge>
                            ) : "–"}
                          </td>
                          <td className="p-4 text-sm font-semibold text-slate-700">
                            {(sensor.messages_total || 0).toLocaleString()}
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-1">
                              <Button variant="ghost" size="icon" onClick={() => openEdit(sensor)}>
                                <Pencil className="w-4 h-4 text-slate-400" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => setDeleteId(sensor.id)}>
                                <Trash2 className="w-4 h-4 text-red-400" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
          </TabsContent>

          <TabsContent value="dsp">
            <DSPVisualization />
          </TabsContent>

          <TabsContent value="all-ids">
            <AllSensorIds sensors={sensors} />
          </TabsContent>
        </Tabs>
      </div>

      {/* Edit / Add Dialog */}
      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editSensor ? "Upravit senzor" : "Přidat senzor"}</DialogTitle>
            <DialogDescription>
              {editSensor ? "Upravte nastavení senzoru AISSENS." : "Ručně zaregistrujte senzor. Senzory se také registrují automaticky při příjmu prvních dat."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Sensor ID *</Label>
              <Input
                value={form.sensor_id}
                onChange={e => setForm({ ...form, sensor_id: e.target.value })}
                placeholder="např. S9IMP600001265H"
                disabled={!!editSensor}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Vlastní název</Label>
              <Input
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="např. Motor linky A - ložisko"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Přiřazený stroj</Label>
              <Select value={form.machine_id || "none"} onValueChange={v => setForm({ ...form, machine_id: v === "none" ? "" : v })}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Vyberte stroj (volitelné)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Nepřiřazen —</SelectItem>
                  {machines.map(m => (
                    <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Poznámky</Label>
              <Textarea
                value={form.notes}
                onChange={e => setForm({ ...form, notes: e.target.value })}
                placeholder="Umístění, popis..."
                rows={2}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEdit(false)}>Zrušit</Button>
            <Button
              onClick={handleSave}
              disabled={!form.sensor_id || saveMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {saveMutation.isPending ? "Ukládám..." : "Uložit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Smazat senzor?</AlertDialogTitle>
            <AlertDialogDescription>
              Tato akce smaže záznamy o senzoru. Senzor se znovu automaticky zaregistruje při příjmu dalšího webhooku.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Zrušit</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteMutation.mutate(deleteId)} className="bg-red-600 hover:bg-red-700">
              Smazat
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}