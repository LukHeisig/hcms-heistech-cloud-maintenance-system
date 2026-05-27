import React, { useState, useMemo, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceArea
} from "recharts";
import { Activity, RefreshCw, ZoomOut, Settings2 } from "lucide-react";
import { format } from "date-fns";
import VibrationTrendChart, { METRIC_DEFS } from "@/components/machine/VibrationTrendChart";

// Dialog pro přiřazení senzoru + normy k řádku
function AssignSensorDialog({ open, onClose, rowIndex, rowLabel, currentAssignment, onAssign }) {
  const current = currentAssignment || {};
  const [selectedSensor, setSelectedSensor] = useState(current.sensorId || "");
  const [selectedVelStandard, setSelectedVelStandard] = useState(current.velStandardId || "");
  const [selectedAccStandard, setSelectedAccStandard] = useState(current.accStandardId || "");
  const [selectedTempStandard, setSelectedTempStandard] = useState(current.tempStandardId || "");

  // Reset při otevření
  useEffect(() => {
    if (open) {
      setSelectedSensor(current.sensorId || "");
      setSelectedVelStandard(current.velStandardId || "");
      setSelectedAccStandard(current.accStandardId || "");
      setSelectedTempStandard(current.tempStandardId || "");
    }
  }, [open]);

  const { data: registeredSensors = [], isLoading } = useQuery({
    queryKey: ["aissens_sensors"],
    queryFn: () => base44.entities.AissensSensor.list(null, 500),
    enabled: open,
    staleTime: 60000,
  });

  const { data: recentSensorData = [] } = useQuery({
    queryKey: ["recentSensorDataIds"],
    queryFn: async () => {
      const records = await base44.entities.SensorData.list("-created_date", 200);
      return [...new Set(records.map(r => r.sensor_id).filter(Boolean))].sort();
    },
    enabled: open,
    staleTime: 60000,
  });

  const { data: allStandards = [] } = useQuery({
    queryKey: ["vibrationStandards"],
    queryFn: () => base44.entities.VibrationStandard.list(null, 500),
    enabled: open,
    staleTime: 60000,
  });

  const velStandards = useMemo(() => allStandards.filter(s => !s.limit_type || s.limit_type === "velocity"), [allStandards]);
  const accStandards = useMemo(() => allStandards.filter(s => s.limit_type === "acceleration"), [allStandards]);
  const tempStandards = useMemo(() => allStandards.filter(s => s.limit_type === "temperature"), [allStandards]);

  const allSensorIds = useMemo(() => {
    const registeredIds = registeredSensors.map(s => s.sensor_id);
    return [...new Set([...registeredIds, ...recentSensorData])].sort();
  }, [registeredSensors, recentSensorData]);

  const getSensorName = (sid) => registeredSensors.find(s => s.sensor_id === sid)?.name || null;

  const handleSave = () => {
    onAssign(rowIndex, {
      sensorId: selectedSensor || null,
      velStandardId: selectedVelStandard || null,
      accStandardId: selectedAccStandard || null,
      tempStandardId: selectedTempStandard || null,
    });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Konfigurace měřicího místa — {rowLabel}</DialogTitle>
        </DialogHeader>
        <div className="space-y-5 py-2">
          {/* Senzor */}
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1.5">ID senzoru</label>
            <Select value={selectedSensor || "__none__"} onValueChange={v => setSelectedSensor(v === "__none__" ? "" : v)}>
              <SelectTrigger>
                <SelectValue placeholder="— bez senzoru —" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— bez senzoru —</SelectItem>
                {isLoading ? (
                  <SelectItem value="__loading__" disabled>Načítám...</SelectItem>
                ) : allSensorIds.map(sid => (
                  <SelectItem key={sid} value={sid}>
                    <span className="font-mono text-blue-700">{sid}</span>
                    {getSensorName(sid) && <span className="text-slate-500 ml-2 text-xs">— {getSensorName(sid)}</span>}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Norma pro rychlost */}
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1.5">
              Norma pro rychlost vibrací <span className="normal-case font-normal text-blue-600">[mm/s]</span>
            </label>
            <Select value={selectedVelStandard || "__none__"} onValueChange={v => setSelectedVelStandard(v === "__none__" ? "" : v)}>
              <SelectTrigger>
                <SelectValue placeholder="— bez normy —" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— bez normy —</SelectItem>
                {velStandards.map(s => (
                  <SelectItem key={s.id} value={s.id}>
                    <span className="font-medium">{s.name}</span>
                    <span className="text-slate-400 ml-2 text-xs">A/B: {s.limit_ab} · B/C: {s.limit_bc} · C/D: {s.limit_cd} mm/s</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Norma pro zrychlení/obálku */}
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1.5">
              Norma pro zrychlení a obálku <span className="normal-case font-normal text-green-600">[g]</span>
            </label>
            <Select value={selectedAccStandard || "__none__"} onValueChange={v => setSelectedAccStandard(v === "__none__" ? "" : v)}>
              <SelectTrigger>
                <SelectValue placeholder="— bez normy —" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— bez normy —</SelectItem>
                {accStandards.map(s => (
                  <SelectItem key={s.id} value={s.id}>
                    <span className="font-medium">{s.name}</span>
                    <span className="text-slate-400 ml-2 text-xs">A/B: {s.acc_limit_ab} · B/C: {s.acc_limit_bc} · C/D: {s.acc_limit_cd} g</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Norma pro teplotu */}
          <div>
            <label className="text-xs font-semibold text-purple-600 uppercase tracking-wide block mb-1.5">
              Norma pro teplotu <span className="normal-case font-normal text-purple-500">[°C]</span>
            </label>
            <Select value={selectedTempStandard || "__none__"} onValueChange={v => setSelectedTempStandard(v === "__none__" ? "" : v)}>
              <SelectTrigger>
                <SelectValue placeholder="— bez normy —" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— bez normy —</SelectItem>
                {tempStandards.map(s => (
                  <SelectItem key={s.id} value={s.id}>
                    <span className="font-medium">{s.name}</span>
                    <span className="text-slate-400 ml-2 text-xs">A/B: {s.temp_limit_ab} · B/C: {s.temp_limit_bc} · C/D: {s.temp_limit_cd} °C</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>Zrušit</Button>
            <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700">Uložit</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// DSP grafy — znovupoužitelný, totožný s DSPVisualization
function SensorDSPPanel({ sensorId, initialRecordId }) {
  // Načteme záznamy s has_fft (mají spektra) — nezávisle na has_raw
  const { data: records = [], isLoading } = useQuery({
    queryKey: ["sensorDataWithFFT", sensorId],
    queryFn: () => base44.entities.SensorData.filter({ sensor_id: sensorId, has_fft: true }, "-created_date", 50),
    enabled: !!sensorId,
  });

  // Pokud přijde nový initialRecordId z trendu, resetujeme manuální výběr
  const [manualRecordId, setManualRecordId] = useState(null);
  const prevInitialRef = useRef(initialRecordId);
  useEffect(() => {
    if (initialRecordId && initialRecordId !== prevInitialRef.current) {
      prevInitialRef.current = initialRecordId;
      setManualRecordId(null); // nechme initialRecordId převzít
    }
  }, [initialRecordId]);

  const activeRecordId = manualRecordId ?? initialRecordId ?? records[0]?.id;
  const activeRecord = records.find(r => r.id === activeRecordId);

  const { data: fftRecords = [], isLoading: isLoadingFFT } = useQuery({
    queryKey: ["sensorFFT", activeRecord?.id],
    queryFn: () => base44.entities.SensorFFTData.filter({ sensor_data_id: activeRecord.id }),
    enabled: !!activeRecord,
  });
  const activeFFT = fftRecords[0];

  const [zoomStates, setZoomStates] = useState({
    raw: { refAreaLeft: '', refAreaRight: '', left: 'dataMin', right: 'dataMax' },
    acc: { refAreaLeft: '', refAreaRight: '', left: 'dataMin', right: 'dataMax' },
    vel: { refAreaLeft: '', refAreaRight: '', left: 'dataMin', right: 'dataMax' },
    env: { refAreaLeft: '', refAreaRight: '', left: 'dataMin', right: 'dataMax' },
  });

  const zoomOut = (id) => setZoomStates(prev => ({
    ...prev, [id]: { ...prev[id], refAreaLeft: '', refAreaRight: '', left: 'dataMin', right: 'dataMax' }
  }));

  const handleZoom = (chartId) => {
    let { refAreaLeft, refAreaRight } = zoomStates[chartId];
    if (refAreaLeft === refAreaRight || refAreaRight === '') {
      setZoomStates(prev => ({ ...prev, [chartId]: { ...prev[chartId], refAreaLeft: '', refAreaRight: '' } }));
      return;
    }
    let left = Number(refAreaLeft), right = Number(refAreaRight);
    if (left > right) [left, right] = [right, left];
    setZoomStates(prev => ({ ...prev, [chartId]: { ...prev[chartId], refAreaLeft: '', refAreaRight: '', left, right } }));
  };

  const calcRMS = (amps, freqRes, minF, maxF) => {
    let sumSq = 0;
    for (let i = 0; i < amps.length; i++) {
      const f = i * freqRes;
      if (f >= minF && f <= maxF && f > 0) sumSq += amps[i] * amps[i];
    }
    return Math.sqrt(sumSq / 2);
  };

  const dsp = useMemo(() => {
    if (!activeRecord || !activeFFT) return null;
    try {
      let rawChart = [];
      if (activeRecord.raw_z_json) {
        const rawZ = JSON.parse(activeRecord.raw_z_json);
        const fs = 26700, step = Math.max(1, Math.floor(rawZ.length / 500));
        for (let i = 0; i < rawZ.length; i += step)
          rawChart.push({ t: Number((i * (1 / fs) * 1000).toFixed(1)), z: rawZ[i] });
      }
      const freqRes = activeFFT.frequency_resolution || 3.259;
      const accZ = activeFFT.acc_z_json ? JSON.parse(activeFFT.acc_z_json) : [];
      const velX = activeFFT.vel_x_json ? JSON.parse(activeFFT.vel_x_json) : [];
      const velY = activeFFT.vel_y_json ? JSON.parse(activeFFT.vel_y_json) : [];
      const velZ = activeFFT.vel_z_json ? JSON.parse(activeFFT.vel_z_json) : [];
      const envZ = activeFFT.env_z_json ? JSON.parse(activeFFT.env_z_json) : [];

      const specAccZ = accZ.map((amp, i) => ({ f: +(i * freqRes).toFixed(1), amp }));
      const specEnvZ = envZ.map((amp, i) => ({ f: +(i * freqRes).toFixed(1), amp }));
      const specVel = [];
      for (let i = 0; i < Math.max(velX.length, velY.length, velZ.length); i++)
        specVel.push({ f: +(i * freqRes).toFixed(1), x: velX[i] || 0, y: velY[i] || 0, z: velZ[i] || 0 });

      return {
        rmsVelX: calcRMS(velX, freqRes, 2, 1000),
        rmsVelY: calcRMS(velY, freqRes, 2, 1000),
        rmsVelZ: calcRMS(velZ, freqRes, 2, 1000),
        rmsAccZ: calcRMS(accZ, freqRes, 2, 6000),
        rmsEnvZ: calcRMS(envZ, freqRes, 2, 1000),
        rawChart, specAccZ, specVel, specEnvZ
      };
    } catch (e) { return null; }
  }, [activeRecord, activeFFT]);

  if (isLoading) return (
    <div className="flex items-center gap-2 p-6 text-slate-500">
      <RefreshCw className="w-4 h-4 animate-spin" /> Načítám data senzoru...
    </div>
  );

  if (records.length === 0) return (
    <div className="p-6 text-center text-slate-500">
      <Activity className="w-10 h-10 text-slate-300 mx-auto mb-2" />
      <p>Žádná raw data pro tento senzor.</p>
    </div>
  );

  return (
    <div className="space-y-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
      {/* Výběr záznamu */}
      <div className="flex items-center gap-3">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Záznam:</span>
        <Select value={activeRecordId || ""} onValueChange={setManualRecordId}>
          <SelectTrigger className="max-w-xs h-8 text-xs">
            <SelectValue placeholder="Vyberte záznam..." />
          </SelectTrigger>
          <SelectContent>
            {records.map(r => (
              <SelectItem key={r.id} value={r.id} className="text-xs">
                {format(new Date(r.created_date), "dd.MM.yyyy HH:mm:ss")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!activeFFT ? (
        <p className="text-sm text-slate-500 p-4">Tento záznam nemá FFT spektra.</p>
      ) : !dsp ? (
        <p className="text-sm text-slate-500 p-4">Nelze zpracovat data.</p>
      ) : (
        <>
          {/* RMS tabulka */}
          <div className="bg-white border border-slate-200 rounded-lg p-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-1">
              <Activity className="w-3 h-3" /> Tabulka celkových hodnot RMS
            </p>
            <div className="flex flex-wrap gap-6">
              <div>
                <p className="text-xs text-slate-400">RMS Rychlosti (2-1000 Hz) [mm/s]</p>
                <div className="flex gap-3 mt-1">
                  <span className="text-base">X: <span className="font-semibold text-blue-700">{dsp.rmsVelX.toFixed(2)}</span></span>
                  <span className="text-base">Y: <span className="font-semibold text-blue-700">{dsp.rmsVelY.toFixed(2)}</span></span>
                  <span className="text-base">Z: <span className="font-bold text-blue-700">{dsp.rmsVelZ.toFixed(2)}</span></span>
                </div>
              </div>
              <div className="w-px bg-slate-200 self-stretch hidden sm:block" />
              <div>
                <p className="text-xs text-slate-400">RMS Zrychlení Z (2-6000 Hz) [g]</p>
                <span className="text-base mt-1">Z: <span className="font-bold text-green-700">{dsp.rmsAccZ.toFixed(2)}</span></span>
              </div>
              <div className="w-px bg-slate-200 self-stretch hidden sm:block" />
              <div>
                <p className="text-xs text-slate-400">RMS Obálky Z (&gt;500 Hz) [g]</p>
                <span className="text-base mt-1">Z: <span className="font-bold text-orange-600">{dsp.rmsEnvZ.toFixed(2)}</span></span>
              </div>
            </div>
          </div>

          {/* Grafy 2x2 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Časová vlna */}
            <Card>
              <CardHeader className="pb-1 flex flex-row items-center justify-between py-3 px-4">
                <CardTitle className="text-xs font-semibold">Časová vlna Z (Surová data) [g]</CardTitle>
                {zoomStates.raw.left !== 'dataMin' && (
                  <Button variant="outline" size="sm" className="h-6 px-2 text-xs" onClick={() => zoomOut('raw')}>
                    <ZoomOut className="w-3 h-3 mr-1" />Zrušit zoom
                  </Button>
                )}
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={dsp.rawChart}
                    onMouseDown={e => e && setZoomStates(prev => ({ ...prev, raw: { ...prev.raw, refAreaLeft: e.activeLabel } }))}
                    onMouseMove={e => zoomStates.raw.refAreaLeft && e && setZoomStates(prev => ({ ...prev, raw: { ...prev.raw, refAreaRight: e.activeLabel } }))}
                    onMouseUp={() => handleZoom('raw')}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="t" domain={[zoomStates.raw.left, zoomStates.raw.right]} type="number" allowDataOverflow label={{ value: 'čas (ms)', position: 'insideBottomRight', offset: -5 }} tick={{ fontSize: 10 }} />
                    <YAxis domain={['auto', 'auto']} allowDataOverflow tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="z" stroke="#3b82f6" dot={false} isAnimationActive={false} />
                    {zoomStates.raw.refAreaLeft && zoomStates.raw.refAreaRight && <ReferenceArea x1={zoomStates.raw.refAreaLeft} x2={zoomStates.raw.refAreaRight} strokeOpacity={0.3} />}
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Spektrum zrychlení */}
            <Card>
              <CardHeader className="pb-1 flex flex-row items-center justify-between py-3 px-4">
                <CardTitle className="text-xs font-semibold">Spektrum Zrychlení Z (g Peak)</CardTitle>
                {zoomStates.acc.left !== 'dataMin' && (
                  <Button variant="outline" size="sm" className="h-6 px-2 text-xs" onClick={() => zoomOut('acc')}>
                    <ZoomOut className="w-3 h-3 mr-1" />Zrušit zoom
                  </Button>
                )}
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={dsp.specAccZ}
                    onMouseDown={e => e && setZoomStates(prev => ({ ...prev, acc: { ...prev.acc, refAreaLeft: e.activeLabel } }))}
                    onMouseMove={e => zoomStates.acc.refAreaLeft && e && setZoomStates(prev => ({ ...prev, acc: { ...prev.acc, refAreaRight: e.activeLabel } }))}
                    onMouseUp={() => handleZoom('acc')}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="f" domain={[zoomStates.acc.left, zoomStates.acc.right]} type="number" allowDataOverflow label={{ value: 'frekvence (Hz)', position: 'insideBottomRight', offset: -5 }} tick={{ fontSize: 10 }} />
                    <YAxis domain={['auto', 'auto']} allowDataOverflow tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="amp" stroke="#10b981" dot={false} isAnimationActive={false} />
                    {zoomStates.acc.refAreaLeft && zoomStates.acc.refAreaRight && <ReferenceArea x1={zoomStates.acc.refAreaLeft} x2={zoomStates.acc.refAreaRight} strokeOpacity={0.3} />}
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Spektrum rychlosti */}
            <Card>
              <CardHeader className="pb-1 flex flex-row items-center justify-between py-3 px-4">
                <CardTitle className="text-xs font-semibold">Spektrum Rychlosti X, Y, Z (mm/s) [0-1000 Hz]</CardTitle>
                {zoomStates.vel.left !== 'dataMin' && (
                  <Button variant="outline" size="sm" className="h-6 px-2 text-xs" onClick={() => zoomOut('vel')}>
                    <ZoomOut className="w-3 h-3 mr-1" />Zrušit zoom
                  </Button>
                )}
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={dsp.specVel}
                    onMouseDown={e => e && setZoomStates(prev => ({ ...prev, vel: { ...prev.vel, refAreaLeft: e.activeLabel } }))}
                    onMouseMove={e => zoomStates.vel.refAreaLeft && e && setZoomStates(prev => ({ ...prev, vel: { ...prev.vel, refAreaRight: e.activeLabel } }))}
                    onMouseUp={() => handleZoom('vel')}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="f" domain={[zoomStates.vel.left, zoomStates.vel.right]} type="number" allowDataOverflow tick={{ fontSize: 10 }} />
                    <YAxis domain={['auto', 'auto']} allowDataOverflow tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                    <Line type="monotone" dataKey="x" stroke="#3b82f6" dot={false} isAnimationActive={false} name="Osa X" />
                    <Line type="monotone" dataKey="y" stroke="#10b981" dot={false} isAnimationActive={false} name="Osa Y" />
                    <Line type="monotone" dataKey="z" stroke="#f59e0b" dot={false} isAnimationActive={false} name="Osa Z" />
                    {zoomStates.vel.refAreaLeft && zoomStates.vel.refAreaRight && <ReferenceArea x1={zoomStates.vel.refAreaLeft} x2={zoomStates.vel.refAreaRight} strokeOpacity={0.3} />}
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Spektrum obálky */}
            <Card>
              <CardHeader className="pb-1 flex flex-row items-center justify-between py-3 px-4">
                <CardTitle className="text-xs font-semibold">Spektrum Obálky Z</CardTitle>
                {zoomStates.env.left !== 'dataMin' && (
                  <Button variant="outline" size="sm" className="h-6 px-2 text-xs" onClick={() => zoomOut('env')}>
                    <ZoomOut className="w-3 h-3 mr-1" />Zrušit zoom
                  </Button>
                )}
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={dsp.specEnvZ}
                    onMouseDown={e => e && setZoomStates(prev => ({ ...prev, env: { ...prev.env, refAreaLeft: e.activeLabel } }))}
                    onMouseMove={e => zoomStates.env.refAreaLeft && e && setZoomStates(prev => ({ ...prev, env: { ...prev.env, refAreaRight: e.activeLabel } }))}
                    onMouseUp={() => handleZoom('env')}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="f" domain={[zoomStates.env.left, zoomStates.env.right]} type="number" allowDataOverflow tick={{ fontSize: 10 }} />
                    <YAxis domain={['auto', 'auto']} allowDataOverflow tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="amp" stroke="#f97316" dot={false} isAnimationActive={false} name="Amplituda" />
                    {zoomStates.env.refAreaLeft && zoomStates.env.refAreaRight && <ReferenceArea x1={zoomStates.env.refAreaLeft} x2={zoomStates.env.refAreaRight} strokeOpacity={0.3} />}
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

// Hlavní komponenta — Vibrační karta MQTT
export default function VibrationCardMQTT({ machine }) {
  const machineId = machine?.id;

  // Načteme schéma přiřazené ke stroji
  const { data: vibrationSchema } = useQuery({
    queryKey: ["vibrationSchema", machine?.vibration_schema_id],
    queryFn: async () => {
      if (!machine?.vibration_schema_id) return null;
      const schemas = await base44.entities.VibrationSchema.filter({ id: machine.vibration_schema_id });
      return schemas[0] || null;
    },
    enabled: !!machine?.vibration_schema_id,
  });

  // Načteme všechny registrované senzory (pro teplotu, baterii, signál)
  const { data: sensors = [], refetch: refetchSensors } = useQuery({
    queryKey: ["aissens_sensors_all"],
    queryFn: () => base44.entities.AissensSensor.list(null, 500),
    staleTime: 60000,
  });

  // Parsování řádků ze schématu
  const schemaRows = useMemo(() => {
    if (!vibrationSchema?.rows_definition) return [];
    try {
      return JSON.parse(vibrationSchema.rows_definition);
    } catch (e) { return []; }
  }, [vibrationSchema]);

  // Lokální stav — přiřazení senzoru + norem k indexu řádku (uloženo v localStorage per machine)
  // Struktura: { [rowIndex]: { sensorId, velStandardId, accStandardId } }
  const storageKey = `vibro_row_sensors_v2_${machineId}`;
  const [rowAssignments, setRowAssignments] = useState(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(storageKey) || "{}");
      // Migrace starého formátu (string → objekt)
      const migrated = {};
      for (const [k, v] of Object.entries(raw)) {
        migrated[k] = typeof v === "string" ? { sensorId: v } : v;
      }
      return migrated;
    } catch { return {}; }
  });

  // Zpětná kompatibilita — rowSensors[idx] = sensorId (string)
  const rowSensors = useMemo(() => {
    const out = {};
    for (const [k, v] of Object.entries(rowAssignments)) {
      out[k] = v?.sensorId || null;
    }
    return out;
  }, [rowAssignments]);

  const assignSensor = (rowIndex, assignment) => {
    const updated = { ...rowAssignments, [rowIndex]: assignment };
    setRowAssignments(updated);
    localStorage.setItem(storageKey, JSON.stringify(updated));
  };

  // Načtení norem pro zobrazení limitů
  const { data: allStandards = [] } = useQuery({
    queryKey: ["vibrationStandards"],
    queryFn: () => base44.entities.VibrationStandard.list(null, 500),
    staleTime: 120000,
  });
  const standardsById = useMemo(() => Object.fromEntries(allStandards.map(s => [s.id, s])), [allStandards]);

  // Helper: vrátí CSS třídu pro barevné pásmo limitu
  const getLimitClass = (value, limitA, limitB, limitC) => {
    if (value == null || limitA == null) return "";
    if (value < limitA) return "text-green-700 font-semibold";
    if (value < limitB) return "text-yellow-600 font-semibold";
    if (value < limitC) return "text-orange-600 font-semibold";
    return "text-red-600 font-bold";
  };

  // Helper: vrátí úroveň závažnosti 0=ok, 1=warning, 2=alarm, 3=kritická — pro semafor puntík
  const getLimitLevel = (value, limitA, limitB, limitC) => {
    if (value == null || limitA == null) return -1; // bez normy
    if (value < limitA) return 0;
    if (value < limitB) return 1;
    if (value < limitC) return 2;
    return 3;
  };

  // Vypočítá nejhorší úroveň ze všech hodnot v řádku (semafor)
  const getRowAlertLevel = (latest, velStd, accStd, tempStd, temp) => {
    if (!latest) return -1;
    const levels = [
      getLimitLevel(latest.vel_rms_x_mm_s, velStd?.limit_ab, velStd?.limit_bc, velStd?.limit_cd),
      getLimitLevel(latest.vel_rms_y_mm_s, velStd?.limit_ab, velStd?.limit_bc, velStd?.limit_cd),
      getLimitLevel(latest.vel_rms_z_mm_s, velStd?.limit_ab, velStd?.limit_bc, velStd?.limit_cd),
      getLimitLevel(latest.oa_acc_z, accStd?.acc_limit_ab, accStd?.acc_limit_bc, accStd?.acc_limit_cd),
      getLimitLevel(latest.env_rms_z, accStd?.acc_limit_ab, accStd?.acc_limit_bc, accStd?.acc_limit_cd),
      getLimitLevel(temp, tempStd?.temp_limit_ab, tempStd?.temp_limit_bc, tempStd?.temp_limit_cd),
    ].filter(l => l >= 0);
    if (levels.length === 0) return -1;
    return Math.max(...levels);
  };

  const alertDotStyle = (level) => {
    if (level < 0) return "bg-slate-300"; // bez dat / bez normy
    if (level === 0) return "bg-green-500 shadow-[0_0_6px_2px_rgba(34,197,94,0.4)]";
    if (level === 1) return "bg-yellow-400 shadow-[0_0_6px_2px_rgba(234,179,8,0.5)]";
    if (level === 2) return "bg-orange-500 shadow-[0_0_6px_2px_rgba(249,115,22,0.5)]";
    return "bg-red-600 shadow-[0_0_8px_3px_rgba(220,38,38,0.6)] animate-pulse";
  };

  // Defaultně vyber první řádek, který má přiřazený senzor
  const firstAssignedIdx = useMemo(() => {
    return schemaRows.findIndex((_, idx) => !!rowSensors[idx]);
  }, [schemaRows, rowSensors]);

  const [selectedRow, setSelectedRow] = useState(null);
  const activeRowIdx = selectedRow !== null ? selectedRow : firstAssignedIdx;

  // Trend: { sensorId, metricKey }
  const defaultTrendSensorId = useMemo(() => rowSensors[firstAssignedIdx] || null, [firstAssignedIdx, rowSensors]);
  const [trendConfig, setTrendConfig] = useState(null); // null = použij default
  const activeTrendSensorId = trendConfig?.sensorId ?? defaultTrendSensorId;
  const activeTrendMetric = trendConfig?.metricKey ?? "vel_xyz";

  // Vybraný sensor_data_id z kliknutí na bod trendu → předá se do SensorDSPPanel
  const [trendSelectedSensorDataId, setTrendSelectedSensorDataId] = useState(null);

  const [assignDialog, setAssignDialog] = useState(null); // { rowIndex, rowLabel }

  // Načteme poslední data pro každý přiřazený senzor (pro RMS hodnoty v tabulce)
  const assignedSensorIds = useMemo(() => {
    return [...new Set(Object.values(rowSensors).filter(Boolean))];
  }, [rowSensors]);

  const { data: latestSensorData = [] } = useQuery({
    queryKey: ["latestSensorData", assignedSensorIds.join(",")],
    queryFn: async () => {
      if (assignedSensorIds.length === 0) return [];

      const calcRMS = (amps, freqRes, minF, maxF) => {
        if (!amps || !amps.length) return null;
        let sumSq = 0;
        for (let i = 0; i < amps.length; i++) {
          const f = i * freqRes;
          if (f >= minF && f <= maxF && f > 0) sumSq += amps[i] * amps[i];
        }
        return Math.sqrt(sumSq / 2);
      };

      const results = [];
      for (const sid of assignedSensorIds) {
        const records = await base44.entities.SensorData.filter({ sensor_id: sid, has_fft: true }, "-created_date", 1);
        const sensorDataRecord = records[0];
        if (!sensorDataRecord) continue;

        const fftRecs = await base44.entities.SensorFFTData.filter({ sensor_data_id: sensorDataRecord.id });
        const fft = fftRecs[0];

        if (!fft) {
          results.push(sensorDataRecord);
          continue;
        }

        const freqRes = fft.frequency_resolution || 3.259;
        const velX = fft.vel_x_json ? JSON.parse(fft.vel_x_json) : [];
        const velY = fft.vel_y_json ? JSON.parse(fft.vel_y_json) : [];
        const velZ = fft.vel_z_json ? JSON.parse(fft.vel_z_json) : [];
        const accZ = fft.acc_z_json ? JSON.parse(fft.acc_z_json) : [];
        const envZ = fft.env_z_json ? JSON.parse(fft.env_z_json) : [];

        results.push({
          ...sensorDataRecord,
          // Vždy přepočítáme ze spekter — stejná logika jako v DSP panelu
          vel_rms_x_mm_s: calcRMS(velX, freqRes, 2, 1000),
          vel_rms_y_mm_s: calcRMS(velY, freqRes, 2, 1000),
          vel_rms_z_mm_s: calcRMS(velZ, freqRes, 2, 1000),
          oa_acc_z: calcRMS(accZ, freqRes, 2, 6000),
          env_rms_z: calcRMS(envZ, freqRes, 2, 1000),
        });
      }
      return results;
    },
    enabled: assignedSensorIds.length > 0,
    staleTime: 30000,
    refetchInterval: 60000,
  });

  const getSensorById = (sensorId) => sensors.find(s => s.sensor_id === sensorId);
  const getDisplayData = (sensorId) => latestSensorData.find(d => d.sensor_id === sensorId) ?? null;

  // Pokud není přiřazeno schéma, zobraz informaci
  if (!machine?.vibration_schema_id) {
    return (
      <Card className="border-none shadow-lg">
        <CardContent className="p-12 text-center">
          <Activity className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-600 font-medium mb-1">Není přiřazeno vibrační schéma</p>
          <p className="text-sm text-slate-400">Přiřaďte schéma měření v administraci stroje.</p>
        </CardContent>
      </Card>
    );
  }

  if (schemaRows.length === 0) {
    return (
      <Card className="border-none shadow-lg">
        <CardContent className="p-12 text-center">
          <Activity className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500">Schéma neobsahuje žádné řádky.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Hlavička */}
      <Card className="border-none shadow-lg">
        <CardHeader className="border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="w-5 h-5 text-blue-600" />
              Vibrační karta — {vibrationSchema?.name}
            </CardTitle>
            <Badge variant="outline" className="text-xs">{schemaRows.length} měřicích míst</Badge>
          </div>
        </CardHeader>

        {/* Tabulka */}
        <CardContent className="p-0">
          {/* Hlavička tabulky */}
           <div className="grid grid-cols-[2fr_2fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_auto] gap-0 bg-slate-100 border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600 uppercase tracking-wide">
             <div>Místo</div>
             <div>ID senzoru / čas měření</div>
             <div className="text-center">Vel X<br/><span className="text-xs normal-case font-normal">[mm/s]</span></div>
             <div className="text-center">Vel Y<br/><span className="text-xs normal-case font-normal">[mm/s]</span></div>
             <div className="text-center">Vel Z<br/><span className="text-xs normal-case font-normal">[mm/s]</span></div>
             <div className="text-center">Acc Z<br/><span className="text-xs normal-case font-normal">[g]</span></div>
             <div className="text-center">Obálka Z<br/><span className="text-xs normal-case font-normal">[g]</span></div>
             <div className="text-center">Teplota<br/><span className="text-xs normal-case font-normal">[°C]</span></div>
             <div className="text-center">Baterie<br/><span className="text-xs normal-case font-normal">[0-4]</span></div>
             <div className="text-center">Signál<br/><span className="text-xs normal-case font-normal">[dBm]</span></div>
             <div></div>
           </div>

          {schemaRows.map((row, idx) => {
            const assignment = rowAssignments[idx] || {};
            const sensorId = assignment.sensorId || null;
            const velStd = standardsById[assignment.velStandardId];
            const accStd = standardsById[assignment.accStandardId];
            const tempStd = standardsById[assignment.tempStandardId];
            const latest = getDisplayData(sensorId);
            const sensorInfo = getSensorById(sensorId);
            const isSelected = activeRowIdx === idx;
            const label = row.label || row.name || `Bod ${idx + 1}`;
            const name = row.name || "";

            // Baterie: barva dle úrovně (0=prázdná, 4=plná)
            const batteryLevel = sensorInfo?.last_battery_level;
            const batteryColor = batteryLevel == null ? "text-slate-300" : batteryLevel >= 3 ? "text-green-600" : batteryLevel >= 2 ? "text-yellow-600" : "text-red-600";
            // Signál: barva dle dBm (-50 vynikající, -67 dobrý, -80 slabý, <-80 nepoužitelný)
            // Signál je uložen jako kladné číslo (75 = -75 dBm), interpretujeme ho jako -rssi
            const rssi = sensorInfo?.last_signal_strength;
            const rssiDb = rssi != null ? -Math.abs(rssi) : null;
            const rssiColor = rssiDb == null ? "text-slate-300"
              : rssiDb >= -50 ? "text-green-600"
              : rssiDb >= -67 ? "text-blue-600"
              : rssiDb >= -80 ? "text-yellow-600"
              : "text-red-600";
            const rssiTitle = rssiDb == null ? "Neznámý signál"
              : rssiDb >= -50 ? "Vynikající signál (-30 až -50 dBm)"
              : rssiDb >= -67 ? "Dobrý signál (-60 až -67 dBm)"
              : rssiDb >= -80 ? "Slabý signál (-70 až -80 dBm)"
              : "Nepoužitelný signál (< -80 dBm)";
            // Teplota
            const temp = sensorInfo?.last_temperature;
            const tempClass = getLimitClass(temp, tempStd?.temp_limit_ab, tempStd?.temp_limit_bc, tempStd?.temp_limit_cd);

            // Barevné třídy dle normy
            const velClass = (v) => getLimitClass(v, velStd?.limit_ab, velStd?.limit_bc, velStd?.limit_cd);
            const accClass = (v) => getLimitClass(v, accStd?.acc_limit_ab, accStd?.acc_limit_bc, accStd?.acc_limit_cd);

            const alertLevel = getRowAlertLevel(latest, velStd, accStd, tempStd, temp);
            const alertTitle = alertLevel < 0
              ? (sensorId ? "Bez přiřazené normy" : "Bez senzoru")
              : alertLevel === 0 ? "Stav: OK — všechny hodnoty v pásmu A"
              : alertLevel === 1 ? "Stav: Pozor — překročeno pásmo A/B"
              : alertLevel === 2 ? "Stav: Alarm — překročeno pásmo B/C"
              : "Stav: KRITICKÝ — překročeno pásmo C/D";

            return (
              <div key={idx} className="border-b border-slate-100 last:border-0">
                <div
                  className={`grid grid-cols-[2fr_2fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_auto] gap-0 px-4 py-4 text-base transition-colors items-center ${sensorId ? "cursor-pointer hover:bg-blue-50/50" : ""} ${isSelected ? "bg-blue-50 border-l-2 border-l-blue-500" : ""}`}
                  onClick={() => {
                    if (!sensorId) return;
                    setSelectedRow(idx);
                    setTrendConfig({ sensorId, metricKey: "vel_xyz" });
                    setTrendSelectedSensorDataId(null);
                  }}
                >
                  <div className="flex items-center gap-2">
                    {/* Semafor puntík */}
                    <div
                      className={`w-4 h-4 rounded-full flex-shrink-0 ${alertDotStyle(sensorId ? alertLevel : -1)}`}
                      title={alertTitle}
                    />
                    <div>
                      <span className={`font-semibold ${isSelected && sensorId ? "text-blue-700" : "text-slate-900"}`}>{label}</span>
                      {name && name !== label && <span className="text-slate-500 ml-1 text-xs">{name}</span>}
                      {/* Badge norem */}
                      <div className="flex gap-1 mt-0.5 flex-wrap">
                        {velStd && <span className="text-[9px] bg-blue-50 text-blue-600 border border-blue-200 rounded px-1">{velStd.name}</span>}
                        {accStd && <span className="text-[9px] bg-green-50 text-green-700 border border-green-200 rounded px-1">{accStd.name}</span>}
                        {tempStd && <span className="text-[9px] bg-purple-50 text-purple-700 border border-purple-200 rounded px-1">{tempStd.name}</span>}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-0.5">
                    {sensorId ? (
                      <>
                        <span className="font-mono text-xs text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 w-fit">{sensorId}</span>
                        {latest?.created_date && (
                          <span className="text-[10px] text-slate-400 pl-0.5">
                            {new Date(latest.created_date).toLocaleString("cs-CZ", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })}
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-slate-400 text-xs italic">— nepřiřazen —</span>
                    )}
                  </div>

                  {/* RMS hodnoty — kliknutím nastaví trend, barevně dle normy */}
                  {[
                    { metricKey: "vel_x", value: latest?.vel_rms_x_mm_s, colorClass: velClass(latest?.vel_rms_x_mm_s), fallbackColor: "text-blue-700" },
                    { metricKey: "vel_y", value: latest?.vel_rms_y_mm_s, colorClass: velClass(latest?.vel_rms_y_mm_s), fallbackColor: "text-blue-700" },
                    { metricKey: "vel_z", value: latest?.vel_rms_z_mm_s, colorClass: velClass(latest?.vel_rms_z_mm_s), fallbackColor: "text-blue-700" },
                    { metricKey: "acc_z", value: latest?.oa_acc_z, colorClass: accClass(latest?.oa_acc_z), fallbackColor: "text-green-700" },
                    { metricKey: "env_z", value: latest?.env_rms_z, colorClass: accClass(latest?.env_rms_z), fallbackColor: "text-orange-600" },
                  ].map(({ metricKey, value, colorClass, fallbackColor }) => {
                    const isActiveTrend = sensorId && activeTrendSensorId === sensorId && activeTrendMetric === metricKey;
                    const displayClass = colorClass || fallbackColor;
                    return (
                      <div
                        key={metricKey}
                        className={`text-center font-mono text-sm rounded transition-colors ${sensorId ? "cursor-pointer hover:bg-blue-100" : ""} ${isActiveTrend ? "bg-blue-100 ring-1 ring-blue-400" : ""}`}
                        onClick={(e) => { e.stopPropagation(); if (sensorId) setTrendConfig({ sensorId, metricKey }); }}
                        title={sensorId ? `Zobrazit trend: ${METRIC_DEFS[metricKey]?.label}` : ""}
                      >
                        {value != null ? <span className={displayClass}>{value.toFixed(2)}</span> : <span className="text-slate-300">—</span>}
                      </div>
                    );
                  })}

                  {/* Teplota */}
                   <div className="text-center font-mono text-sm font-semibold">
                     {temp != null
                       ? <span className={tempClass || "text-purple-700"}>{temp.toFixed(1)}°</span>
                       : <span className="text-slate-300">—</span>}
                   </div>

                   {/* Baterie */}
                   <div className="text-center font-mono text-sm font-semibold">
                     {batteryLevel != null ? <span className={batteryColor}>{batteryLevel}/4</span> : <span className="text-slate-300">—</span>}
                   </div>

                   {/* Signál */}
                   <div className="text-center font-mono text-sm font-semibold">
                     {rssiDb != null ? <span className={rssiColor} title={rssiTitle}>{rssiDb}</span> : <span className="text-slate-300">—</span>}
                   </div>

                  {/* Tlačítko přiřazení */}
                  <div className="flex justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-slate-500 hover:text-blue-600"
                      onClick={(e) => { e.stopPropagation(); setAssignDialog({ rowIndex: idx, rowLabel: `${label}${name && name !== label ? ' — ' + name : ''}`, currentAssignment: rowAssignments[idx] }); }}
                    >
                      <Settings2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Trend panel */}
      {activeTrendSensorId && (() => {
        const trendRowIdx = Object.entries(rowSensors).find(([, sid]) => sid === activeTrendSensorId)?.[0];
        const trendRow = trendRowIdx != null ? schemaRows[trendRowIdx] : null;
        const trendLabel = trendRow?.label || trendRow?.name || activeTrendSensorId;
        return (
          <VibrationTrendChart
            sensorId={activeTrendSensorId}
            metricKey={activeTrendMetric}
            sensorLabel={trendLabel}
            onSelectRecord={(sensorDataId) => {
              setTrendSelectedSensorDataId(sensorDataId);
              // Přepne DSP panel na řádek odpovídající aktivnímu trend senzoru
              const rowIdx = Object.entries(rowSensors).find(([, sid]) => sid === activeTrendSensorId)?.[0];
              if (rowIdx != null) setSelectedRow(Number(rowIdx));
            }}
            selectedSensorDataId={trendSelectedSensorDataId}
          />
        );
      })()}

      {/* DSP panel pod tabulkou */}
      {activeRowIdx >= 0 && rowSensors[activeRowIdx] && (() => {
        const activeSensorId = rowSensors[activeRowIdx];
        const activeLatest = getDisplayData(activeSensorId);
        const activeRow = schemaRows[activeRowIdx];
        const activeLabel = activeRow?.label || activeRow?.name || `Bod ${activeRowIdx + 1}`;
        return (
          <Card className="border-none shadow-lg">
            <CardHeader className="border-b border-slate-100 bg-slate-50/50 py-3 px-4">
              <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <Activity className="w-4 h-4 text-blue-600" />
                Spektrální analýza — <span className="text-blue-700">{activeLabel}</span>
                <span className="font-mono text-xs text-slate-400 ml-1">{activeSensorId}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <SensorDSPPanel
            sensorId={activeSensorId}
            initialRecordId={trendSelectedSensorDataId || activeLatest?.id}
          />
            </CardContent>
          </Card>
        );
      })()}

      {/* Dialog přiřazení senzoru */}
      {assignDialog && (
        <AssignSensorDialog
          open={!!assignDialog}
          onClose={() => setAssignDialog(null)}
          rowIndex={assignDialog.rowIndex}
          rowLabel={assignDialog.rowLabel}
          currentAssignment={rowAssignments[assignDialog.rowIndex] || {}}
          onAssign={assignSensor}
        />
      )}
    </div>
  );
}