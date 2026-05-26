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

// Dialog pro přiřazení senzoru k řádku
function AssignSensorDialog({ open, onClose, rowIndex, rowLabel, currentSensorId, onAssign }) {
  const [selected, setSelected] = useState(currentSensorId || "");

  // Načteme registrované senzory (malá tabulka, rychlé)
  const { data: registeredSensors = [], isLoading } = useQuery({
    queryKey: ["aissens_sensors"],
    queryFn: () => base44.entities.AissensSensor.list(null, 500),
    enabled: open,
    staleTime: 60000,
  });

  // Doplníme o IDs z posledních 200 SensorData záznamů (zachytí neregistrované senzory)
  const { data: recentSensorData = [] } = useQuery({
    queryKey: ["recentSensorDataIds"],
    queryFn: async () => {
      const records = await base44.entities.SensorData.list("-created_date", 200);
      return [...new Set(records.map(r => r.sensor_id).filter(Boolean))].sort();
    },
    enabled: open,
    staleTime: 60000,
  });

  // Sloučíme: registrované + neregistrované z posledních dat
  const allSensorIds = useMemo(() => {
    const registeredIds = registeredSensors.map(s => s.sensor_id);
    const merged = [...new Set([...registeredIds, ...recentSensorData])].sort();
    return merged;
  }, [registeredSensors, recentSensorData]);

  const getSensorName = (sid) => registeredSensors.find(s => s.sensor_id === sid)?.name || null;

  const handleSave = () => {
    onAssign(rowIndex, selected || null);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Přiřadit senzor — {rowLabel}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <p className="text-sm text-slate-500">
            Vyberte senzor ze všech aktivních ID senzorů, která kdy odeslala data.
          </p>
          <Select value={selected || "__none__"} onValueChange={v => setSelected(v === "__none__" ? "" : v)}>
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
                  <span className="text-sm">X: <span className="font-semibold text-blue-700">{dsp.rmsVelX.toFixed(3)}</span></span>
                  <span className="text-sm">Y: <span className="font-semibold text-blue-700">{dsp.rmsVelY.toFixed(3)}</span></span>
                  <span className="text-sm">Z: <span className="font-bold text-blue-700">{dsp.rmsVelZ.toFixed(3)}</span></span>
                </div>
              </div>
              <div className="w-px bg-slate-200 self-stretch hidden sm:block" />
              <div>
                <p className="text-xs text-slate-400">RMS Zrychlení Z (2-6000 Hz) [g]</p>
                <span className="text-sm mt-1">Z: <span className="font-bold text-green-700">{dsp.rmsAccZ.toFixed(3)}</span></span>
              </div>
              <div className="w-px bg-slate-200 self-stretch hidden sm:block" />
              <div>
                <p className="text-xs text-slate-400">RMS Obálky Z (&gt;500 Hz) [g]</p>
                <span className="text-sm mt-1">Z: <span className="font-bold text-orange-600">{dsp.rmsEnvZ.toFixed(3)}</span></span>
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

  // Načteme senzory přiřazené k tomuto stroji
  const { data: sensors = [], refetch: refetchSensors } = useQuery({
    queryKey: ["aissens-sensors", machineId],
    queryFn: () => base44.entities.AissensSensor.filter({ machine_id: machineId }),
    enabled: !!machineId,
  });

  // Parsování řádků ze schématu
  const schemaRows = useMemo(() => {
    if (!vibrationSchema?.rows_definition) return [];
    try {
      return JSON.parse(vibrationSchema.rows_definition);
    } catch (e) { return []; }
  }, [vibrationSchema]);

  // Lokální stav — přiřazení sensorId k indexu řádku (uloženo v localStorage per machine)
  const storageKey = `vibro_row_sensors_${machineId}`;
  const [rowSensors, setRowSensors] = useState(() => {
    try { return JSON.parse(localStorage.getItem(storageKey) || "{}"); } catch { return {}; }
  });

  const assignSensor = (rowIndex, sensorId) => {
    const updated = { ...rowSensors, [rowIndex]: sensorId };
    setRowSensors(updated);
    localStorage.setItem(storageKey, JSON.stringify(updated));
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
      // Načteme poslední záznam s has_fft pro každý senzor + odpovídající SensorFFTData
      const results = await Promise.all(
        assignedSensorIds.map(async (sid) => {
          // Najdeme nejnovější záznam s FFT daty
          const records = await base44.entities.SensorData.filter({ sensor_id: sid, has_fft: true }, "-created_date", 1);
          const sensorDataRecord = records[0];
          if (!sensorDataRecord) return null;

          // Načteme k němu SensorFFTData pro získání oa_x/oa_y/oa_z
          const fftRecs = await base44.entities.SensorFFTData.filter({ sensor_data_id: sensorDataRecord.id });
          const fft = fftRecs[0];

          return {
            ...sensorDataRecord,
            // Preferujeme uložené předpočítané hodnoty v SensorData, pak fallback z SensorFFTData
            vel_rms_x_mm_s: sensorDataRecord.vel_rms_x_mm_s ?? fft?.oa_x ?? null,
            vel_rms_y_mm_s: sensorDataRecord.vel_rms_y_mm_s ?? fft?.oa_y ?? null,
            vel_rms_z_mm_s: sensorDataRecord.vel_rms_z_mm_s ?? fft?.oa_z ?? null,
            oa_acc_z: sensorDataRecord.oa_acc_z ?? fft?.oa_acc_z ?? null,
            env_rms_z: sensorDataRecord.env_rms_z ?? null,
          };
        })
      );
      return results.filter(Boolean);
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
          <div className="grid grid-cols-[2fr_2fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_auto] gap-0 bg-slate-100 border-b border-slate-200 px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">
            <div>Místo</div>
            <div>ID senzoru / čas měření</div>
            <div className="text-center">Vel X<br/><span className="text-[10px] normal-case font-normal">[mm/s]</span></div>
            <div className="text-center">Vel Y<br/><span className="text-[10px] normal-case font-normal">[mm/s]</span></div>
            <div className="text-center">Vel Z<br/><span className="text-[10px] normal-case font-normal">[mm/s]</span></div>
            <div className="text-center">Acc Z<br/><span className="text-[10px] normal-case font-normal">[g]</span></div>
            <div className="text-center">Obálka Z<br/><span className="text-[10px] normal-case font-normal">[g]</span></div>
            <div className="text-center">Teplota<br/><span className="text-[10px] normal-case font-normal">[°C]</span></div>
            <div className="text-center">Baterie<br/><span className="text-[10px] normal-case font-normal">[0-4]</span></div>
            <div className="text-center">Signál<br/><span className="text-[10px] normal-case font-normal">[dBm]</span></div>
            <div></div>
          </div>

          {schemaRows.map((row, idx) => {
            const sensorId = rowSensors[idx];
            const latest = getDisplayData(sensorId);
            const sensorInfo = getSensorById(sensorId);
            const isSelected = activeRowIdx === idx;
            const label = row.label || row.name || `Bod ${idx + 1}`;
            const name = row.name || "";

            // Baterie: barva dle úrovně (0=prázdná, 4=plná)
            const batteryLevel = sensorInfo?.last_battery_level;
            const batteryColor = batteryLevel == null ? "text-slate-300" : batteryLevel >= 3 ? "text-green-600" : batteryLevel >= 2 ? "text-yellow-600" : "text-red-600";
            // Signál: barva dle dBm
            const rssi = sensorInfo?.last_signal_strength;
            const rssiColor = rssi == null ? "text-slate-300" : rssi >= -65 ? "text-green-600" : rssi >= -80 ? "text-yellow-600" : "text-red-600";
            // Teplota
            const temp = sensorInfo?.last_temperature;

            return (
              <div key={idx} className="border-b border-slate-100 last:border-0">
                <div
                  className={`grid grid-cols-[2fr_2fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_auto] gap-0 px-4 py-3 text-sm transition-colors items-center ${sensorId ? "cursor-pointer hover:bg-blue-50/50" : ""} ${isSelected ? "bg-blue-50 border-l-2 border-l-blue-500" : ""}`}
                  onClick={() => {
                    if (!sensorId) return;
                    setSelectedRow(idx);
                    setTrendConfig({ sensorId, metricKey: "vel_xyz" });
                    setTrendSelectedSensorDataId(null);
                  }}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 flex-shrink-0 flex items-center justify-center">
                      {isSelected && sensorId && <div className="w-2 h-2 rounded-full bg-blue-500" />}
                    </div>
                    <div>
                      <span className="font-semibold text-slate-900">{label}</span>
                      {name && name !== label && <span className="text-slate-500 ml-1 text-xs">{name}</span>}
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

                  {/* RMS hodnoty — kliknutím nastaví trend */}
                  {[
                    { metricKey: "vel_x", value: latest?.vel_rms_x_mm_s, color: "text-blue-700" },
                    { metricKey: "vel_y", value: latest?.vel_rms_y_mm_s, color: "text-blue-700" },
                    { metricKey: "vel_z", value: latest?.vel_rms_z_mm_s, color: "text-blue-700" },
                    { metricKey: "acc_z", value: latest?.oa_acc_z, color: "text-green-700" },
                    { metricKey: "env_z", value: latest?.env_rms_z, color: "text-orange-600" },
                  ].map(({ metricKey, value, color }) => {
                    const isActiveTrend = sensorId && activeTrendSensorId === sensorId && activeTrendMetric === metricKey;
                    return (
                      <div
                        key={metricKey}
                        className={`text-center font-mono text-xs rounded transition-colors ${sensorId ? "cursor-pointer hover:bg-blue-100" : ""} ${isActiveTrend ? "bg-blue-100 ring-1 ring-blue-400" : ""}`}
                        onClick={(e) => { e.stopPropagation(); if (sensorId) setTrendConfig({ sensorId, metricKey }); }}
                        title={sensorId ? `Zobrazit trend: ${METRIC_DEFS[metricKey]?.label}` : ""}
                      >
                        {value != null ? <span className={`${color} font-semibold`}>{value.toFixed(3)}</span> : <span className="text-slate-300">—</span>}
                      </div>
                    );
                  })}

                  {/* Teplota */}
                  <div className="text-center font-mono text-xs">
                    {temp != null ? <span className="text-purple-700 font-semibold">{temp.toFixed(1)}</span> : <span className="text-slate-300">—</span>}
                  </div>

                  {/* Baterie */}
                  <div className="text-center font-mono text-xs">
                    {batteryLevel != null ? <span className={`font-semibold ${batteryColor}`}>{batteryLevel}/4</span> : <span className="text-slate-300">—</span>}
                  </div>

                  {/* Signál */}
                  <div className="text-center font-mono text-xs">
                    {rssi != null ? <span className={`font-semibold ${rssiColor}`}>{rssi}</span> : <span className="text-slate-300">—</span>}
                  </div>

                  {/* Tlačítko přiřazení */}
                  <div className="flex justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-slate-500 hover:text-blue-600"
                      onClick={(e) => { e.stopPropagation(); setAssignDialog({ rowIndex: idx, rowLabel: `${label}${name && name !== label ? ' — ' + name : ''}` }); }}
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
          currentSensorId={rowSensors[assignDialog.rowIndex] || ""}
          onAssign={assignSensor}
        />
      )}
    </div>
  );
}