import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2, AlertTriangle, CheckCircle, Info, XCircle, ChevronDown, ChevronUp, Gauge, Zap, Activity } from "lucide-react";

const STATUS_CONFIG = {
  OK:       { color: "bg-green-100 text-green-800 border-green-300",  icon: CheckCircle,    dot: "bg-green-500" },
  Pozor:    { color: "bg-yellow-100 text-yellow-800 border-yellow-300", icon: AlertTriangle, dot: "bg-yellow-500" },
  Alarm:    { color: "bg-orange-100 text-orange-800 border-orange-300", icon: AlertTriangle, dot: "bg-orange-500" },
  Kritický: { color: "bg-red-100 text-red-800 border-red-300",         icon: XCircle,       dot: "bg-red-600 animate-pulse" },
};

const SEVERITY_CONFIG = {
  info:     { icon: Info,           className: "text-blue-600",   bg: "bg-blue-50 border-blue-200" },
  warning:  { icon: AlertTriangle,  className: "text-yellow-600", bg: "bg-yellow-50 border-yellow-200" },
  alarm:    { icon: AlertTriangle,  className: "text-orange-600", bg: "bg-orange-50 border-orange-200" },
  critical: { icon: XCircle,        className: "text-red-600",    bg: "bg-red-50 border-red-200" },
};

