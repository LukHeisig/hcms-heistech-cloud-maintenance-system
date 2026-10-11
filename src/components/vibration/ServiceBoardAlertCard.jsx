import React from "react";
import { formatDistanceToNow } from "date-fns";
import { cs } from "date-fns/locale";
import AcknowledgedInfo from "@/components/vibration/AcknowledgedInfo";
export default function ServiceBoardAlertCard({ alert, severityLabel, typeLabel, limitInfo, formatValue, onOpen, onAcknowledge }) {
  const date = alert.created_date && new Date(/[Zz]$|[+-]\d{2}:\d{2}$/.test(String(alert.created_date)) ? alert.created_date : alert.created_date + "Z");
  return <article className="sb-alert-card" data-severity={alert.severity} data-status={alert.status}>
    <div className="sb-alert-title"><div className="sb-alert-name">{alert.machine_name} <em>— {alert.measurement_point}</em></div><span className={`sb-tag ${alert.severity === "D" ? "sb-tag-active" : "sb-tag-warning"}`}>{severityLabel}</span></div>
    <div className="sb-alert-value" title={typeLabel}>{alert.metric_label}:<b>{formatValue(alert.value, alert.metric_unit)}</b></div>
    {limitInfo && <div className="sb-limits">{limitInfo} {alert.metric_unit}</div>}
    {date && <div className="sb-alert-date">{formatDistanceToNow(date, { addSuffix: true, locale: cs })}</div>}
    <AcknowledgedInfo alert={alert} />
    <div className="sb-cta"><span className={`sb-tag ${alert.status === "active" ? "sb-tag-active" : ""}`}>{alert.status === "active" ? "Aktivní" : "Kvitováno"}</span><button className="sb-outline" onClick={onOpen}>Otevřít</button>{alert.status === "active" && onAcknowledge && <button className="sb-outline primary" onClick={() => onAcknowledge(alert)}>Kvitovat alarm</button>}</div>
  </article>;
}