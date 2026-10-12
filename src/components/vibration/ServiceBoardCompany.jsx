import React from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import ServiceBoardMachine from "@/components/vibration/ServiceBoardMachine";
export default function ServiceBoardCompany({ company, lines, expanded, isSuperOrAdmin, toggleCompany, getBestSensorForMachine, getSensorsForMachine, assignments, allStandards, latestSensorDataMap, getLimitLevel, openMachine }) {
  const totalMachines = lines.reduce((s, l) => s + l.machines.length, 0);
  const onlineCount = lines.reduce((s, l) => s + l.machines.filter(m => {
    const sensor = getBestSensorForMachine(m.id);
    return sensor?.last_seen && Date.now() - new Date(sensor.last_seen).getTime() < 12 * 3600000;
  }).length, 0);
  return <section className="sb-company">
    <div className={`sb-company-bar${isSuperOrAdmin ? " cursor-pointer" : ""}`} onClick={() => isSuperOrAdmin && toggleCompany(company.id)}>
      <h2>{company.name}</h2><span>{totalMachines} strojů · {onlineCount} online</span>
      {isSuperOrAdmin && <button aria-label={expanded ? "Sbalit podnik" : "Rozbalit podnik"} aria-expanded={expanded}>{expanded ? <ChevronUp /> : <ChevronDown />}</button>}
    </div>
    {(!isSuperOrAdmin || expanded) && <div className="sb-grid">{lines.flatMap(({ line, machines }) => machines.map(machine => <ServiceBoardMachine key={machine.id} machine={machine} company={company} line={line}
      sensors={getSensorsForMachine(machine.id)} bestSensor={getBestSensorForMachine(machine.id)} assignments={assignments.filter(a => a.machine_id === machine.id && a.sensor_id)} standards={allStandards} latest={latestSensorDataMap} getLimitLevel={getLimitLevel} onOpen={() => openMachine(machine.id)} />))}</div>}
  </section>;
}