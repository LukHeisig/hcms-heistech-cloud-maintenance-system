import React, { useState, useEffect, useMemo, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceArea, ReferenceLine
} from "recharts";
import { Activity, RefreshCw, ZoomOut, Maximize2, X } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import VibrationAIAnalysis, { LimitEvaluationPanel } from "@/components/machine/VibrationAIAnalysis";

// Barvy ložiskových frekvencí
const BEARING_FREQ_COLORS = {
  BPFO: "#ef4444",
  BPFI: "#3b82f6",
  BSF:  "#f59e0b",
  FTF:  "#8b5cf6",
};

function calcBearingDefectCoefs(nb, bd, pd, alpha_deg) {
  const alpha = (alpha_deg || 0) * Math.PI / 180;
  const ratio = (bd / pd) * Math.cos(alpha);
  return {
    bpfo: +(0.5 * nb * (1 - ratio)).toFixed(4),
    bpfi: +(0.5 * nb * (1 + ratio)).toFixed(4),
    bsf:  +(0.5 * (pd / bd) * (1 - ratio * ratio)).toFixed(4),
    ftf:  +(0.5 * (1 - ratio)).toFixed(4),
  };
}

function detectRpmFromSpectrum(specVel, freqRes) {
  if (!specVel || specVel.length === 0) return null;
  let maxAmp = 0, maxIdx = -1;
  for (let i = 0; i < specVel.length; i++) {
    const f = i * freqRes;
    if (f < 5 || f > 200) continue;
    const amp = Math.max(specVel[i]?.x || 0, specVel[i]?.y || 0, specVel[i]?.z || 0);
    if (amp > maxAmp) { maxAmp = amp; maxIdx = i; }
  }
  if (maxIdx < 0 || maxAmp === 0) return null;
  return Math.round(maxIdx * freqRes * 60);
}

