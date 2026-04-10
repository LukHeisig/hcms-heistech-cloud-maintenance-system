import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { RefreshCw, Activity } from "lucide-react";
import { applyHanning, computeRFFT, getVelocitySpectrum, calculateRMSFromSpectrum, computeHilbertEnvelope, filtfiltButterworthHPF } from "@/utils/dspMath";
import { format } from "date-fns";

export default function DSPVisualization() {
  const [selectedRecordId, setSelectedRecordId] = useState(null);

  const { data: records = [], isLoading } = useQuery({
    queryKey: ["rawSensorData"],
    queryFn: async () => {
      const all = await base44.entities.SensorData.list("-created_date", 200);
      return all.filter(r => r.has_raw && r.raw_x_json && r.raw_z_json);
    },
    refetchInterval: 30000,
  });

  const activeRecordId = selectedRecordId || records[0]?.id;
  const activeRecord = records.find(r => r.id === activeRecordId);

  const dspResults = useMemo(() => {
    if (!activeRecord) return null;
    try {
      const rawX = JSON.parse(activeRecord.raw_x_json);
      const rawY = JSON.parse(activeRecord.raw_y_json);
      const rawZ = JSON.parse(activeRecord.raw_z_json);
      const fs = 26700;

      // Zpracování osy Z - Zrychlení
      const winZ = applyHanning(rawZ);
      const fftZ = computeRFFT(winZ, fs);
      const rmsAccZ = calculateRMSFromSpectrum(fftZ.amplitudes, fftZ.frequencies, 0, fs/2);

      // Zpracování X, Y, Z - Rychlost
      const winX = applyHanning(rawX);
      const fftX = computeRFFT(winX, fs);
      const velXAmps = getVelocitySpectrum(fftX.amplitudes, fftX.frequencies);
      const rmsVelX = calculateRMSFromSpectrum(velXAmps, fftX.frequencies, 2, 1000);

      const winY = applyHanning(rawY);
      const fftY = computeRFFT(winY, fs);
      const velYAmps = getVelocitySpectrum(fftY.amplitudes, fftY.frequencies);
      const rmsVelY = calculateRMSFromSpectrum(velYAmps, fftY.frequencies, 2, 1000);

      const velZAmps = getVelocitySpectrum(fftZ.amplitudes, fftZ.frequencies);
      const rmsVelZ = calculateRMSFromSpectrum(velZAmps, fftZ.frequencies, 2, 1000);

      // Obálka Z
      const filteredZ = filtfiltButterworthHPF(rawZ, 500, fs);
      const envelopeZ = computeHilbertEnvelope(filteredZ);
      
      const meanEnv = envelopeZ.reduce((a,b)=>a+b,0)/envelopeZ.length;
      const demeanedEnv = new Float64Array(envelopeZ.length);
      for(let i=0;i<envelopeZ.length;i++) demeanedEnv[i] = envelopeZ[i] - meanEnv;
      
      const winEnvZ = applyHanning(demeanedEnv);
      const fftEnvZ = computeRFFT(winEnvZ, fs);
      const rmsEnvZ = calculateRMSFromSpectrum(fftEnvZ.amplitudes, fftEnvZ.frequencies, 0, fs/2);

      // Data pro grafy (downsampling na cca 500 bodů pro svižné vykreslení)
      const downsample = (arr, max=500) => {
        const step = Math.max(1, Math.floor(arr.length / max));
        const res = [];
        for(let i=0; i<arr.length; i+=step) res.push(arr[i]);
        return res;
      };

      const rawChart = downsample(rawZ, 500).map((val, i) => ({ 
          t: (i * (rawZ.length/500) * (1/fs)*1000).toFixed(1), 
          z: val 
      }));
      
      const specAccZ = [];
      const specVel = [];
      const specEnvZ = [];
      
      const freqStep = Math.max(1, Math.ceil(fftZ.frequencies.length/500));
      for(let i=0; i<fftZ.frequencies.length; i+=freqStep) {
        specAccZ.push({ f: fftZ.frequencies[i].toFixed(1), amp: fftZ.amplitudes[i] });
        if (fftZ.frequencies[i] <= 1000) {
            specVel.push({ 
                f: fftZ.frequencies[i].toFixed(1), 
                x: velXAmps[i], y: velYAmps[i], z: velZAmps[i] 
            });
        }
        specEnvZ.push({ f: fftEnvZ.frequencies[i].toFixed(1), amp: fftEnvZ.amplitudes[i] });
      }

      return {
        rmsAccZ, rmsVelX, rmsVelY, rmsVelZ, rmsEnvZ,
        rawChart, specAccZ, specVel, specEnvZ
      };
    } catch(e) {
      console.error(e);
      return null;
    }
  }, [activeRecord]);

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
              <CardHeader className="pb-2"><CardTitle className="text-sm">Časová vlna Z (Surová data) [g]</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={dspResults.rawChart}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="t" label={{ value: 'čas (ms)', position: 'insideBottomRight', offset: -5 }} />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="z" stroke="#3b82f6" dot={false} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Spektrum Zrychlení Z (g Peak)</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={dspResults.specAccZ}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="f" label={{ value: 'frekvence (Hz)', position: 'insideBottomRight', offset: -5 }} />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="amp" stroke="#10b981" dot={false} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Spektrum Rychlosti X, Y, Z (mm/s) [0-1000 Hz]</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={dspResults.specVel}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="f" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="x" stroke="#3b82f6" dot={false} isAnimationActive={false} name="Osa X" />
                    <Line type="monotone" dataKey="y" stroke="#10b981" dot={false} isAnimationActive={false} name="Osa Y" />
                    <Line type="monotone" dataKey="z" stroke="#f59e0b" dot={false} isAnimationActive={false} name="Osa Z" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Spektrum Obálky Z</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={dspResults.specEnvZ}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="f" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="amp" stroke="#f97316" dot={false} isAnimationActive={false} name="Amplituda" />
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