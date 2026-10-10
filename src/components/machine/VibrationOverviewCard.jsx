import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { moduleData } from "@/lib/moduleData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, Loader2 } from "lucide-react";

const STYLES = [
  { dot: "bg-green-500", bg: "bg-green-50", border: "border-green-300", text: "text-green-800" },
  { dot: "bg-green-600", bg: "bg-green-50", border: "border-green-300", text: "text-green-900" },
  { dot: "bg-yellow-500", bg: "bg-yellow-50", border: "border-yellow-300", text: "text-yellow-800" },
  { dot: "bg-red-600", bg: "bg-red-50", border: "border-red-300", text: "text-red-800" },
];
const NO_DATA = { dot: "bg-slate-300", bg: "bg-slate-50", border: "border-slate-200", text: "text-slate-500" };
const VEL_LABELS = ["Vibrace — A OK", "Vibrace — B OK", "Vibrace — C Upozornění", "Vibrace — D Výstraha"];
const VEL_DETAILS = [
  "Rychlost vibrací je v pásmu A. Stroj pracuje bez omezení.",
  "Rychlost vibrací je v pásmu B. Zvýšená kontrola doporučena.",
  "Výrazné vibrace (pásmo C). Plánujte údržbu co nejdříve.",
  "Nebezpečné vibrace (pásmo D). Zvažte okamžité odstavení.",
];
const BEAR_LABELS = ["Ložiska — A OK", "Ložiska — B OK", "Ložiska — C Upozornění", "Ložiska — D Výstraha"];
const BEAR_DETAILS = [
  "Zrychlení a obálka jsou v pásmu A. Žádné poškození ložisek.",
  "Zrychlení/obálka je v pásmu B. Sledujte trend ložisek.",
  "Zvýšené rázové vibrace (pásmo C). Blíží se porucha ložiska.",
  "Kritické rázové vibrace (pásmo D). Ložisko pravděpodobně poškozeno.",
];

const lvl = (v, a, b, c) => (v == null || a == null ? -1 : v < a ? 0 : v < b ? 1 : v < c ? 2 : 3);

export default function VibrationOverviewCard({ machine }) {
  const { data: schema } = useQuery({
    queryKey: ["vibrationSchema", machine.vibration_schema_id],
    queryFn: () => base44.entities.VibrationSchema.filter({ id: machine.vibration_schema_id }).then(r => r[0] || null),
    enabled: !!machine.vibration_schema_id,
  });
  const { data: assignments = [], isLoading } = useQuery({
    queryKey: ["vibOverviewAssignments", machine.id],
    queryFn: () => moduleData.filter("VibrationSensorAssignment", { machine_id: machine.id }, null, 200),
  });
  const { data: standards = [] } = useQuery({
    queryKey: ["vibrationStandards"],
    queryFn: () => base44.entities.VibrationStandard.list(null, 500),
    staleTime: 300000,
  });
  const sensorIds = [...new Set(assignments.map(a => a.sensor_id).filter(Boolean))];
  const { data: latest = {} } = useQuery({
    queryKey: ["vibOverviewData", sensorIds.join(",")],
    queryFn: () => moduleData.latestSensorData(sensorIds),
    enabled: sensorIds.length > 0,
    refetchInterval: 60000,
  });

  const rows = useMemo(() => {
    let defs = [];
    try { defs = JSON.parse(schema?.rows_definition || "[]"); } catch { defs = []; }
    const std = Object.fromEntries(standards.map(s => [s.id, s]));
    return assignments.filter(a => a.sensor_id).sort((a, b) => a.schema_row_index - b.schema_row_index).map(a => {
      const d = latest[a.sensor_id];
      const v = std[a.vel_standard_id], ac = std[a.acc_standard_id];
      const vel = d ? Math.max(d.vel_rms_x_mm_s ?? 0, d.vel_rms_y_mm_s ?? 0, d.vel_rms_z_mm_s ?? 0) : null;
      let level = d ? Math.max(
        lvl(vel, v?.limit_ab, v?.limit_bc, v?.limit_cd),
        lvl(d.oa_acc_z, ac?.acc_limit_ab, ac?.acc_limit_bc, ac?.acc_limit_cd),
        lvl(d.env_rms_z, ac?.acc_limit_ab, ac?.acc_limit_bc, ac?.acc_limit_cd)
      ) : -1;
      const velL = d ? lvl(vel, v?.limit_ab, v?.limit_bc, v?.limit_cd) : -1;
      const acc = d?.rms_z_g ?? d?.oa_acc_z;
      const bearL = d ? Math.max(lvl(acc, ac?.acc_limit_ab, ac?.acc_limit_bc, ac?.acc_limit_cd), lvl(d.env_rms_z, ac?.acc_limit_ab, ac?.acc_limit_bc, ac?.acc_limit_cd)) : -1;
      return { id: a.id, velL, bearL, level };
    });
  }, [assignments, latest, standards, schema]);

  const velLevel = Math.max(-1, ...rows.map(r => r.velL));
  const bearLevel = Math.max(-1, ...rows.map(r => r.bearL));
  const statusRows = [
    velLevel >= 0 ? { label: VEL_LABELS[velLevel], detail: VEL_DETAILS[velLevel], ...STYLES[velLevel] } : { label: "Stav vibrací neznámý", detail: "Není přiřazena norma pro rychlost nebo zatím nejsou data.", ...NO_DATA },
    bearLevel >= 0 ? { label: BEAR_LABELS[bearLevel], detail: BEAR_DETAILS[bearLevel], ...STYLES[bearLevel] } : { label: "Stav ložisek neznámý", detail: "Není přiřazena norma pro zrychlení nebo zatím nejsou data.", ...NO_DATA },
  ];

  return (
    <Card className="shadow-lg">
      <CardHeader className="border-b border-slate-100">
        <CardTitle className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-blue-600" />
          Stav měřených ložisek
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 space-y-2">
        {isLoading ? (
          <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
        ) : rows.length === 0 ? (
          <p className="text-center text-slate-500 py-6">Žádné přiřazené snímače</p>
        ) : statusRows.map(s => (
          <div key={s.label} className={`rounded-lg border px-3 py-2 ${s.bg} ${s.border}`}>
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${s.dot}`} />
              <span className={`font-semibold text-sm ${s.text}`}>{s.label}</span>
            </div>
            <p className={`text-xs ${s.text} opacity-75 pl-4`}>{s.detail}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}