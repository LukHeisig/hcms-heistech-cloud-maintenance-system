import React from "react";
import { Textarea } from "@/components/ui/textarea";
import ReportPointsTable from "./ReportPointsTable";
import ReportTrendChart from "./ReportTrendChart";
import { BAND_LABEL } from "@/lib/vibrationReport";

const STATUS_CLS = { A: "bg-green-600", B: "bg-green-600", C: "bg-yellow-500", D: "bg-red-600" };
const fmt = (d) => d.split("-").reverse().join(".");
const H = ({ children }) => <h3 className="font-bold text-sm border-b-2 border-slate-800 pb-1 mt-5 mb-2">{children}</h3>;

// Náhled zprávy (tiskne se jako PDF); závěr a doporučení jsou editovatelné
export default function ReportPreview({ machine, meta, data, onChange, readOnly }) {
  const stds = [...new Map(data.points.filter((p) => p.standardName).map((p) => [p.standardName, p.limits])).entries()];
  const edit = (field) => readOnly
    ? <p className="text-sm whitespace-pre-wrap">{data[field]}</p>
    : <>
        <Textarea className="print:hidden text-sm" rows={4} value={data[field]} onChange={(e) => onChange({ ...data, [field]: e.target.value })} />
        <p className="hidden print:block text-sm whitespace-pre-wrap">{data[field]}</p>
      </>;
  return (
    <div id="vib-report" className="bg-white text-slate-900 p-6 text-sm">
      <div className="flex justify-between items-start border-b-2 border-slate-800 pb-2">
        <img src="https://media.base44.com/images/public/68f9f91f76faef5f76f2ef4a/38f0a76ec_logo.png" alt="Heistech" className="h-10" />
        <span className="font-bold text-slate-500 text-xs">PROTOKOL Z MĚŘENÍ VIBRACÍ</span>
      </div>
      <div className="flex justify-between items-start mt-4">
        <div>
          <h2 className="text-xl font-bold">Zpráva z měření vibrací – {machine?.name}</h2>
          {machine?.inventory_number && <p className="text-xs text-slate-500">Inv. č. {machine.inventory_number}</p>}
        </div>
        {data.overall && <span className={`px-3 py-1 text-white font-bold rounded ${STATUS_CLS[data.overall]}`}>{BAND_LABEL[data.overall]}</span>}
      </div>
      <div className="grid grid-cols-4 gap-2 text-xs mt-3 bg-slate-100 p-2">
        <div><p className="text-slate-500">OBDOBÍ</p><b>{fmt(meta.from)} – {fmt(meta.to)}</b></div>
        <div><p className="text-slate-500">NORMA</p><b>{stds.map(([n]) => n).join(", ") || "—"}</b></div>
        <div><p className="text-slate-500">ZPRACOVAL</p><b>{meta.author}</b></div>
        <div><p className="text-slate-500">VYHOTOVENO</p><b>{fmt(meta.created)}</b></div>
      </div>

      <H>01 CELKOVÉ HODNOTY [mm/s, g]</H>
      <ReportPointsTable points={data.points} />

      <H>02 ZÁVĚR</H>{edit("conclusion")}
      <H>03 DOPORUČENÍ</H>{edit("recommendation")}

      <H>04 TRENDY</H>
      <div className="grid grid-cols-2 gap-3">{data.points.filter((p) => p.chart.length).map((p) => <ReportTrendChart key={p.sensorId} point={p} />)}</div>

      {data.points.some((p) => p.fft) && <>
        <H>05 HODNOCENÍ FFT SPEKTER</H>
        {data.points.filter((p) => p.fft).map((p) => (
          <div key={p.sensorId} className="mb-2"><b>{p.label}:</b> {p.fft.summary} {p.fft.recommendations && <i>Doporučení: {p.fft.recommendations}</i>}</div>
        ))}
      </>}

      <H>ALARMY V OBDOBÍ</H>
      {data.alerts.length === 0 ? <p className="text-xs text-slate-500">Bez alarmů.</p> : (
        <ul className="text-xs space-y-0.5">{data.alerts.slice(0, 30).map((a, i) => (
          <li key={i}>{new Date(a.date).toLocaleDateString("cs-CZ")} – {a.point} – {a.label}: {a.value?.toFixed?.(2)} {a.unit} ({a.severity})</li>
        ))}</ul>
      )}

      <H>PŘÍLOHA – POUŽITÉ NORMY A PÁSMA</H>
      {stds.map(([name, l]) => <p key={name} className="text-xs">{name}: A/B {l.ab ?? "–"} · B/C {l.bc ?? "–"} · C/D {l.cd ?? "–"} mm/s</p>)}
      <ul className="text-xs mt-1 space-y-0.5">
        <li><b>A</b> – stroj v bezvadném stavu.</li>
        <li><b>B</b> – vhodný pro dlouhodobý nepřetržitý provoz.</li>
        <li><b>C</b> – provoz po omezenou dobu, naplánujte nápravné opatření.</li>
        <li><b>D</b> – nebezpečné vibrace, nutný okamžitý zásah.</li>
      </ul>
      <div className="border-t mt-6 pt-2 text-xs text-slate-500 flex justify-between"><span>Heistech, s.r.o. · Dobrkovice 111, 763 07</span><span>www.heistech.cz</span></div>
    </div>
  );
}