// Panel automatického vyhodnocení RMS hodnot dle limitů normy
export function LimitEvaluationPanel({ rmsData, velStandard, accStandard, tempStandard, temperature }) {
  const getLimitLevel = (value, a, b, c) => {
    if (value == null || a == null) return null;
    if (value < a) return 0;
    if (value < b) return 1;
    if (value < c) return 2;
    return 3;
  };

  const LEVEL_LABELS = ["A — OK", "B — Pozor", "C — Alarm", "D — Kritické"];
  const LEVEL_COLORS = [
    "bg-green-100 text-green-800 border border-green-300",
    "bg-yellow-100 text-yellow-800 border border-yellow-300",
    "bg-orange-100 text-orange-800 border border-orange-300",
    "bg-red-100 text-red-800 border border-red-300",
  ];
  const LEVEL_BAR_COLORS = ["bg-green-500", "bg-yellow-500", "bg-orange-500", "bg-red-600"];

  const renderBar = (value, limits, max) => {
    if (value == null || !limits) return null;
    const pct = Math.min(100, (value / max) * 100);
    const level = getLimitLevel(value, limits[0], limits[1], limits[2]);
    const barColor = level != null ? LEVEL_BAR_COLORS[level] : "bg-slate-400";
    return (
      <div className="w-full bg-slate-200 rounded-full h-1.5 mt-1 relative">
        {/* Limit ticks */}
        {limits.map((lim, i) => {
          const p = Math.min(100, (lim / max) * 100);
          const colors = ["border-yellow-500", "border-orange-500", "border-red-600"];
          return (
            <div key={i} className={`absolute top-0 bottom-0 w-0.5 border-l-2 ${colors[i]} opacity-80`}
              style={{ left: `${p}%` }} title={`Limit ${["A/B", "B/C", "C/D"][i]}: ${lim}`} />
          );
        })}
        <div className={`h-1.5 rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
    );
  };

  const metrics = [
    {
      label: "Vel X", value: rmsData?.vel_x, unit: "mm/s",
      limits: velStandard ? [velStandard.limit_ab, velStandard.limit_bc, velStandard.limit_cd] : null,
      max: velStandard ? (velStandard.limit_cd * 1.5) : 10,
    },
    {
      label: "Vel Y", value: rmsData?.vel_y, unit: "mm/s",
      limits: velStandard ? [velStandard.limit_ab, velStandard.limit_bc, velStandard.limit_cd] : null,
      max: velStandard ? (velStandard.limit_cd * 1.5) : 10,
    },
    {
      label: "Vel Z", value: rmsData?.vel_z, unit: "mm/s",
      limits: velStandard ? [velStandard.limit_ab, velStandard.limit_bc, velStandard.limit_cd] : null,
      max: velStandard ? (velStandard.limit_cd * 1.5) : 10,
    },
    {
      label: "Acc Z", value: rmsData?.acc_z, unit: "g",
      limits: accStandard ? [accStandard.acc_limit_ab, accStandard.acc_limit_bc, accStandard.acc_limit_cd] : null,
      max: accStandard ? (accStandard.acc_limit_cd * 1.5) : 5,
    },
    {
      label: "Obálka Z", value: rmsData?.env_z, unit: "g",
      limits: accStandard ? [accStandard.acc_limit_ab, accStandard.acc_limit_bc, accStandard.acc_limit_cd] : null,
      max: accStandard ? (accStandard.acc_limit_cd * 1.5) : 5,
    },
    {
      label: "Teplota", value: temperature, unit: "°C",
      limits: tempStandard ? [tempStandard.temp_limit_ab, tempStandard.temp_limit_bc, tempStandard.temp_limit_cd] : null,
      max: tempStandard ? (tempStandard.temp_limit_cd * 1.2) : 100,
    },
  ];

  const worstLevel = metrics.reduce((worst, m) => {
    const level = getLimitLevel(m.value, m.limits?.[0], m.limits?.[1], m.limits?.[2]);
    if (level == null) return worst;
    return Math.max(worst, level);
  }, -1);

  const overallStatus = worstLevel < 0 ? null
    : worstLevel === 0 ? "OK" : worstLevel === 1 ? "Pozor" : worstLevel === 2 ? "Alarm" : "Kritický";
  const cfg = overallStatus ? STATUS_CONFIG[overallStatus] : null;

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
          <CheckCircle className="w-3.5 h-3.5" /> Vyhodnocení dle norem
        </p>
        {cfg && (
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.color}`}>
            <div className={`w-2 h-2 rounded-full ${cfg.dot}`} />
            {overallStatus}
          </div>
        )}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {metrics.map((m) => {
          const level = getLimitLevel(m.value, m.limits?.[0], m.limits?.[1], m.limits?.[2]);
          const hasNorm = m.limits != null;
          const hasValue = m.value != null;
          const levelLabel = level != null ? LEVEL_LABELS[level] : null;
          const levelColor = level != null ? LEVEL_COLORS[level] : "bg-slate-50 text-slate-400 border border-slate-200";

          return (
            <div key={m.label} className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold text-slate-500 uppercase">{m.label}</span>
                <span className="text-[9px] text-slate-400">[{m.unit}]</span>
              </div>
              <div className={`text-sm font-mono font-bold text-center py-1 px-2 rounded ${hasValue ? (levelColor || "bg-slate-50 text-slate-700") : "text-slate-300"}`}>
                {hasValue ? m.value.toFixed(2) : "—"}
              </div>
              {hasValue && hasNorm && renderBar(m.value, m.limits, m.max)}
              {hasValue && levelLabel && (
                <div className={`text-[9px] text-center font-semibold px-1 py-0.5 rounded ${LEVEL_COLORS[level]}`}>
                  {levelLabel}
                </div>
              )}
              {!hasNorm && (
                <div className="text-[9px] text-slate-400 text-center italic">bez normy</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Panel detekovaných provozních parametrů
function OperatingSpeedBox({ operatingSpeed }) {
  if (!operatingSpeed) return null;
  return (
    <div className="flex items-center gap-3 bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2">
      <Gauge className="w-4 h-4 text-indigo-600 flex-shrink-0" />
      <div>
        <p className="text-[10px] font-semibold text-indigo-400 uppercase tracking-wide">Detekované provozní otáčky (1X)</p>
        <p className="text-sm font-bold text-indigo-800">
          {operatingSpeed.freq} Hz = <span className="text-indigo-600">{operatingSpeed.rpm} RPM</span>
          <span className="text-xs font-normal text-indigo-400 ml-2">amplituda: {operatingSpeed.amp} mm/s</span>
        </p>
        <p className="text-[10px] text-indigo-400 mt-0.5">
          Harmonické: 2X = {(operatingSpeed.freq * 2).toFixed(1)} Hz · 3X = {(operatingSpeed.freq * 3).toFixed(1)} Hz · 4X = {(operatingSpeed.freq * 4).toFixed(1)} Hz
        </p>
      </div>
    </div>
  );
}

// Panel třídoménových výsledků
const DOMAIN_CONFIG = {
  velocity:     { label: "Spektrum rychlosti", sub: "Rotor / mechanická integrita", icon: Activity, color: "blue" },
  acceleration: { label: "Spektrum zrychlení", sub: "Ložiska / mazání (2–5 kHz)",   icon: Zap,      color: "green" },
  envelope:     { label: "Obálka zrychlení",   sub: "Ložiskové defekty / dráhy",    icon: Gauge,    color: "orange" },
};

const DOMAIN_STATUS_COLORS = {
  OK:                { bg: "bg-green-50",  border: "border-green-200",  text: "text-green-800",  dot: "bg-green-500" },
  Pozor:             { bg: "bg-yellow-50", border: "border-yellow-200", text: "text-yellow-800", dot: "bg-yellow-500" },
  Alarm:             { bg: "bg-orange-50", border: "border-orange-200", text: "text-orange-800", dot: "bg-orange-500" },
  Kritický:          { bg: "bg-red-50",    border: "border-red-200",    text: "text-red-800",    dot: "bg-red-600 animate-pulse" },
  "Nedostatečná data": { bg: "bg-slate-50", border: "border-slate-200", text: "text-slate-500",  dot: "bg-slate-300" },
};

function DomainPanel({ domainKey, data }) {
  const cfg = DOMAIN_CONFIG[domainKey];
  if (!cfg || !data) return null;
  const Icon = cfg.icon;
  const statusCfg = DOMAIN_STATUS_COLORS[data.status] || DOMAIN_STATUS_COLORS["Nedostatečná data"];

  return (
    <div className={`rounded-lg border p-3 ${statusCfg.bg} ${statusCfg.border}`}>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          <Icon className={`w-3.5 h-3.5 text-${cfg.color}-600`} />
          <span className="text-xs font-semibold text-slate-700">{cfg.label}</span>
        </div>
        <div className="flex items-center gap-1">
          <div className={`w-2 h-2 rounded-full ${statusCfg.dot}`} />
          <span className={`text-[10px] font-semibold ${statusCfg.text}`}>{data.status}</span>
        </div>
      </div>
      <p className="text-[10px] text-slate-400 mb-1">{cfg.sub}</p>
      {data.finding && <p className="text-xs text-slate-600 leading-relaxed">{data.finding}</p>}
    </div>
  );
}

// Hlavní AI analýza panel
export default function VibrationAIAnalysis({ sensorDataId, velStandard, accStandard, tempStandard, machineName, measurementPoint }) {
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(true);

  const runAnalysis = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await base44.functions.invoke("analyzeVibrationAI", {
        sensorDataId,
        velStandard,
        accStandard,
        tempStandard,
        machineName,
        measurementPoint,
      });
      setAnalysis(res.data);
      setExpanded(true);
      console.log("[AI] operatingSpeed:", res.data?.operatingSpeed);
    } catch (e) {
      setError(e.message || "Chyba při analýze");
    } finally {
      setLoading(false);
    }
  };

  const statusCfg = analysis?.analysis?.overall_status ? STATUS_CONFIG[analysis.analysis.overall_status] : null;
  const StatusIcon = statusCfg?.icon;

  return (
    <Card className="border-l-4 border-l-purple-500 shadow-md">
      <CardHeader className="py-3 px-4 bg-gradient-to-r from-purple-50 to-slate-50 border-b border-slate-100">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-600" />
            AI Diagnostická analýza
            {analysis?.analysis?.overall_status && statusCfg && (
              <span className={`flex items-center gap-1 ml-2 px-2 py-0.5 rounded-full text-xs font-semibold border ${statusCfg.color}`}>
                <div className={`w-2 h-2 rounded-full ${statusCfg.dot}`} />
                {analysis.analysis.overall_status}
              </span>
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            {analysis && (
              <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => setExpanded(!expanded)}>
                {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </Button>
            )}
            <Button
              size="sm"
              onClick={runAnalysis}
              disabled={loading || !sensorDataId}
              className="bg-purple-600 hover:bg-purple-700 text-white h-8 px-3 gap-1.5"
            >
              {loading ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Analyzuji...</>
              ) : (
                <><Sparkles className="w-3.5 h-3.5" /> {analysis ? "Znovu analyzovat" : "Analyzovat AI"}</>
              )}
            </Button>
          </div>
        </div>
        {!analysis && !loading && (
          <p className="text-xs text-slate-400 mt-1">
            AI provede odbornou analýzu FFT spekter, identifikuje dominantní frekvence a možné příčiny závad.
            <span className="text-purple-500 ml-1">Využívá pokročilý AI model (Claude Sonnet).</span>
          </p>
        )}
      </CardHeader>

      {error && (
        <CardContent className="p-4">
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-3">
            Chyba: {error}
          </div>
        </CardContent>
      )}

      {analysis && expanded && (
        <CardContent className="p-4 space-y-4">

          {/* Detekované provozní otáčky */}
          <OperatingSpeedBox operatingSpeed={analysis.operatingSpeed} />

          {/* Celkové shrnutí */}
          <div className={`p-3 rounded-lg border ${statusCfg?.color || "bg-slate-50 border-slate-200"}`}>
            <div className="flex items-start gap-2">
              {StatusIcon && <StatusIcon className="w-4 h-4 mt-0.5 flex-shrink-0" />}
              <p className="text-sm font-medium">{analysis.analysis.overall_summary}</p>
            </div>
          </div>

          {/* Třídoménová analýza */}
          {(analysis.analysis.domain_velocity || analysis.analysis.domain_acceleration || analysis.analysis.domain_envelope) && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Analýza po doménách</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <DomainPanel domainKey="velocity"     data={analysis.analysis.domain_velocity} />
                <DomainPanel domainKey="acceleration" data={analysis.analysis.domain_acceleration} />
                <DomainPanel domainKey="envelope"     data={analysis.analysis.domain_envelope} />
              </div>
            </div>
          )}

          {/* Zjištění */}
          {analysis.analysis.findings?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Zjištění</p>
              <div className="space-y-2">
                {analysis.analysis.findings.map((f, i) => {
                  const sevCfg = SEVERITY_CONFIG[f.severity] || SEVERITY_CONFIG.info;
                  const SevIcon = sevCfg.icon;
                  return (
                    <div key={i} className={`flex items-start gap-2.5 p-3 rounded-lg border ${sevCfg.bg}`}>
                      <SevIcon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${sevCfg.className}`} />
                      <div>
                        <p className={`text-xs font-semibold ${sevCfg.className}`}>{f.title}</p>
                        <p className="text-xs text-slate-600 mt-0.5">{f.detail}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Analýza frekvencí */}
          {analysis.analysis.frequency_analysis && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Analýza dominantních frekvencí</p>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-slate-700 leading-relaxed whitespace-pre-line">
                {analysis.analysis.frequency_analysis}
              </div>
            </div>
          )}

          {/* Doporučení */}
          {analysis.analysis.recommendations?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Doporučená opatření</p>
              <ul className="space-y-1.5">
                {analysis.analysis.recommendations.map((r, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-slate-700">
                    <span className="mt-0.5 w-4 h-4 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-[9px] flex-shrink-0">{i + 1}</span>
                    {r}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Doporučení příštího měření */}
          {analysis.analysis.next_inspection_recommendation && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 flex items-start gap-2">
              <Info className="w-4 h-4 text-slate-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-[10px] font-semibold text-slate-400 uppercase mb-0.5">Příští měření</p>
                <p className="text-xs text-slate-600">{analysis.analysis.next_inspection_recommendation}</p>
              </div>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}