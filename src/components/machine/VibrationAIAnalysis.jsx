import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Sparkles, Loader2, AlertTriangle, CheckCircle, XCircle,
  ChevronDown, ChevronUp, Activity, Zap, Gauge, Info
} from "lucide-react";
export { LimitEvaluationPanel } from "@/components/machine/LimitEvaluationPanel";

const STATUS_CONFIG = {
  OK:       { color: "bg-green-50 border-green-300 text-green-800",   icon: CheckCircle,   dot: "bg-green-500",  label: "V pořádku" },
  Pozor:    { color: "bg-yellow-50 border-yellow-300 text-yellow-800", icon: AlertTriangle, dot: "bg-yellow-500", label: "Pozor" },
  Alarm:    { color: "bg-orange-50 border-orange-300 text-orange-800", icon: AlertTriangle, dot: "bg-orange-500", label: "Alarm" },
  Kritický: { color: "bg-red-50 border-red-300 text-red-800",          icon: XCircle,       dot: "bg-red-600 animate-pulse", label: "Kritický stav" },
};

const DOMAIN_LABELS = {
  velocity:     { label: "Rotor / mechanika",    icon: Activity },
  acceleration: { label: "Ložiska (vysoké Hz)", icon: Zap },
  envelope:     { label: "Defekty ložisek",      icon: Gauge },
};

const SEVERITY_COLORS = {
  info:     "bg-blue-50 border-blue-200 text-blue-700",
  warning:  "bg-yellow-50 border-yellow-200 text-yellow-700",
  alarm:    "bg-orange-50 border-orange-200 text-orange-700",
  critical: "bg-red-50 border-red-200 text-red-700",
};

const DOMAIN_STATUS_DOT = {
  OK: "bg-green-500", Pozor: "bg-yellow-500", Alarm: "bg-orange-500",
  Kritický: "bg-red-600 animate-pulse", "Nedostatečná data": "bg-slate-300",
};

