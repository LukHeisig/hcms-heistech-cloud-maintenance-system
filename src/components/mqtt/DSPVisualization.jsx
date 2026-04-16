import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceArea } from "recharts";
import { RefreshCw, Activity, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";

import { format } from "date-fns";

export default function DSPVisualization() {
  // force vite restart
  const [selectedRecordId, setSelectedRecordId] = useState(null);

  const { data: records = [], isLoading } = useQuery({
    queryKey: ["sensorDataWithFFT"],
    queryFn: async () => {
      return await base44.entities.SensorData.filter({ has_raw: true }, "-created_date", 200);
    },
    refetchInterval: 30000,
  });

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

    if (refAreaLeft > refAreaRight) [refAreaLeft, refAreaRight] = [refAreaRight, refAreaLeft];

    setZoomStates(prev => ({
      ...prev,
      [chartId]: {
        ...prev[chartId],
        refAreaLeft: '',
        refAreaRight: '',
        left: refAreaLeft,
        right: refAreaRight
      }
    }));
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
            t: (i * (1/fs)*1000).toFixed(1),
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

      const specAccZ = accZ.map((amp, i) => ({ f: (i * freqRes).toFixed(1), amp }));
      const specEnvZ = envZ.map((amp, i) => ({ f: (i * freqRes).toFixed(1), amp }));
      
      const specVel = [];
      const maxVelLen = Math.max(velX.length, velY.length, velZ.length);
      for (let i = 0; i < maxVelLen; i++) {
        specVel.push({
          f: (i * freqRes).toFixed(1),
          x: velX[i] || 0,
          y: velY[i] || 0,
          z: velZ[i] || 0
        });
      }

      return {
        rmsAccZ: activeRecord.rms_z_g || 0,
        rmsVelX: activeRecord.vel_rms_x_mm_s || 0,
        rmsVelY: activeRecord.vel_rms_y_mm_s || 0,
        rmsVelZ: activeRecord.vel_rms_z_mm_s || 0,
        rmsEnvZ: activeRecord.env_rms_z || 0,
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
      <div className="flex items-center gap-4">
        <div className="flex-1 max-w-md">
          <Select value={activeRecordId || ""} onValueChange={setSelectedRecordId}>
            <SelectTrigger>
              <SelectValue placeholder="Vyberte záznam pro analýzu..." />
            </SelectTrigger>
            <SelectContent>
              {records.map(r => (
                <SelectItem key={r.id} value={r.id}>
                  {r.sensor_id} - {format(new Date(r.created_date), "dd.MM.yyyy HH:mm:ss")}
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
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="bg-slate-100 text-slate-600 border-b border-slate-200">
                  <tr>
                    <th className="p-3 text-left">Metrika</th>
                    <th className="p-3 text-left">Osa X</th>
                    <th className="p-3 text-left">Osa Y</th>
                    <th className="p-3 text-left">Osa Z</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-slate-100">
                    <td className="p-3 font-medium">RMS Rychlosti (2-1000 Hz) [mm/s]</td>
                    <td className="p-3">{dspResults.rmsVelX.toFixed(3)}</td>
                    <td className="p-3">{dspResults.rmsVelY.toFixed(3)}</td>
                    <td className="p-3 font-bold">{dspResults.rmsVelZ.toFixed(3)}</td>
                  </tr>
                  <tr className="border-b border-slate-100">
                    <td className="p-3 font-medium">RMS Zrychlení (Peak to RMS) [g]</td>
                    <td className="p-3 text-slate-400">-</td>
                    <td className="p-3 text-slate-400">-</td>
                    <td className="p-3 font-bold">{dspResults.rmsAccZ.toFixed(3)}</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-medium">RMS Obálky (&gt;500 Hz filtr) [g]</td>
                    <td className="p-3 text-slate-400">-</td>
                    <td className="p-3 text-slate-400">-</td>
                    <td className="p-3 font-bold text-orange-600">{dspResults.rmsEnvZ.toFixed(3)}</td>
                  </tr>
                </tbody>
              </table>
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