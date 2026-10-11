import React from "react";
import { Search } from "lucide-react";
export default function ServiceBoardHeader({ search, setSearch, activeTab, setActiveTab, alertBadge }) {
  return <div className="sb-top">
    <div className="sb-left"><div className="sb-title"><h1>Vibrace online</h1><div className="sb-sub">Stroje s aktivním vibračním monitoringem a přiřazeným senzorem</div></div>
      <label className="sb-search"><Search size={26} strokeWidth={2.4} /><input aria-label="Hledat stroj, linku nebo podnik" placeholder="Hledat stroj, linku nebo podnik..." value={search} onChange={e => setSearch(e.target.value)} /></label>
    </div>
    <div className="sb-right"><div className="sb-legend">
      <div><b>Stav:</b><span className="sb-dot sb-ok" />OK<span className="sb-dot sb-warning" />Upozornění<span className="sb-dot sb-danger" />Výstraha</div>
      <div><b>Senzor:</b><span className="sb-square sb-online" />{"< 12h"}<span className="sb-square sb-recent" />12–24h<span className="sb-square sb-offline" />{'>'} 24h<span className="sb-square sb-unknown" />Bez</div>
    </div><div className="sb-tabs">
      <button className={`sb-tab ${activeTab === "sensors" ? "on" : ""}`} onClick={() => setActiveTab("sensors")}>Senzory</button>
      <button className={`sb-tab ${activeTab === "alerts" ? "on" : ""}`} onClick={() => setActiveTab("alerts")}>Alarmy{alertBadge && <span className={`sb-alarm-badge ${alertBadge.bg} ${alertBadge.text}`}>Pásmo {alertBadge.label} · {alertBadge.count}</span>}</button>
    </div></div>
  </div>;
}