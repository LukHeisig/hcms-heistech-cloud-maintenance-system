import React from "react";
import DashboardMachineRow from "@/components/dashboard/DashboardMachineRow";
import MachineDiagnosticStatus from "@/components/dashboard/MachineDiagnosticStatus";
import { isMachineStopped } from "@/lib/machineRunState";

const zones = ["A", "B", "C", "D"];
const zoneOf = (value, ab, bc, cd) => {
  if (value == null || ab == null) return null;
  if (cd != null && value >= cd) return "D";
  if (bc != null && value >= bc) return "C";
  return value >= ab ? "B" : "A";
};
const worse = (a, b) => zones.indexOf(b) > zones.indexOf(a) ? b : a;

export default function LineDiagnosticMachineRow({ machine, type, assignments = [], latest = {}, standards = {}, loading = false, ...rowProps }) {
  const status = { velocityZone: null, bearingZone: null };
  if (type === "vibration") assignments.forEach(assignment => {
    if (assignment.machine_id !== machine.id) return;
    const data = latest[assignment.sensor_id];
    if (!data) return;
    const velocity = standards[assignment.vel_standard_id];
    const bearing = standards[assignment.acc_standard_id];
    [data.vel_rms_x_mm_s, data.vel_rms_y_mm_s, data.vel_rms_z_mm_s].forEach(value => {
      status.velocityZone = worse(status.velocityZone, zoneOf(value, velocity?.limit_ab, velocity?.limit_bc, velocity?.limit_cd));
    });
    [data.rms_z_g ?? data.oa_acc_z, data.env_rms_z].forEach(value => {
      status.bearingZone = worse(status.bearingZone, zoneOf(value, bearing?.acc_limit_ab, bearing?.acc_limit_bc, bearing?.acc_limit_cd));
    });
  });
  const worst = worse(status.velocityZone, status.bearingZone);
  const dot = loading || !worst ? undefined : worst === "D" ? "critical" : worst === "C" ? "warning" : "ok";
  return (
    <DashboardMachineRow machine={machine} status={dot} showPoints={false} targetUrl={`/Machine?id=${machine.id}#${type}`}
      statusDescription={loading ? "Načítání diagnostiky" : worst ? `Diagnostika: pásmo ${worst}` : "Diagnostický stav není vyhodnocen"} {...rowProps}>
      {type === "vibration" && <MachineDiagnosticStatus status={status} loading={loading}
        stopped={isMachineStopped(machine, assignments.filter(a => a.machine_id === machine.id).map(a => latest[a.sensor_id]))} />}
    </DashboardMachineRow>
  );
}