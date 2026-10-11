import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { moduleData } from "@/lib/moduleData";
import { base44 } from "@/api/base44Client";

const ZONES = ["A", "B", "C", "D"];
const zoneOf = (v, ab, bc, cd) => {
  if (v == null || ab == null) return null;
  if (cd != null && v >= cd) return "D";
  if (bc != null && v >= bc) return "C";
  return v >= ab ? "B" : "A";
};
const worse = (a, b) => (ZONES.indexOf(b) > ZONES.indexOf(a) ? b : a);

const OFFLINE_MS = 12 * 3600 * 1000;
const SEV_RANK = { D: 3, C: 2, B: 1 };

// Data pro vibrační přehled na dashboardu (omezeno na zadané stroje)
export default function useVibrationDashboard(machineIds, enabled) {
  const ids = useMemo(() => [...machineIds].sort(), [machineIds]);
  const on = enabled && ids.length > 0;
  const q = { machine_id: { $in: ids } };

  const { data: assignments = [], isLoading: loadingAssignments } = useQuery({
    queryKey: ["dashVibAssign", ids],
    queryFn: () => moduleData.filter("VibrationSensorAssignment", q, null, 1000),
    enabled: on, staleTime: 300000,
  });
  const sensorIds = useMemo(() => [...new Set(assignments.map(a => a.sensor_id).filter(Boolean))], [assignments]);

  const { data: sensors = [] } = useQuery({
    queryKey: ["dashVibSensors", sensorIds],
    queryFn: () => moduleData.filter("AissensSensor", { sensor_id: { $in: sensorIds } }, null, 1000),
    enabled: on && sensorIds.length > 0, staleTime: 120000,
  });
  const { data: latest = {}, isLoading: loadingLatest } = useQuery({
    queryKey: ["dashVibLatest", sensorIds],
    queryFn: () => moduleData.latestSensorData(sensorIds),
    enabled: on && sensorIds.length > 0, staleTime: 300000,
  });
  const { data: standards = [], isLoading: loadingStandards } = useQuery({
    queryKey: ["vibStandards"],
    queryFn: () => base44.entities.VibrationStandard.list(null, 500),
    enabled: on, staleTime: 600000,
  });
  const { data: activeAlerts = [] } = useQuery({
    queryKey: ["dashVibActive", ids],
    queryFn: () => moduleData.filter("VibrationAlert", { ...q, status: "active" }, "-created_date", 500),
    enabled: on, staleTime: 60000, refetchInterval: 120000,
  });
  const { data: recentAlerts = [] } = useQuery({
    queryKey: ["dashVibRecent", ids],
    queryFn: () => moduleData.filter("VibrationAlert", q, "-created_date", 5),
    enabled: on, staleTime: 60000, refetchInterval: 120000,
  });

  return useMemo(() => {
    const now = Date.now();
    const sensorById = Object.fromEntries(sensors.map(s => [s.sensor_id, s]));
    const offline = sensors.filter(s => !s.last_seen || now - new Date(s.last_seen).getTime() > OFFLINE_MS);
    const lowBattery = sensors.filter(s => s.last_battery_level != null && s.last_battery_level <= 1);

    const stdById = Object.fromEntries(standards.map(s => [s.id, s]));
    const byMachine = {};
    assignments.forEach(a => {
      if (!a.sensor_id) return;
      const m = (byMachine[a.machine_id] ||= { sensors: 0, vel: null, lastSeen: null, severity: null, alerts: 0 });
      m.sensors++;
      const d = latest[a.sensor_id];
      if (d) {
        const v = Math.max(d.vel_rms_x_mm_s || 0, d.vel_rms_y_mm_s || 0, d.vel_rms_z_mm_s || 0);
        m.vel = Math.max(m.vel ?? 0, v);
        const vs = stdById[a.vel_standard_id];
        if (vs) m.zone = worse(m.zone, zoneOf(v, vs.limit_ab, vs.limit_bc, vs.limit_cd));
        const as = stdById[a.acc_standard_id];
        if (as && d.rms_z_g != null) m.zone = worse(m.zone, zoneOf(d.rms_z_g, as.acc_limit_ab, as.acc_limit_bc, as.acc_limit_cd));
        if (vs) {
          [d.vel_rms_x_mm_s, d.vel_rms_y_mm_s, d.vel_rms_z_mm_s].forEach(value => {
            m.velocityZone = worse(m.velocityZone, zoneOf(value, vs.limit_ab, vs.limit_bc, vs.limit_cd));
          });
        }
        if (as) {
          [d.rms_z_g ?? d.oa_acc_z, d.env_rms_z].forEach(value => {
            m.bearingZone = worse(m.bearingZone, zoneOf(value, as.acc_limit_ab, as.acc_limit_bc, as.acc_limit_cd));
          });
        }
      }
      const seen = sensorById[a.sensor_id]?.last_seen;
      if (seen && (!m.lastSeen || seen > m.lastSeen)) m.lastSeen = seen;
    });
    activeAlerts.forEach(al => {
      const m = (byMachine[al.machine_id] ||= { sensors: 0, vel: null, lastSeen: null, severity: null, alerts: 0 });
      m.alerts++;
      if ((SEV_RANK[al.severity] || 0) > (SEV_RANK[m.severity] || 0)) m.severity = al.severity;
    });

    return {
      monitoredMachines: Object.values(byMachine).filter(m => m.sensors > 0).length,
      sensorCount: sensorIds.length,
      alertsD: activeAlerts.filter(a => a.severity === "D").length,
      alertsC: activeAlerts.filter(a => a.severity === "C").length,
      offlineCount: offline.length,
      lowBatteryCount: lowBattery.length,
      byMachine,
      recentAlerts,
      isLoading: on && (loadingAssignments || loadingStandards || (sensorIds.length > 0 && loadingLatest)),
    };
  }, [assignments, sensors, latest, activeAlerts, recentAlerts, sensorIds, standards, on, loadingAssignments, loadingStandards, loadingLatest]);
}