import React, { useState, useMemo, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceArea } from "recharts";
import { RefreshCw, Activity, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";

import { format } from "date-fns";

export default function DSPVisualization() {
  const [selectedSensorId, setSelectedSensorId] = useState(null);
  const [selectedRecordId, setSelectedRecordId] = useState(null);

  // Načteme všechny senzory pro selector
  const { data: allSensors = [] } = useQuery({
    queryKey: ["aissens_sensors"],
    queryFn: () => base44.entities.AissensSensor.list("-last_seen", 500),
    staleTime: 60000,
  });

  // Záznamy s FFT pro vybraný senzor (nebo všechny)
  const { data: records = [], isLoading } = useQuery({
    queryKey: ["sensorDataWithFFT", selectedSensorId],
    queryFn: async () => {
      const filter = selectedSensorId
        ? { has_fft: true, sensor_id: selectedSensorId }
        : { has_fft: true };
      return await base44.entities.SensorData.filter(filter, "-created_date", 100);
    },
    staleTime: 0,
    refetchInterval: 30000,
  });

  // Reset výběru záznamu při změně senzoru
  useEffect(() => { setSelectedRecordId(null); }, [selectedSensorId]);

  const activeRecordId = selectedRecordId || records[0]?.id;
  const activeRecord = records.find(r => r.id === activeRecordId);

  // Zvlášť natáhneme FFT entitu, která patří k vybranému záznamu
  const { data: fftRecords = [], isLoading: isLoadingFFT } = useQuery({
    queryKey: ["sensorFFT", activeRecord?.id],
    queryFn: async () => {
      if (!activeRecord) return [];
      return await base44.entities.SensorFFTData.filter({ sensor_data_id: activeRecord.id });
    },
    enabled: !!activeRecord,
  });

  const activeFFT = fftRecords[0];

  // Zoom states pro grafy
  const [zoomStates, setZoomStates] = useState({
    raw: { refAreaLeft: '', refAreaRight: '', left: 'dataMin', right: 'dataMax', top: 'dataMax+1', bottom: 'dataMin-1' },
    acc: { refAreaLeft: '', refAreaRight: '', left: 'dataMin', right: 'dataMax', top: 'dataMax+1', bottom: 'dataMin-1' },
    vel: { refAreaLeft: '', refAreaRight: '', left: 'dataMin', right: 'dataMax', top: 'dataMax+1', bottom: 'dataMin-1' },
    env: { refAreaLeft: '', refAreaRight: '', left: 'dataMin', right: 'dataMax', top: 'dataMax+1', bottom: 'dataMin-1' }
  });

  const zoomOut = (chartId) => {
    setZoomStates(prev => ({
      ...prev,
      [chartId]: { ...prev[chartId], refAreaLeft: '', refAreaRight: '', left: 'dataMin', right: 'dataMax', top: 'dataMax+1', bottom: 'dataMin-1' }
    }));
  };

  const handleZoom = (chartId, xAxisKey) => {
    let { refAreaLeft, refAreaRight } = zoomStates[chartId];
    if (refAreaLeft === refAreaRight || refAreaRight === '') {
      setZoomStates(prev => ({ ...prev, [chartId]: { ...prev[chartId], refAreaLeft: '', refAreaRight: '' } }));
      return;
    }

    let left = Number(refAreaLeft);
    let right = Number(refAreaRight);

    if (left > right) [left, right] = [right, left];

    setZoomStates(prev => ({
      ...prev,
      [chartId]: {
        ...prev[chartId],
        refAreaLeft: '',
        refAreaRight: '',
        left,
        right
      }
    }));
  };

  // Výpočet RMS z peak amplitud spektra (Parsevalova věta)
  const calcRMSFromSpectrum = (amps, freqRes, minFreq, maxFreq) => {
    let sumSq = 0;
    for (let i = 0; i < amps.length; i++) {
      const f = i * freqRes;
      if (f >= minFreq && f <= maxFreq && f > 0) {
        sumSq += amps[i] * amps[i];
      }
    }
    return Math.sqrt(sumSq / 2);
  };

  const dspResults = useMemo(() => {
    if (!activeRecord || !activeFFT) return null;
    try {
      // 1) Časová vlna surových dat
      let rawChart = [];
      if (activeRecord.has_raw && activeRecord.raw_z_json) {
        const rawZ = JSON.parse(activeRecord.raw_z_json);
        const fs = 26700;
        const maxLen = 500;
        const step = Math.max(1, Math.floor(rawZ.length / maxLen));
        for (let i = 0; i < rawZ.length; i += step) {
          rawChart.push({
            t: Number((i * (1/fs)*1000).toFixed(1)),
            z: rawZ[i]
          });
        }
      }

      // 2) Frekvenční spektra
      const freqRes = activeFFT.frequency_resolution || 3.259;
      
      const accZ = activeFFT.acc_z_json ? JSON.parse(activeFFT.acc_z_json) : [];
      const velX = activeFFT.vel_x_json ? JSON.parse(activeFFT.vel_x_json) : [];
      const velY = activeFFT.vel_y_json ? JSON.parse(activeFFT.vel_y_json) : [];
      const velZ = activeFFT.vel_z_json ? JSON.parse(activeFFT.vel_z_json) : [];
      const envZ = activeFFT.env_z_json ? JSON.parse(activeFFT.env_z_json) : [];

      const specAccZ = accZ.map((amp, i) => ({ f: Number((i * freqRes).toFixed(1)), amp }));
      const specEnvZ = envZ.map((amp, i) => ({ f: Number((i * freqRes).toFixed(1)), amp }));
      
      const specVel = [];
      const maxVelLen = Math.max(velX.length, velY.length, velZ.length);
      for (let i = 0; i < maxVelLen; i++) {
        specVel.push({
          f: Number((i * freqRes).toFixed(1)),
          x: velX[i] || 0,
          y: velY[i] || 0,
          z: velZ[i] || 0
        });
      }

      // Počítej RMS přímo ze spekter (Parsevalova věta: RMS = sqrt(sum(A_i^2)/2))
      const rmsVelX = calcRMSFromSpectrum(specVel.map(p => p.x), freqRes, 2, 1000);
      const rmsVelY = calcRMSFromSpectrum(specVel.map(p => p.y), freqRes, 2, 1000);
      const rmsVelZ = calcRMSFromSpectrum(specVel.map(p => p.z), freqRes, 2, 1000);
      const rmsAccZ = calcRMSFromSpectrum(specAccZ.map(p => p.amp), freqRes, 2, 6000);
      const rmsEnvZ = calcRMSFromSpectrum(specEnvZ.map(p => p.amp), freqRes, 2, 1000);

      return {
        rmsAccZ,
        rmsVelX,
        rmsVelY,
        rmsVelZ,
        rmsEnvZ,
        rawChart,
        specAccZ,
        specVel,
        specEnvZ
      };
    } catch(e) {
      console.error("Chyba parsování FFT:", e);
      return null;
    }
  }, [activeRecord, activeFFT]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={selectedSensorId || "__all__"} onValueChange={v => setSelectedSensorId(v === "__all__" ? null : v)}>
          <SelectTrigger className="w-64">
            <SelectValue placeholder="Všechny senzory" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">— Všechny senzory —</SelectItem>
            {allSensors.map(s => (
              <SelectItem key={s.sensor_id} value={s.sensor_id}>
                <span className="font-mono text-blue-700">{s.sensor_id}</span>
                {s.name && s.name !== s.sensor_id && <span className="text-slate-400 ml-2 text-xs">— {s.name}</span>}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex-1 max-w-md">
          <Select value={activeRecordId || ""} onValueChange={setSelectedRecordId}>
            <SelectTrigger>
              <SelectValue placeholder="Vyberte záznam pro analýzu..." />
            </SelectTrigger>
            <SelectContent>
              {records.map(r => (
                <SelectItem key={r.id} value={r.id}>
                  {r.sensor_id} — {new Date(r.created_date).toLocaleString("cs-CZ", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center p-12 text-slate-500">
          <RefreshCw className="w-6 h-6 animate-spin mr-2" /> Probíhá načítání dat...
        </div>
      ) : !activeFFT ? (
        <Card><CardContent className="p-12 text-center text-slate-500">
          <Activity className="w-12 h-12 mx-auto text-slate-300 mb-4" />
          <p className="font-semibold text-lg text-slate-700">Starý záznam</p>
          <p className="mt-2">Tento záznam z databáze nemá uložená FFT spektra.</p>
          <p className="text-sm mt-1">Zpracování na serveru se provádí automaticky až pro všechna <b>nově</b> přijatá data ze senzorů.</p>
        </CardContent></Card>
      ) : !dspResults ? (
        <Card><CardContent className="p-12 text-center text-slate-500">Vyberte platný záznam s raw daty.</CardContent></Card>
      ) : (
        <>
          <Card>
            <CardHeader className="border-b border-slate-100 bg-slate-50">
              <CardTitle className="text-base flex items-center gap-2"><Activity className="w-5 h-5 text-blue-600"/> Tabulka celkových hodnot RMS</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="flex flex-wrap gap-6">
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-slate-500">RMS Rychlosti (2-1000 Hz) [mm/s]</span>
                  <div className="flex gap-4">
                    <span className="text-sm">X: <span className="font-semibold">{dspResults.rmsVelX.toFixed(3)}</span></span>
                    <span className="text-sm">Y: <span className="font-semibold">{dspResults.rmsVelY.toFixed(3)}</span></span>
                    <span className="text-sm">Z: <span className="font-bold text-blue-700">{dspResults.rmsVelZ.toFixed(3)}</span></span>
                  </div>
                </div>
                <div className="w-px bg-slate-200 self-stretch hidden sm:block" />
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-slate-500">RMS Zrychlení Z (2-6000 Hz) [g]</span>
                  <span className="text-sm">Z: <span className="font-bold text-green-700">{dspResults.rmsAccZ.toFixed(3)}</span></span>
                </div>
                <div className="w-px bg-slate-200 self-stretch hidden sm:block" />
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-slate-500">RMS Obálky Z (&gt;500 Hz filtr) [g]</span>
                  <span className="text-sm">Z: <span className="font-bold text-orange-600">{dspResults.rmsEnvZ.toFixed(3)}</span></span>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-sm">Časová vlna Z (Surová data) [g]</CardTitle>
                {zoomStates.raw.left !== 'dataMin' && <Button variant="outline" size="sm" onClick={() => zoomOut('raw')} className="h-7 px-2 text-xs"><ZoomOut className="w-3 h-3 mr-1" />Zrušit zoom</Button>}
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart 
                    data={dspResults.rawChart} 
                    onMouseDown={e => e && setZoomStates(prev => ({ ...prev, raw: { ...prev.raw, refAreaLeft: e.activeLabel } }))} 
                    onMouseMove={e => zoomStates.raw.refAreaLeft && e && setZoomStates(prev => ({ ...prev, raw: { ...prev.raw, refAreaRight: e.activeLabel } }))} 
                    onMouseUp={() => handleZoom('raw', 't')}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="t" domain={[zoomStates.raw.left, zoomStates.raw.right]} type="number" allowDataOverflow label={{ value: 'čas (ms)', position: 'insideBottomRight', offset: -5 }} />
                    <YAxis domain={['auto', 'auto']} allowDataOverflow />
                    <Tooltip />
                    <Line type="monotone" dataKey="z" stroke="#3b82f6" dot={false} isAnimationActive={false} />
                    {zoomStates.raw.refAreaLeft && zoomStates.raw.refAreaRight ? <ReferenceArea x1={zoomStates.raw.refAreaLeft} x2={zoomStates.raw.refAreaRight} strokeOpacity={0.3} /> : null}
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-sm">Spektrum Zrychlení Z (g Peak)</CardTitle>
                {zoomStates.acc.left !== 'dataMin' && <Button variant="outline" size="sm" onClick={() => zoomOut('acc')} className="h-7 px-2 text-xs"><ZoomOut className="w-3 h-3 mr-1" />Zrušit zoom</Button>}
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart 
                    data={dspResults.specAccZ}
                    onMouseDown={e => e && setZoomStates(prev => ({ ...prev, acc: { ...prev.acc, refAreaLeft: e.activeLabel } }))} 
                    onMouseMove={e => zoomStates.acc.refAreaLeft && e && setZoomStates(prev => ({ ...prev, acc: { ...prev.acc, refAreaRight: e.activeLabel } }))} 
                    onMouseUp={() => handleZoom('acc', 'f')}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="f" domain={[zoomStates.acc.left, zoomStates.acc.right]} type="number" allowDataOverflow label={{ value: 'frekvence (Hz)', position: 'insideBottomRight', offset: -5 }} />
                    <YAxis domain={['auto', 'auto']} allowDataOverflow />
                    <Tooltip />
                    <Line type="monotone" dataKey="amp" stroke="#10b981" dot={false} isAnimationActive={false} />
                    {zoomStates.acc.refAreaLeft && zoomStates.acc.refAreaRight ? <ReferenceArea x1={zoomStates.acc.refAreaLeft} x2={zoomStates.acc.refAreaRight} strokeOpacity={0.3} /> : null}
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-sm">Spektrum Rychlosti X, Y, Z (mm/s) [0-1000 Hz]</CardTitle>
                {zoomStates.vel.left !== 'dataMin' && <Button variant="outline" size="sm" onClick={() => zoomOut('vel')} className="h-7 px-2 text-xs"><ZoomOut className="w-3 h-3 mr-1" />Zrušit zoom</Button>}
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart 
                    data={dspResults.specVel}
                    onMouseDown={e => e && setZoomStates(prev => ({ ...prev, vel: { ...prev.vel, refAreaLeft: e.activeLabel } }))} 
                    onMouseMove={e => zoomStates.vel.refAreaLeft && e && setZoomStates(prev => ({ ...prev, vel: { ...prev.vel, refAreaRight: e.activeLabel } }))} 
                    onMouseUp={() => handleZoom('vel', 'f')}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="f" domain={[zoomStates.vel.left, zoomStates.vel.right]} type="number" allowDataOverflow />
                    <YAxis domain={['auto', 'auto']} allowDataOverflow />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="x" stroke="#3b82f6" dot={false} isAnimationActive={false} name="Osa X" />
                    <Line type="monotone" dataKey="y" stroke="#10b981" dot={false} isAnimationActive={false} name="Osa Y" />
                    <Line type="monotone" dataKey="z" stroke="#f59e0b" dot={false} isAnimationActive={false} name="Osa Z" />
                    {zoomStates.vel.refAreaLeft && zoomStates.vel.refAreaRight ? <ReferenceArea x1={zoomStates.vel.refAreaLeft} x2={zoomStates.vel.refAreaRight} strokeOpacity={0.3} /> : null}
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-sm">Spektrum Obálky Z</CardTitle>
                {zoomStates.env.left !== 'dataMin' && <Button variant="outline" size="sm" onClick={() => zoomOut('env')} className="h-7 px-2 text-xs"><ZoomOut className="w-3 h-3 mr-1" />Zrušit zoom</Button>}
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart 
                    data={dspResults.specEnvZ}
                    onMouseDown={e => e && setZoomStates(prev => ({ ...prev, env: { ...prev.env, refAreaLeft: e.activeLabel } }))} 
                    onMouseMove={e => zoomStates.env.refAreaLeft && e && setZoomStates(prev => ({ ...prev, env: { ...prev.env, refAreaRight: e.activeLabel } }))} 
                    onMouseUp={() => handleZoom('env', 'f')}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="f" domain={[zoomStates.env.left, zoomStates.env.right]} type="number" allowDataOverflow />
                    <YAxis domain={['auto', 'auto']} allowDataOverflow />
                    <Tooltip />
                    <Line type="monotone" dataKey="amp" stroke="#f97316" dot={false} isAnimationActive={false} name="Amplituda" />
                    {zoomStates.env.refAreaLeft && zoomStates.env.refAreaRight ? <ReferenceArea x1={zoomStates.env.refAreaLeft} x2={zoomStates.env.refAreaRight} strokeOpacity={0.3} /> : null}
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