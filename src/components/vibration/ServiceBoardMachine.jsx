import React from "react";
import { ChevronRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { formatMachineName } from "@/lib/utils";
import ServiceBoardDiagnostics from "@/components/vibration/ServiceBoardDiagnostics";
import ServiceBoardSensor from "@/components/vibration/ServiceBoardSensor";
export default function ServiceBoardMachine({ machine, company, line, sensors, bestSensor, assignments, standards, latest, getLimitLevel, onOpen }) {
  const { data: schema } = useQuery({
    queryKey: ["vibrationSchema", machine.vibration_schema_id],
    queryFn: async () => (await base44.entities.VibrationSchema.filter({ id: machine.vibration_schema_id }))[0] || null,
    enabled: !!machine.vibration_schema_id, staleTime: 600000,
  });
  let rows = []; try { rows = JSON.parse(schema?.rows_definition || "[]"); } catch { rows = []; }
  const placeOf = sensorId => assignments.filter(a => a.sensor_id === sensorId).map(a => { const r = rows[a.schema_row_index]; return r ? [r.label, r.name].filter(Boolean).filter((v, i, arr) => arr.indexOf(v) === i).join(" – ") : `Bod ${a.schema_row_index + 1}`; }).join(", ");
  const hours = bestSensor?.last_seen ? (Date.now() - new Date(bestSensor.last_seen).getTime()) / 3600000 : null;
  const state = hours == null ? "unknown" : hours < 12 ? "online" : hours < 24 ? "recent" : "offline";
  const labels = { unknown: "Neznámý", online: "Online", recent: "Nedávno", offline: "Offline" };
  return <article className="sb-sheet">
    <header className={`sb-machine-head sb-head-${state}`}><div><h3>{formatMachineName(machine)}</h3><div className="sb-org">{company.name} <i>›</i> {line.name}</div>{machine.location && <div className="sb-org">{machine.location}</div>}</div><span className={`sb-status sb-status-${state}`}>{labels[state]}</span></header>
    <ServiceBoardDiagnostics machine={machine} assignments={assignments} standards={standards} latest={latest} getLimitLevel={getLimitLevel} />
    <hr className="sb-perforation" />
    <div className="sb-sensors">{sensors.length ? sensors.map(sensor => <ServiceBoardSensor key={sensor.id} sensor={sensor} place={placeOf(sensor.sensor_id)} data={latest[sensor.sensor_id]} />) : <p className="sb-axes">Senzor nepřiřazen</p>}</div>
    <button className="sb-open" onClick={onOpen}>Otevřít <ChevronRight size={22} strokeWidth={3} /></button>
  </article>;
}