export default function VibrationAIAnalysis({ sensorDataId, velStandard, accStandard, tempStandard, machineName, measurementPoint }) {
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showDetail, setShowDetail] = useState(false);

  const runAnalysis = async () => {
    setLoading(true);
    setError(null);
    setShowDetail(false);
    try {
      const res = await base44.functions.invoke("analyzeVibrationAI", {
        sensorDataId, velStandard, accStandard, tempStandard, machineName, measurementPoint,
      });
      setAnalysis(res.data);
    } catch (e) {
      setError(e.message || "Chyba při analýze");
    } finally {
      setLoading(false);
    }
  };

  // Normalizace odpovědi (InvokeLLM může vrátit { response: {...} })
  const aiResult = analysis?.analysis?.response ?? analysis?.analysis ?? null;
  const statusCfg = aiResult?.overall_status ? STATUS_CONFIG[aiResult.overall_status] : null;
  const StatusIcon = statusCfg?.icon;

  return (
    <Card className="border-l-4 border-l-purple-500 shadow-md">
      <CardHeader className="py-3 px-4 bg-gradient-to-r from-purple-50 to-slate-50 border-b border-slate-100">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-600" />
            AI Diagnostická analýza
          </CardTitle>
          <Button
            size="sm"
            onClick={runAnalysis}
            disabled={loading || !sensorDataId}
            className="bg-purple-600 hover:bg-purple-700 text-white h-8 px-3 gap-1.5"
          >
            {loading ? (
              <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Analyzuji...</>
            ) : (
              <><Sparkles className="w-3.5 h-3.5" /> {analysis ? "Znovu" : "Analyzovat AI"}</>
            )}
          </Button>
        </div>
        {!analysis && !loading && (
          <p className="text-xs text-slate-400 mt-1">
            AI vyhodnotí stav stroje a doporučí opatření. Využívá pokročilý AI model.
          </p>
        )}
      </CardHeader>

      {error && (
        <CardContent className="p-4">
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-3">Chyba: {error}</div>
        </CardContent>
      )}

      {aiResult && (
        <CardContent className="p-4 space-y-3">

          {/* === HLAVNÍ STATUS + JEDNODUCHÝ ZÁVĚR === */}
          {statusCfg && (
            <div className={`flex items-start gap-3 p-3 rounded-lg border ${statusCfg.color}`}>
              <div className="flex items-center gap-2 flex-shrink-0 mt-0.5">
                <div className={`w-3 h-3 rounded-full ${statusCfg.dot}`} />
                <StatusIcon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-bold mb-0.5">{statusCfg.label}</p>
                <p className="text-sm leading-snug">{aiResult.simple_summary}</p>
              </div>
            </div>
          )}

          {/* === DOPORUČENÍ PRO TECHNIKA === */}
          {aiResult.simple_recommendations?.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Co dělat</p>
              {aiResult.simple_recommendations.map((r, i) => (
                <div key={i} className="flex items-start gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                  <span className="mt-0.5 w-4 h-4 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-[9px] flex-shrink-0">{i + 1}</span>
                  <p className="text-sm text-slate-700">{r}</p>
                </div>
              ))}
            </div>
          )}

          {/* === PŘÍŠTÍ MĚŘENÍ === */}
          {aiResult.next_inspection_recommendation && (
            <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">
              <Info className="w-3.5 h-3.5 flex-shrink-0 text-slate-400" />
              <span><strong>Příští měření:</strong> {aiResult.next_inspection_recommendation}</span>
            </div>
          )}

          {/* === TLAČÍTKO DETAILŮ === */}
          {(aiResult.domain_velocity || aiResult.domain_acceleration || aiResult.domain_envelope || aiResult.detailed_findings?.length > 0) && (
            <button
              className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-medium text-purple-600 hover:text-purple-800 hover:bg-purple-50 rounded-lg transition-colors border border-purple-100"
              onClick={() => setShowDetail(!showDetail)}
            >
              {showDetail ? <><ChevronUp className="w-3.5 h-3.5" /> Skrýt odborný detail</> : <><ChevronDown className="w-3.5 h-3.5" /> Zobrazit odborný detail</>}
            </button>
          )}

          {/* === ODBORNÝ DETAIL === */}
          {showDetail && (
            <div className="space-y-3 pt-1 border-t border-slate-100">

              {/* Třídoménová analýza */}
              {(aiResult.domain_velocity || aiResult.domain_acceleration || aiResult.domain_envelope) && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Analýza po doménách</p>
                  {["velocity", "acceleration", "envelope"].map(key => {
                    const data = aiResult[`domain_${key}`];
                    if (!data) return null;
                    const dcfg = DOMAIN_LABELS[key];
                    const Icon = dcfg.icon;
                    const dotColor = DOMAIN_STATUS_DOT[data.status] || "bg-slate-300";
                    return (
                      <div key={key} className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <Icon className="w-3.5 h-3.5 text-slate-500" />
                          <span className="text-xs font-semibold text-slate-600">{dcfg.label}</span>
                          <div className={`w-2 h-2 rounded-full ml-auto ${dotColor}`} />
                          <span className="text-[10px] text-slate-500">{data.status}</span>
                        </div>
                        <p className="text-xs text-slate-600 leading-relaxed">{data.finding}</p>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Odborná zjištění */}
              {aiResult.detailed_findings?.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Odborná zjištění</p>
                  {aiResult.detailed_findings.map((f, i) => (
                    <div key={i} className={`flex items-start gap-2.5 p-2.5 rounded-lg border text-xs ${SEVERITY_COLORS[f.severity] || SEVERITY_COLORS.info}`}>
                      <div>
                        <p className="font-semibold">{f.title}</p>
                        <p className="mt-0.5 opacity-90">{f.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </CardContent>
      )}
    </Card>
  );
}