// Panel pro nastavení ložiskových překryvů
function BearingOverlayPanel({ bearing, specVel, freqRes, rpm, onRpmChange, visibleFreqs, onToggleFreq, showHarmonics, onToggleHarmonics }) {
  const autoRpm = useMemo(() => detectRpmFromSpectrum(specVel, freqRes), [specVel, freqRes]);
  const [manualMode, setManualMode] = useState(false);
  const [inputVal, setInputVal] = useState("");

  const displayRpm = rpm ?? autoRpm ?? 1500;
  const coefs = useMemo(
    () => calcBearingDefectCoefs(bearing.nb, bearing.bd, bearing.pd, bearing.contact_angle_deg || 0),
    [bearing]
  );
  const fr = displayRpm / 60;
  const freqs = {
    BPFO: +(coefs.bpfo * fr).toFixed(2),
    BPFI: +(coefs.bpfi * fr).toFixed(2),
    BSF:  +(coefs.bsf  * fr).toFixed(2),
    FTF:  +(coefs.ftf  * fr).toFixed(2),
  };

  const handleApply = () => {
    const v = parseFloat(inputVal);
    if (v > 0) { onRpmChange(Math.round(v)); setManualMode(false); }
  };

  return (
    <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 flex flex-col gap-2">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <span className="text-xs font-bold text-orange-700">
          ⚙ Ložisko {bearing.designation} — překryvy defektních frekvencí
        </span>
        <div className="flex items-center gap-2 flex-wrap">
          {autoRpm && !manualMode && (
            <span className="text-[10px] text-slate-500 bg-white border border-slate-200 rounded px-1.5 py-0.5">
              Auto-detekce: <span className="font-mono font-bold text-slate-700">{autoRpm} RPM</span>
              {rpm == null && <span className="text-green-600 ml-1">(aktivní)</span>}
            </span>
          )}
          {!manualMode ? (
            <button
              className="text-[10px] border border-orange-300 rounded px-2 py-0.5 bg-white text-orange-700 hover:bg-orange-100 font-semibold"
              onClick={() => { setManualMode(true); setInputVal(String(displayRpm)); }}
            >
              {rpm != null ? `${rpm} RPM ✎` : "Zadat otáčky ručně"}
            </button>
          ) : (
            <div className="flex items-center gap-1">
              <input
                type="number"
                value={inputVal}
                onChange={e => setInputVal(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleApply()}
                className="h-6 w-20 px-1.5 text-xs border border-orange-300 rounded font-mono"
                placeholder="RPM"
                autoFocus
              />
              <button className="text-[10px] bg-orange-500 text-white rounded px-2 py-0.5 font-semibold" onClick={handleApply}>OK</button>
              {rpm != null && (
                <button className="text-[10px] bg-white border border-orange-300 text-orange-600 rounded px-2 py-0.5"
                  onClick={() => { onRpmChange(null); setManualMode(false); }}>
                  Auto
                </button>
              )}
              <button className="text-[10px] text-slate-400 hover:text-slate-700 px-1" onClick={() => setManualMode(false)}>✕</button>
            </div>
          )}
        </div>
      </div>
      {/* Přepínače typů frekvencí */}
      <div className="flex flex-wrap gap-1.5">
        {Object.entries(freqs).map(([name, hz]) => {
          const on = visibleFreqs[name] !== false;
          return (
            <button
              key={name}
              onClick={() => onToggleFreq(name)}
              className={`flex items-center gap-1.5 text-[11px] font-semibold rounded px-2 py-0.5 border transition-all ${
                on ? "border-transparent text-white" : "border-slate-300 bg-white text-slate-500"
              }`}
              style={on ? { backgroundColor: BEARING_FREQ_COLORS[name] } : {}}
              title={`${on ? "Skrýt" : "Zobrazit"} ${name}`}
            >
              <span>{name}</span>
              <span className={`font-mono font-normal text-[10px] ${on ? "opacity-80" : ""}`}>{hz} Hz</span>
            </button>
          );
        })}
      </div>
      {/* Harmonické otáčkové frekvence */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-[11px] text-orange-700 font-mono bg-orange-100 rounded px-2 py-0.5">
          1X = {fr.toFixed(2)} Hz
        </span>
        <button
          onClick={onToggleHarmonics}
          className={`text-[11px] font-semibold rounded px-2 py-0.5 border transition-all ${
            showHarmonics ? "bg-orange-600 text-white border-transparent" : "bg-white text-orange-700 border-orange-300 hover:bg-orange-100"
          }`}
        >
          {showHarmonics ? "Skrýt harmonické (2X–8X)" : "Zobrazit harmonické 2X–8X"}
        </button>
      </div>
      <p className="text-[9px] text-slate-400">
        Svislé čáry jsou vykresleny ve spektrech Zrychlení Z, Rychlosti a Obálky Z.
      </p>
    </div>
  );
}

// Standalone panel pro otáčkovou frekvenci (bez ložiska)
function RotationalFreqPanel({ specVel, freqRes, rpm, onRpmChange, showHarmonics, onToggleHarmonics }) {
  const autoRpm = useMemo(() => detectRpmFromSpectrum(specVel, freqRes), [specVel, freqRes]);
  const [manualMode, setManualMode] = useState(false);
  const [inputVal, setInputVal] = useState("");

  const displayRpm = rpm ?? autoRpm ?? null;
  const fr = displayRpm ? (displayRpm / 60).toFixed(2) : null;

  const handleApply = () => {
    const v = parseFloat(inputVal);
    if (v > 0) { onRpmChange(Math.round(v)); setManualMode(false); }
  };

  if (!displayRpm && !autoRpm) return null;

  return (
    <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 flex flex-col gap-2">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <span className="text-xs font-bold text-indigo-700">⟳ Otáčková frekvence</span>
        <div className="flex items-center gap-2 flex-wrap">
          {autoRpm && !manualMode && (
            <span className="text-[10px] text-slate-500 bg-white border border-slate-200 rounded px-1.5 py-0.5">
              Auto-detekce: <span className="font-mono font-bold text-slate-700">{autoRpm} RPM</span>
              {rpm == null && <span className="text-green-600 ml-1">(aktivní)</span>}
            </span>
          )}
          {!manualMode ? (
            <button
              className="text-[10px] border border-indigo-300 rounded px-2 py-0.5 bg-white text-indigo-700 hover:bg-indigo-100 font-semibold"
              onClick={() => { setManualMode(true); setInputVal(String(displayRpm || "")); }}
            >
              {rpm != null ? `${rpm} RPM ✎` : "Zadat otáčky ručně"}
            </button>
          ) : (
            <div className="flex items-center gap-1">
              <input type="number" value={inputVal} onChange={e => setInputVal(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleApply()}
                className="h-6 w-20 px-1.5 text-xs border border-indigo-300 rounded font-mono"
                placeholder="RPM" autoFocus />
              <button className="text-[10px] bg-indigo-500 text-white rounded px-2 py-0.5 font-semibold" onClick={handleApply}>OK</button>
              {rpm != null && (
                <button className="text-[10px] bg-white border border-indigo-300 text-indigo-600 rounded px-2 py-0.5"
                  onClick={() => { onRpmChange(null); setManualMode(false); }}>Auto</button>
              )}
              <button className="text-[10px] text-slate-400 px-1" onClick={() => setManualMode(false)}>✕</button>
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        {fr && (
          <span className="text-[11px] text-indigo-700 font-mono bg-indigo-100 rounded px-2 py-0.5">
            1X = {fr} Hz ({displayRpm} RPM)
          </span>
        )}
        <button
          onClick={onToggleHarmonics}
          className={`text-[11px] font-semibold rounded px-2 py-0.5 border transition-all ${
            showHarmonics ? "bg-indigo-600 text-white border-transparent" : "bg-white text-indigo-600 border-indigo-300 hover:bg-indigo-50"
          }`}
        >
          {showHarmonics ? "Skrýt harmonické (2X–8X)" : "Zobrazit harmonické 2X–8X"}
        </button>
      </div>
      <p className="text-[9px] text-slate-400">Otáčková frekvence (1X) je zobrazena ve spektru rychlosti vibrací.</p>
    </div>
  );
}

// Pomocník pro generování ReferenceLine překryvů v grafu
function BearingReferenceLines({ freqLines, visibleFreqs }) {
  if (!freqLines) return null;
  return Object.entries(freqLines)
    .filter(([name]) => name !== "rpm" && visibleFreqs[name] !== false)
    .map(([name, hz]) => (
      <ReferenceLine
        key={name}
        x={hz}
        stroke={BEARING_FREQ_COLORS[name]}
        strokeWidth={1.5}
        strokeDasharray="4 2"
        label={{ value: name, position: "insideTopRight", fontSize: 9, fill: BEARING_FREQ_COLORS[name], fontWeight: "bold" }}
      />
    ));
}

export default function SensorDSPPanel({
  sensorId, initialRecordId,
  velStandard, accStandard, tempStandard, temperature,
  machineName, measurementPoint, bearing
}) {
  const { data: records = [], isLoading } = useQuery({
    queryKey: ["sensorDataWithFFT", sensorId],
    queryFn: () => base44.entities.SensorData.filter({ sensor_id: sensorId, has_fft: true }, "-created_date", 50),
    enabled: !!sensorId,
    staleTime: 60000,
  });

  const [manualRecordId, setManualRecordId] = useState(null);
  const prevInitialRef = useRef(initialRecordId);
  useEffect(() => {
    if (initialRecordId && initialRecordId !== prevInitialRef.current) {
      prevInitialRef.current = initialRecordId;
      setManualRecordId(null);
    }
  }, [initialRecordId]);

  const activeRecordId = manualRecordId ?? initialRecordId ?? records[0]?.id;
  const activeRecord = records.find(r => r.id === activeRecordId) ?? null;

  const { data: fftRecords = [] } = useQuery({
    queryKey: ["sensorFFT", activeRecordId],
    queryFn: () => base44.entities.SensorFFTData.filter({ sensor_data_id: activeRecordId }),
    enabled: !!activeRecordId,
    staleTime: 60000,
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

  // Fullscreen dialog
  const [fullscreenChart, setFullscreenChart] = useState(null); // null | 'raw' | 'acc' | 'vel' | 'env'
  const [fsZoom, setFsZoom] = useState({ refAreaLeft: '', refAreaRight: '', left: 'dataMin', right: 'dataMax' });
  const [fsRpm, setFsRpm] = useState(null); // null = auto
  const [fsManualMode, setFsManualMode] = useState(false);
  const [fsRpmInput, setFsRpmInput] = useState('');
  const [fsShowHarmonics, setFsShowHarmonics] = useState(true);
  const [fsVisibleFreqs, setFsVisibleFreqs] = useState({ BPFO: true, BPFI: true, BSF: true, FTF: true });
  // Harmonic cursor
  const [hcMode, setHcMode] = useState(false); // harmonic cursor enabled
  const [hcFreq, setHcFreq] = useState(null);  // pinned base frequency (null = follow mouse)
  const [hcHoverFreq, setHcHoverFreq] = useState(null); // current mouse freq
  const [hcHarmonics, setHcHarmonics] = useState(8); // number of harmonics to show

  const openFullscreen = (chartId) => {
    setFullscreenChart(chartId);
    setFsZoom({ refAreaLeft: '', refAreaRight: '', left: 'dataMin', right: 'dataMax' });
    setFsManualMode(false);
    setFsRpmInput('');
    setFsRpm(bearingRpm);
    setFsShowHarmonics(showHarmonics);
    setFsVisibleFreqs({ ...visibleFreqs });
    setHcMode(false);
    setHcFreq(null);
    setHcHoverFreq(null);
  };

  const handleFsZoom = () => {
    let { refAreaLeft, refAreaRight } = fsZoom;
    if (refAreaLeft === refAreaRight || refAreaRight === '') {
      setFsZoom(prev => ({ ...prev, refAreaLeft: '', refAreaRight: '' }));
      return;
    }
    let left = Number(refAreaLeft), right = Number(refAreaRight);
    if (left > right) [left, right] = [right, left];
    setFsZoom(prev => ({ ...prev, refAreaLeft: '', refAreaRight: '', left, right }));
  };

  // Ložiskové překryvy
  const [bearingRpm, setBearingRpm] = useState(null);
  const [visibleFreqs, setVisibleFreqs] = useState({ BPFO: true, BPFI: true, BSF: true, FTF: true });
  const [showHarmonics, setShowHarmonics] = useState(false);
  const handleToggleFreq = (name) => setVisibleFreqs(prev => ({ ...prev, [name]: !prev[name] }));

  const dsp = useMemo(() => {
    if (!activeFFT) return null;
    try {
      let rawChart = [];
      if (activeRecord?.raw_z_json) {
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
        rmsVelX: activeRecord?.vel_rms_x_mm_s ?? null,
        rmsVelY: activeRecord?.vel_rms_y_mm_s ?? null,
        rmsVelZ: activeRecord?.vel_rms_z_mm_s ?? null,
        rmsAccZ: activeRecord?.rms_z_g ?? null,
        rmsEnvZ: activeRecord?.env_rms_z ?? null,
        rawChart, specAccZ, specVel, specEnvZ,
        freqRes,
      };
    } catch (e) { return null; }
  }, [activeRecord, activeFFT, activeRecordId]);

  // Výpočet ložiskových frekvencí pro grafy
  const bearingFreqLines = useMemo(() => {
    if (!bearing || !dsp) return null;
    const coefs = calcBearingDefectCoefs(bearing.nb, bearing.bd, bearing.pd, bearing.contact_angle_deg || 0);
    const autoRpm = detectRpmFromSpectrum(dsp.specVel, dsp.freqRes);
    const rpm = bearingRpm ?? autoRpm ?? 1500;
    const fr = rpm / 60;
    return {
      BPFO: +(coefs.bpfo * fr).toFixed(2),
      BPFI: +(coefs.bpfi * fr).toFixed(2),
      BSF:  +(coefs.bsf  * fr).toFixed(2),
      FTF:  +(coefs.ftf  * fr).toFixed(2),
    };
  }, [bearing, dsp, bearingRpm]);

  // Otáčková frekvence a harmonické
  const autoRpmFromSpec = useMemo(() => {
    if (!dsp) return null;
    return detectRpmFromSpectrum(dsp.specVel, dsp.freqRes);
  }, [dsp]);
  const effectiveRpm = bearingRpm ?? autoRpmFromSpec ?? null;
  const fr = effectiveRpm ? effectiveRpm / 60 : null;
  const rotRefLines = useMemo(() => {
    if (!fr) return [];
    const lines = [{ n: 1, hz: +fr.toFixed(2) }];
    if (showHarmonics) {
      for (let n = 2; n <= 8; n++) lines.push({ n, hz: +(n * fr).toFixed(2) });
    }
    return lines;
  }, [fr, showHarmonics]);

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
                {(() => { const s = String(r.created_date); const u = /[Zz]$|[+-]\d{2}:\d{2}$/.test(s) ? s : s + "Z"; return new Date(u).toLocaleString("cs-CZ", { timeZone: "Europe/Prague", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" }); })()}
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
          {/* Vyhodnocení dle norem */}
          <LimitEvaluationPanel
            rmsData={{ vel_x: dsp.rmsVelX, vel_y: dsp.rmsVelY, vel_z: dsp.rmsVelZ, acc_z: dsp.rmsAccZ, env_z: dsp.rmsEnvZ }}
            velStandard={velStandard}
            accStandard={accStandard}
            tempStandard={tempStandard}
            temperature={temperature}
          />

          {/* Panel ložiskových překryvů (jen pokud je přiřazeno ložisko) */}
          {bearing && (
            <BearingOverlayPanel
              bearing={bearing}
              specVel={dsp.specVel}
              freqRes={dsp.freqRes}
              rpm={bearingRpm}
              onRpmChange={setBearingRpm}
              visibleFreqs={visibleFreqs}
              onToggleFreq={handleToggleFreq}
              showHarmonics={showHarmonics}
              onToggleHarmonics={() => setShowHarmonics(v => !v)}
            />
          )}
          {!bearing && (
            <RotationalFreqPanel
              specVel={dsp.specVel}
              freqRes={dsp.freqRes}
              rpm={bearingRpm}
              onRpmChange={setBearingRpm}
              showHarmonics={showHarmonics}
              onToggleHarmonics={() => setShowHarmonics(v => !v)}
            />
          )}

          {/* Grafy 2x2 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Časová vlna */}
            <Card>
              <CardHeader className="pb-1 flex flex-row items-center justify-between py-3 px-4">
                <CardTitle className="text-xs font-semibold">Časová vlna Z (Surová data) [g]</CardTitle>
                <div className="flex items-center gap-1">
                  {zoomStates.raw.left !== 'dataMin' && (
                    <Button variant="outline" size="sm" className="h-6 px-2 text-xs" onClick={() => zoomOut('raw')}>
                      <ZoomOut className="w-3 h-3 mr-1" />Zrušit zoom
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => openFullscreen('raw')} title="Zvětšit na celou obrazovku">
                    <Maximize2 className="w-3.5 h-3.5 text-slate-500" />
                  </Button>
                </div>
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
                <div className="flex items-center gap-1">
                  {zoomStates.acc.left !== 'dataMin' && (
                    <Button variant="outline" size="sm" className="h-6 px-2 text-xs" onClick={() => zoomOut('acc')}>
                      <ZoomOut className="w-3 h-3 mr-1" />Zrušit zoom
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => openFullscreen('acc')} title="Zvětšit na celou obrazovku">
                    <Maximize2 className="w-3.5 h-3.5 text-slate-500" />
                  </Button>
                </div>
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
                    <BearingReferenceLines freqLines={bearingFreqLines} visibleFreqs={visibleFreqs} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Spektrum rychlosti */}
            <Card>
              <CardHeader className="pb-1 flex flex-row items-center justify-between py-3 px-4">
                <CardTitle className="text-xs font-semibold">Spektrum Rychlosti X, Y, Z (mm/s) [0-1000 Hz]</CardTitle>
                <div className="flex items-center gap-1">
                  {zoomStates.vel.left !== 'dataMin' && (
                    <Button variant="outline" size="sm" className="h-6 px-2 text-xs" onClick={() => zoomOut('vel')}>
                      <ZoomOut className="w-3 h-3 mr-1" />Zrušit zoom
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => openFullscreen('vel')} title="Zvětšit na celou obrazovku">
                    <Maximize2 className="w-3.5 h-3.5 text-slate-500" />
                  </Button>
                </div>
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
                    <BearingReferenceLines freqLines={bearingFreqLines} visibleFreqs={visibleFreqs} />
                    {rotRefLines.map(({ n, hz }) => (
                      <ReferenceLine key={`rot-${n}`} x={hz} stroke="#6366f1" strokeWidth={n === 1 ? 2 : 1}
                        strokeDasharray={n === 1 ? "none" : "3 2"}
                        label={{ value: `${n}X`, position: "insideTopLeft", fontSize: 9, fill: "#6366f1", fontWeight: "bold" }} />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Spektrum obálky */}
            <Card>
              <CardHeader className="pb-1 flex flex-row items-center justify-between py-3 px-4">
                <CardTitle className="text-xs font-semibold">Spektrum Obálky Z</CardTitle>
                <div className="flex items-center gap-1">
                  {zoomStates.env.left !== 'dataMin' && (
                    <Button variant="outline" size="sm" className="h-6 px-2 text-xs" onClick={() => zoomOut('env')}>
                      <ZoomOut className="w-3 h-3 mr-1" />Zrušit zoom
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => openFullscreen('env')} title="Zvětšit na celou obrazovku">
                    <Maximize2 className="w-3.5 h-3.5 text-slate-500" />
                  </Button>
                </div>
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
                    <BearingReferenceLines freqLines={bearingFreqLines} visibleFreqs={visibleFreqs} />
                    {rotRefLines.map(({ n, hz }) => (
                      <ReferenceLine key={`rot-env-${n}`} x={hz} stroke="#6366f1" strokeWidth={n === 1 ? 2 : 1}
                        strokeDasharray={n === 1 ? "none" : "3 2"}
                        label={{ value: `${n}X`, position: "insideTopLeft", fontSize: 9, fill: "#6366f1", fontWeight: "bold" }} />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Fullscreen dialog */}
          {!!fullscreenChart && dsp && (() => {
            const fsAutoRpm = detectRpmFromSpectrum(dsp.specVel, dsp.freqRes);
            const fsEffectiveRpm = fsRpm ?? fsAutoRpm ?? null;
            const fsFr = fsEffectiveRpm ? fsEffectiveRpm / 60 : null;
            const fsRotLines = fsFr ? [
              { n: 1, hz: +fsFr.toFixed(2) },
              ...(fsShowHarmonics ? Array.from({ length: 7 }, (_, i) => ({ n: i + 2, hz: +((i + 2) * fsFr).toFixed(2) })) : [])
            ] : [];

            // Ložiskové frekvence pro fullscreen
            const fsBearingFreqLines = bearing && fsEffectiveRpm ? (() => {
              const coefs = calcBearingDefectCoefs(bearing.nb, bearing.bd, bearing.pd, bearing.contact_angle_deg || 0);
              const fr2 = fsEffectiveRpm / 60;
              return {
                BPFO: +(coefs.bpfo * fr2).toFixed(2),
                BPFI: +(coefs.bpfi * fr2).toFixed(2),
                BSF:  +(coefs.bsf  * fr2).toFixed(2),
                FTF:  +(coefs.ftf  * fr2).toFixed(2),
              };
            })() : null;

            const isFreqChart = fullscreenChart !== 'raw';
            const xKey = fullscreenChart === 'raw' ? 't' : 'f';
            const xLabel = fullscreenChart === 'raw' ? 'čas (ms)' : 'frekvence (Hz)';

            return (
              <Dialog open={true} onOpenChange={open => !open && setFullscreenChart(null)}>
                <DialogContent className="max-w-[97vw] w-[97vw] max-h-[97vh] h-[97vh] flex flex-col p-0 gap-0">
                  {/* Header */}
                  <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-200 shrink-0 bg-slate-50">
                    <span className="font-semibold text-slate-800 text-sm">
                      {fullscreenChart === 'raw' && '📈 Časová vlna Z (Surová data) [g]'}
                      {fullscreenChart === 'acc' && '📊 Spektrum Zrychlení Z (g Peak)'}
                      {fullscreenChart === 'vel' && '📊 Spektrum Rychlosti X, Y, Z (mm/s)'}
                      {fullscreenChart === 'env' && '📊 Spektrum Obálky Z'}
                    </span>
                    <button onClick={() => setFullscreenChart(null)} className="p-1 rounded hover:bg-slate-200 text-slate-500 hover:text-slate-800">
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Toolbar — jen pro frekvenční spektra */}
                  {isFreqChart && (
                    <div className="shrink-0 px-4 py-2 border-b border-slate-100 bg-white flex flex-wrap items-center gap-3">
                      {/* Otáčková frekvence */}
                      <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-1.5">
                        <span className="text-xs font-bold text-indigo-700 whitespace-nowrap">⟳ Otáčky:</span>
                        {fsAutoRpm && (
                          <span className="text-[10px] text-slate-500 bg-white border border-slate-200 rounded px-1.5 py-0.5 whitespace-nowrap">
                            Auto: <span className="font-mono font-bold text-slate-700">{fsAutoRpm} RPM</span>
                            {fsRpm == null && <span className="text-green-600 ml-1">(aktivní)</span>}
                          </span>
                        )}
                        {!fsManualMode ? (
                          <button
                            className="text-[11px] border border-indigo-300 rounded px-2 py-0.5 bg-white text-indigo-700 hover:bg-indigo-100 font-semibold whitespace-nowrap"
                            onClick={() => { setFsManualMode(true); setFsRpmInput(String(fsEffectiveRpm || '')); }}
                          >
                            {fsRpm != null ? `${fsRpm} RPM ✎` : 'Zadat ručně'}
                          </button>
                        ) : (
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              value={fsRpmInput}
                              onChange={e => setFsRpmInput(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') {
                                  const v = parseFloat(fsRpmInput);
                                  if (v > 0) { setFsRpm(Math.round(v)); setFsManualMode(false); }
                                }
                              }}
                              className="h-6 w-20 px-1.5 text-xs border border-indigo-300 rounded font-mono"
                              placeholder="RPM"
                              autoFocus
                            />
                            <button
                              className="text-[11px] bg-indigo-500 text-white rounded px-2 py-0.5 font-semibold"
                              onClick={() => {
                                const v = parseFloat(fsRpmInput);
                                if (v > 0) { setFsRpm(Math.round(v)); setFsManualMode(false); }
                              }}
                            >OK</button>
                            {fsRpm != null && (
                              <button className="text-[11px] bg-white border border-indigo-300 text-indigo-600 rounded px-2 py-0.5"
                                onClick={() => { setFsRpm(null); setFsManualMode(false); }}>Auto</button>
                            )}
                            <button className="text-[11px] text-slate-400 px-1" onClick={() => setFsManualMode(false)}>✕</button>
                          </div>
                        )}
                        {fsFr && (
                          <span className="text-[11px] font-mono bg-indigo-100 text-indigo-700 rounded px-2 py-0.5">1X = {fsFr.toFixed(2)} Hz</span>
                        )}
                        <button
                          onClick={() => setFsShowHarmonics(v => !v)}
                          className={`text-[11px] font-semibold rounded px-2 py-0.5 border whitespace-nowrap ${fsShowHarmonics ? 'bg-indigo-600 text-white border-transparent' : 'bg-white text-indigo-600 border-indigo-300 hover:bg-indigo-50'}`}
                        >
                          {fsShowHarmonics ? 'Harmonické 2X–8X ✓' : 'Zobrazit harmonické'}
                        </button>
                      </div>

                      {/* Ložiskové frekvence */}
                      {bearing && fsBearingFreqLines && (
                        <div className="flex items-center gap-1.5 bg-orange-50 border border-orange-200 rounded-lg px-3 py-1.5 flex-wrap">
                          <span className="text-xs font-bold text-orange-700 whitespace-nowrap mr-1">⚙ {bearing.designation}:</span>
                          {Object.entries(fsBearingFreqLines).map(([name, hz]) => {
                            const on = fsVisibleFreqs[name] !== false;
                            return (
                              <button key={name}
                                onClick={() => setFsVisibleFreqs(prev => ({ ...prev, [name]: !prev[name] }))}
                                className={`flex items-center gap-1 text-[11px] font-semibold rounded px-2 py-0.5 border transition-all ${on ? 'text-white border-transparent' : 'border-slate-300 bg-white text-slate-500'}`}
                                style={on ? { backgroundColor: BEARING_FREQ_COLORS[name] } : {}}
                              >
                                <span>{name}</span>
                                <span className="font-mono font-normal text-[10px]">{hz} Hz</span>
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {/* Harmonic cursor */}
                      <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-1.5">
                        <button
                          onClick={() => { setHcMode(v => !v); setHcFreq(null); }}
                          className={`text-[11px] font-semibold rounded px-2 py-0.5 border whitespace-nowrap transition-all ${hcMode ? 'bg-emerald-600 text-white border-transparent' : 'bg-white text-emerald-700 border-emerald-300 hover:bg-emerald-50'}`}
                        >
                          🎯 {hcMode ? 'Kurzor harmonických ✓' : 'Kurzor harmonických'}
                        </button>
                        {hcMode && (
                          <>
                            <span className="text-[10px] text-slate-500">Harmonické:</span>
                            <select
                              value={hcHarmonics}
                              onChange={e => setHcHarmonics(Number(e.target.value))}
                              className="h-6 text-xs border border-emerald-300 rounded px-1 bg-white"
                            >
                              {[4,6,8,10,12].map(n => <option key={n} value={n}>{n}X</option>)}
                            </select>
                            {hcFreq != null ? (
                              <>
                                <span className="text-[11px] font-mono bg-emerald-100 text-emerald-800 rounded px-2 py-0.5 font-bold">
                                  Base: {hcFreq.toFixed(2)} Hz
                                </span>
                                <button onClick={() => setHcFreq(null)} className="text-[10px] text-slate-400 hover:text-slate-700 px-1">✕ Uvolnit</button>
                              </>
                            ) : (
                              <span className="text-[10px] text-slate-400 italic">Pohybujte myší · Klik = zamknout</span>
                            )}
                          </>
                        )}
                      </div>

                      {/* Zoom info + reset */}
                      {fsZoom.left !== 'dataMin' && (
                        <Button variant="outline" size="sm" className="h-7 px-2 text-xs gap-1"
                          onClick={() => setFsZoom({ refAreaLeft: '', refAreaRight: '', left: 'dataMin', right: 'dataMax' })}>
                          <ZoomOut className="w-3.5 h-3.5" />Zrušit zoom
                        </Button>
                      )}
                      {fsZoom.left === 'dataMin' && !hcMode && (
                        <span className="text-[10px] text-slate-400 italic">Tažením myší vyberte oblast pro zoom</span>
                      )}
                    </div>
                  )}

                  {/* Harmonic cursor panel — zobrazí tabulku harmonických */}
                  {hcMode && (hcFreq != null || hcHoverFreq != null) && (() => {
                    const baseHz = hcFreq ?? hcHoverFreq;
                    return (
                      <div className="shrink-0 mx-4 mb-2 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[11px] font-bold text-emerald-800 mr-1">
                            🎯 Harmonické od {baseHz.toFixed(2)} Hz {hcFreq != null ? '(zamčeno)' : '(pohyb myši)'}:
                          </span>
                          {Array.from({ length: hcHarmonics }, (_, i) => i + 1).map(n => (
                            <span key={n} className={`text-[11px] font-mono rounded px-1.5 py-0.5 border ${n === 1 ? 'bg-emerald-600 text-white border-transparent font-bold' : 'bg-white text-emerald-700 border-emerald-300'}`}>
                              {n}X = {(n * baseHz).toFixed(2)} Hz
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Graf */}
                  <div className="flex-1 p-4 min-h-0">
                    {/* Compute harmonic cursor lines */}
                    {(() => {
                      const hcBase = hcFreq ?? hcHoverFreq;
                      const hcLines = hcMode && hcBase
                        ? Array.from({ length: hcHarmonics }, (_, i) => ({ n: i + 1, hz: +((i + 1) * hcBase).toFixed(2) }))
                        : [];

                      const hcRefLines = hcLines.map(({ n, hz }) => (
                        <ReferenceLine key={`hc-${n}`} x={hz} stroke="#059669" strokeWidth={n === 1 ? 2 : 1}
                          strokeDasharray={n === 1 ? "none" : "4 2"}
                          label={{ value: `${n}X`, position: n % 2 === 0 ? "insideTopRight" : "insideTopLeft", fontSize: 9, fill: "#059669", fontWeight: "bold" }}
                        />
                      ));

                      const commonMouseHandlers = hcMode ? {
                        onMouseMove: e => {
                          if (e && e.activeLabel != null) setHcHoverFreq(Number(e.activeLabel));
                          if (fsZoom.refAreaLeft && e) setFsZoom(prev => ({ ...prev, refAreaRight: e.activeLabel }));
                        },
                        onMouseDown: e => {
                          if (!e) return;
                          if (hcMode) {
                            // click to pin/unpin
                            if (hcFreq != null) { setHcFreq(null); }
                            else { setHcFreq(Number(e.activeLabel)); }
                          } else {
                            setFsZoom(prev => ({ ...prev, refAreaLeft: e.activeLabel }));
                          }
                        },
                        onMouseUp: hcMode ? undefined : handleFsZoom,
                        onMouseLeave: () => setHcHoverFreq(null),
                      } : {
                        onMouseDown: e => e && setFsZoom(prev => ({ ...prev, refAreaLeft: e.activeLabel })),
                        onMouseMove: e => fsZoom.refAreaLeft && e && setFsZoom(prev => ({ ...prev, refAreaRight: e.activeLabel })),
                        onMouseUp: handleFsZoom,
                      };

                      return (
                    <ResponsiveContainer width="100%" height="100%">
                      {fullscreenChart === 'raw' ? (
                        <LineChart data={dsp.rawChart}
                          onMouseDown={e => e && setFsZoom(prev => ({ ...prev, refAreaLeft: e.activeLabel }))}
                          onMouseMove={e => fsZoom.refAreaLeft && e && setFsZoom(prev => ({ ...prev, refAreaRight: e.activeLabel }))}
                          onMouseUp={handleFsZoom}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="t" domain={[fsZoom.left, fsZoom.right]} type="number" allowDataOverflow label={{ value: 'čas (ms)', position: 'insideBottomRight', offset: -5 }} tick={{ fontSize: 11 }} />
                          <YAxis domain={['auto', 'auto']} allowDataOverflow tick={{ fontSize: 11 }} />
                          <Tooltip />
                          <Line type="monotone" dataKey="z" stroke="#3b82f6" dot={false} isAnimationActive={false} />
                          {fsZoom.refAreaLeft && fsZoom.refAreaRight && <ReferenceArea x1={fsZoom.refAreaLeft} x2={fsZoom.refAreaRight} strokeOpacity={0.3} fill="#6366f1" fillOpacity={0.1} />}
                        </LineChart>
                      ) : fullscreenChart === 'acc' ? (
                        <LineChart data={dsp.specAccZ} {...commonMouseHandlers}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="f" domain={[fsZoom.left, fsZoom.right]} type="number" allowDataOverflow label={{ value: 'frekvence (Hz)', position: 'insideBottomRight', offset: -5 }} tick={{ fontSize: 11 }} />
                          <YAxis domain={['auto', 'auto']} allowDataOverflow tick={{ fontSize: 11 }} />
                          <Tooltip formatter={(v, n) => [v?.toFixed ? v.toFixed(4) : v, n]} labelFormatter={v => `${v} Hz`} />
                          <Line type="monotone" dataKey="amp" stroke="#10b981" dot={false} isAnimationActive={false} name="Zrychlení Z [g]" />
                          {!hcMode && fsZoom.refAreaLeft && fsZoom.refAreaRight && <ReferenceArea x1={fsZoom.refAreaLeft} x2={fsZoom.refAreaRight} strokeOpacity={0.3} fill="#6366f1" fillOpacity={0.1} />}
                          <BearingReferenceLines freqLines={fsBearingFreqLines} visibleFreqs={fsVisibleFreqs} />
                          {fsRotLines.map(({ n, hz }) => (
                            <ReferenceLine key={`fs-rot-acc-${n}`} x={hz} stroke="#6366f1" strokeWidth={n === 1 ? 2 : 1}
                              strokeDasharray={n === 1 ? "none" : "3 2"}
                              label={{ value: `${n}X`, position: "insideTopLeft", fontSize: 10, fill: "#6366f1", fontWeight: "bold" }} />
                          ))}
                          {hcRefLines}
                        </LineChart>
                      ) : fullscreenChart === 'vel' ? (
                        <LineChart data={dsp.specVel} {...commonMouseHandlers}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="f" domain={[fsZoom.left, fsZoom.right]} type="number" allowDataOverflow label={{ value: 'frekvence (Hz)', position: 'insideBottomRight', offset: -5 }} tick={{ fontSize: 11 }} />
                          <YAxis domain={['auto', 'auto']} allowDataOverflow tick={{ fontSize: 11 }} />
                          <Tooltip formatter={(v, n) => [v?.toFixed ? v.toFixed(4) : v, n]} labelFormatter={v => `${v} Hz`} />
                          <Legend iconSize={12} wrapperStyle={{ fontSize: 12 }} />
                          <Line type="monotone" dataKey="x" stroke="#3b82f6" dot={false} isAnimationActive={false} name="Osa X [mm/s]" />
                          <Line type="monotone" dataKey="y" stroke="#10b981" dot={false} isAnimationActive={false} name="Osa Y [mm/s]" />
                          <Line type="monotone" dataKey="z" stroke="#f59e0b" dot={false} isAnimationActive={false} name="Osa Z [mm/s]" />
                          {!hcMode && fsZoom.refAreaLeft && fsZoom.refAreaRight && <ReferenceArea x1={fsZoom.refAreaLeft} x2={fsZoom.refAreaRight} strokeOpacity={0.3} fill="#6366f1" fillOpacity={0.1} />}
                          <BearingReferenceLines freqLines={fsBearingFreqLines} visibleFreqs={fsVisibleFreqs} />
                          {fsRotLines.map(({ n, hz }) => (
                            <ReferenceLine key={`fs-rot-vel-${n}`} x={hz} stroke="#6366f1" strokeWidth={n === 1 ? 2 : 1}
                              strokeDasharray={n === 1 ? "none" : "3 2"}
                              label={{ value: `${n}X`, position: "insideTopLeft", fontSize: 10, fill: "#6366f1", fontWeight: "bold" }} />
                          ))}
                          {hcRefLines}
                        </LineChart>
                      ) : (
                        <LineChart data={dsp.specEnvZ} {...commonMouseHandlers}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="f" domain={[fsZoom.left, fsZoom.right]} type="number" allowDataOverflow label={{ value: 'frekvence (Hz)', position: 'insideBottomRight', offset: -5 }} tick={{ fontSize: 11 }} />
                          <YAxis domain={['auto', 'auto']} allowDataOverflow tick={{ fontSize: 11 }} />
                          <Tooltip formatter={(v, n) => [v?.toFixed ? v.toFixed(4) : v, n]} labelFormatter={v => `${v} Hz`} />
                          <Line type="monotone" dataKey="amp" stroke="#f97316" dot={false} isAnimationActive={false} name="Obálka Z" />
                          {!hcMode && fsZoom.refAreaLeft && fsZoom.refAreaRight && <ReferenceArea x1={fsZoom.refAreaLeft} x2={fsZoom.refAreaRight} strokeOpacity={0.3} fill="#6366f1" fillOpacity={0.1} />}
                          <BearingReferenceLines freqLines={fsBearingFreqLines} visibleFreqs={fsVisibleFreqs} />
                          {fsRotLines.map(({ n, hz }) => (
                            <ReferenceLine key={`fs-rot-env-${n}`} x={hz} stroke="#6366f1" strokeWidth={n === 1 ? 2 : 1}
                              strokeDasharray={n === 1 ? "none" : "3 2"}
                              label={{ value: `${n}X`, position: "insideTopLeft", fontSize: 10, fill: "#6366f1", fontWeight: "bold" }} />
                          ))}
                          {hcRefLines}
                        </LineChart>
                      )}
                    </ResponsiveContainer>
                      );
                    })()}
                  </div>
                </DialogContent>
              </Dialog>
            );
          })()}

          {/* AI Diagnostická analýza */}
          <VibrationAIAnalysis
            sensorDataId={activeRecordId}
            velStandard={velStandard}
            accStandard={accStandard}
            tempStandard={tempStandard}
            machineName={machineName}
            measurementPoint={measurementPoint}
            bearing={bearing}
          />
        </>
      )}
    </div>
  );
}