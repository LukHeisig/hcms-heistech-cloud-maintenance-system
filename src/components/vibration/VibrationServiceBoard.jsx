import React from "react";
import { Loader2 } from "lucide-react";
import ServiceBoardHeader from "@/components/vibration/ServiceBoardHeader";
import ServiceBoardCompany from "@/components/vibration/ServiceBoardCompany";
import VibrationAlertsPanel from "@/components/vibration/VibrationAlertsPanel";
import "@/components/vibration/serviceBoard.css";
export default function VibrationServiceBoard(props) {
  const { activeTab, user, visibleMachineIdSet, isLoading, loadError, grouped, expandedCompanies, search } = props;
  return <div className="service-board">
    <ServiceBoardHeader {...props} />
    {loadError ? <div className="sb-message" role="alert">Data se nepodařilo načíst. Obnovte stránku a zkuste to znovu.</div> : isLoading ? <div className="sb-message sb-loading" role="status"><Loader2 className="animate-spin" size={30} />Načítám data...</div> : activeTab === "alerts" ? <div className="sb-alerts"><VibrationAlertsPanel user={user} visibleMachineIds={visibleMachineIdSet} serviceBoard /></div> : grouped.length === 0 ? <div className="sb-message">{search ? "Žádné výsledky" : "Žádné stroje s vibračním monitoringem"}<small>{search ? "Zkuste jiné hledané slovo." : "Aktivujte modul vibrací a přiřaďte senzory ke strojům."}</small></div> : grouped.map(group => <ServiceBoardCompany key={group.company.id} {...props} {...group} expanded={expandedCompanies[group.company.id] ?? false} />)}
  </div>;
}