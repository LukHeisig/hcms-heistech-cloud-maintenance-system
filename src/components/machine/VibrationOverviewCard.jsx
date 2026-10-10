import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { moduleData } from "@/lib/moduleData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, Loader2 } from "lucide-react";

const COLORS = ["bg-green-500", "bg-yellow-400", "bg-orange-500", "bg-red-600"];
const LABELS = ["V pořádku", "Varování", "Alarm", "Nebezpečí"];

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
      if (d && level < 0) level = 0;
      const def = defs[a.schema_row_index] || {};
      return { id: a.id, label: def.label || `Bod ${a.schema_row_index + 1}`, name: def.name, vel, acc: d?.oa_acc_z, level };
    });
  }, [assignments, latest, standards, schema]);

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
        ) : rows.map(r => (
          <div key={r.id} className="flex items-center gap-3 p-3 rounded-lg bg-slate-50">
            <span className={`w-4 h-4 rounded-full flex-shrink-0 ${r.level >= 0 ? COLORS[r.level] : "bg-slate-300"}`} />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-slate-900 truncate">{r.label}{r.name ? ` – ${r.name}` : ""}</p>
              <p className="text-xs text-slate-500">{r.level >= 0 ? LABELS[r.level] : "Bez dat"}</p>
            </div>
            {r.vel != null && (
              <div className="text-right text-xs text-slate-600">
                <p>{r.vel.toFixed(2)} mm/s</p>
                {r.acc != null && <p>{r.acc.toFixed(2)} g</p>}
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}