import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

// Umístění snímačů: podnik / linka / stroj (podle přiřazení v měřicích místech nebo přímo u snímače)
export default function useSensorLocations(machines) {
  const { data: assignments = [] } = useQuery({
    queryKey: ["allSensorAssignments"],
    queryFn: () => base44.entities.VibrationSensorAssignment.list(null, 2000),
    staleTime: 300000,
  });
  const { data: lines = [] } = useQuery({
    queryKey: ["allLines"],
    queryFn: () => base44.entities.Line.list("order_index", 1000),
    staleTime: 300000,
  });
  const { data: companies = [] } = useQuery({
    queryKey: ["companies"],
    queryFn: () => base44.entities.Company.list(null, 1000),
    staleTime: 300000,
  });

  return useMemo(() => {
    const machineById = Object.fromEntries(machines.map((m) => [m.id, m]));
    const lineById = Object.fromEntries(lines.map((l) => [l.id, l]));
    const companyById = Object.fromEntries(companies.map((c) => [c.id, c]));
    const bySensor = {};
    assignments.forEach((a) => { if (a.sensor_id && !bySensor[a.sensor_id]) bySensor[a.sensor_id] = a.machine_id; });
    return (sensor) => {
      const machine = machineById[bySensor[sensor.sensor_id] || sensor.machine_id];
      if (!machine) return null;
      const line = lineById[machine.line_id];
      return { machine, line, company: line && companyById[line.company_id] };
    };
  }, [assignments, lines, companies, machines]);
}