import React from "react";
import { isMachineStopped, isDataOnline, STOPPED_LABEL, STOPPED_DETAIL } from "@/lib/machineRunState";
const valueText = value => value == null ? "—" : value.toFixed(3);
export default function ServiceBoardDiagnostics({ machine, assignments, standards, latest, getLimitLevel }) {
  const points = assignments.map(a => ({ data: latest[a.sensor_id], vel: standards.find(s => s.id === a.vel_standard_id), acc: standards.find(s => s.id === a.acc_standard_id) })).filter(p => isDataOnline(p.data));
  if (isMachineStopped(machine, points.map(p => p.data))) return <div className="sb-diagnostics"><div className="sb-cell">
    <div className="sb-label">Stav stroje</div><div className="sb-value">{STOPPED_LABEL}</div><div className="sb-axes">{STOPPED_DETAIL}</div>
  </div></div>;
  const velocity = points.flatMap(p => [p.data.vel_rms_x_mm_s, p.data.vel_rms_y_mm_s, p.data.vel_rms_z_mm_s]).filter(v => v != null);
  const bearing = points.map(p => p.data.rms_z_g ?? p.data.oa_acc_z).filter(v => v != null);
  const envelopes = points.map(p => p.data.env_rms_z).filter(v => v != null);
  const axis = key => { const values = points.map(p => p.data[key]).filter(v => v != null); return values.length ? Math.max(...values) : null; };
  const velocityZone = Math.max(-1, ...points.flatMap(p => [p.data.vel_rms_x_mm_s, p.data.vel_rms_y_mm_s, p.data.vel_rms_z_mm_s].map(v => getLimitLevel(v, p.vel?.limit_ab, p.vel?.limit_bc, p.vel?.limit_cd))));
  const bearingZone = Math.max(-1, ...points.flatMap(p => [p.data.rms_z_g ?? p.data.oa_acc_z, p.data.env_rms_z].map(v => getLimitLevel(v, p.acc?.acc_limit_ab, p.acc?.acc_limit_bc, p.acc?.acc_limit_cd))));
  const cells = [
    { label: "Vibrace", zone: velocityZone, value: velocity.length ? Math.max(...velocity) : null, unit: "mm/s", detail: `X ${valueText(axis("vel_rms_x_mm_s"))} · Y ${valueText(axis("vel_rms_y_mm_s"))} · Z ${valueText(axis("vel_rms_z_mm_s"))}` },
    { label: "Ložiska", zone: bearingZone, value: bearing.length ? Math.max(...bearing) : null, unit: "g", detail: `RMS Z ${valueText(bearing.length ? Math.max(...bearing) : null)} · Obálka ${valueText(envelopes.length ? Math.max(...envelopes) : null)} g` },
  ];
  return <div className="sb-diagnostics">{cells.map(cell => <div className="sb-cell" key={cell.label}>
    <div className="sb-label">{cell.label}</div>
    <div className="sb-bands" aria-label={cell.zone < 0 ? "Bez dat nebo normy" : `Pásmo ${"ABCD"[cell.zone]}`}>{["A", "B", "C", "D"].map((band, index) => <span key={band} className={cell.zone === index ? `sb-band-${band}` : ""}>{band}</span>)}</div>
    <div className="sb-value">{valueText(cell.value)}<small>{cell.unit}</small></div><div className="sb-axes">{cell.detail}</div>
  </div>)}</div>;
}