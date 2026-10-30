import { base44 } from "@/api/base44Client";
import { moduleData } from "@/lib/moduleData";
import { axisDirection } from "@/lib/sensorOrientation";

const BANDS = ["A", "B", "C", "D"];
export const BAND_LABEL = { A: "OK", B: "OK", C: "UPOZORNĚNÍ", D: "VÝSTRAHA" };

export function band(v, ab, bc, cd) {
  if (v == null || bc == null) return null;
  const abL = ab ?? bc / 2;
  if (v < abL) return "A";
  if (v < bc) return "B";
  if (cd == null || v < cd) return "C";
  return "D";
}
export const worstBand = (list) => list.filter(Boolean).sort((a, b) => BANDS.indexOf(b) - BANDS.indexOf(a))[0] || null;

const max = (arr) => (arr.length ? Math.max(...arr) : null);
const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);

function trendOf(values) {
  if (values.length < 4) return "stable";
  const h = Math.floor(values.length / 2);
  const a = avg(values.slice(0, h)), b = avg(values.slice(h));
  if (b > a * 1.2) return "up";
  if (b < a * 0.8) return "down";
  return "stable";
}

// points: [{ label, sensorId, velStd, accStd, bearing, orientation }]
export async function buildReport({ machine, points, from, to }) {
  const fromSec = new Date(from + "T00:00:00Z").getTime() / 1000;
  const toSec = new Date(to + "T23:59:59Z").getTime() / 1000;
  const out = [];
  for (const p of points) {
    const res = await base44.functions.invoke("getSensorTrend", { sensor_id: p.sensorId, from_date: from, limit: 5000 });
    const rows = (res.data.data || []).filter((r) => r.ts_unix >= fromSec && r.ts_unix <= toSec);
    const vmax = (r) => Math.max(r.vel_rms_x_mm_s || 0, r.vel_rms_y_mm_s || 0, r.vel_rms_z_mm_s || 0);
    let velMax = null, axis = null, worstRow = null;
    for (const r of rows) {
      for (const k of ["x", "y", "z"]) {
        const v = r[`vel_rms_${k}_mm_s`];
        if (v != null && (velMax == null || v > velMax)) { velMax = v; axis = k; worstRow = r; }
      }
    }
    const daily = {};
    for (const r of rows) {
      const d = new Date(r.ts_unix * 1000).toISOString().slice(0, 10);
      daily[d] = Math.max(daily[d] || 0, vmax(r));
    }
    const s = p.velStd || {};
    const a = p.accStd || {};
    const accMax = max(rows.map((r) => r.oa_acc_z).filter((v) => v != null));
    const envMax = max(rows.map((r) => r.env_rms_z).filter((v) => v != null));
    const dir = axis ? axisDirection(`vel_${axis}`, p.orientation) : null;
    out.push({
      label: p.label, sensorId: p.sensorId, count: rows.length,
      velMax, velAvg: avg(rows.map(vmax)), axis: dir ? dir[0].toUpperCase() : axis?.toUpperCase(),
      velBand: band(velMax, s.limit_ab, s.limit_bc, s.limit_cd),
      accMax, envMax,
      bearingBand: band(accMax, a.acc_limit_ab, a.acc_limit_bc, a.acc_limit_cd),
      trend: trendOf(rows.map(vmax)),
      limits: { ab: s.limit_ab, bc: s.limit_bc, cd: s.limit_cd },
      standardName: s.name || null,
      chart: Object.entries(daily).sort().map(([d, v]) => ({ d: d.slice(5).split("-").reverse().join("."), v: Math.round(v * 100) / 100 })),
      worstSensorDataId: worstRow?.sensor_data_id, velStd: p.velStd, accStd: p.accStd, bearing: p.bearing,
    });
  }

  // FFT hodnocení jen u míst s překročením (C/D)
  for (const pt of out) {
    if (!["C", "D"].includes(pt.velBand) || !pt.worstSensorDataId) continue;
    try {
      const r = await base44.functions.invoke("analyzeVibrationAI", {
        sensorDataId: pt.worstSensorDataId, velStandard: pt.velStd, accStandard: pt.accStd,
        machineName: machine?.name, measurementPoint: pt.label, bearing: pt.bearing,
      });
      const an = r.data?.analysis || {};
      const rec = an.simple_recommendations;
      pt.fft = { summary: an.simple_summary || "", recommendations: Array.isArray(rec) ? rec.map((x) => x?.text || x?.action || x).join(" ") : (rec || "") };
    } catch (e) {
      pt.fft = { summary: "FFT spektrum pro nejhorší měření není dostupné.", recommendations: "" };
    }
  }

  const alerts = (await moduleData.filter("VibrationAlert", { machine_id: machine.id }, "-created_date", 500))
    .filter((al) => { const t = new Date(al.created_date).getTime() / 1000; return t >= fromSec && t <= toSec; })
    .map((al) => ({ date: al.created_date, point: al.measurement_point, label: al.metric_label || al.alert_type, value: al.value, unit: al.metric_unit, severity: al.severity }));

  const overall = worstBand(out.map((p) => p.velBand));
  return { points: out, alerts, overall, ...draftTexts(out, overall) };
}

function draftTexts(points, overall) {
  const fftNotes = points.filter((p) => p.fft?.summary).map((p) => `${p.label}: ${p.fft.summary}`).join(" ");
  const rising = points.filter((p) => p.trend === "up").map((p) => p.label);
  const bear = worstBand(points.map((p) => p.bearingBand));
  let conclusion = overall
    ? `Celkové hodnoty rychlosti vibrací RMS řadí chod stroje ve sledovaném období do pásma vibrací ${overall}.`
    : "Pro sledované období nejsou k dispozici data pro hodnocení dle normy.";
  if (rising.length) conclusion += ` Trend hodnot vykazuje nárůst na místech ${rising.join(", ")}.`;
  else if (overall) conclusion += " Trend hodnot je ve sledovaném období ustálený.";
  if (bear) conclusion += ["C", "D"].includes(bear) ? " Hodnoty zrychlení poukazují na zvýšené rázové projevy ložisek." : " Hodnoty zrychlení (stav ložisek) jsou v provozním pásmu.";
  if (fftNotes) conclusion += ` Vyhodnocení FFT spekter: ${fftNotes}`;
  const fftRec = points.map((p) => p.fft?.recommendations).filter(Boolean).join(" ");
  const recommendation = overall === "D" ? `Nutný okamžitý zásah. ${fftRec}`.trim()
    : overall === "C" ? `Naplánovat nápravné opatření. ${fftRec}`.trim()
    : "Nadále sledovat vývoj trendu hodnot.";
  return { conclusion, recommendation };
}