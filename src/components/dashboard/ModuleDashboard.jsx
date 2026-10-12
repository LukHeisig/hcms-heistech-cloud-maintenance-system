import React, { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Droplet, Activity, Loader2 } from "lucide-react";
import DashboardDemip from "@/components/dashboard/DashboardDemip";
import DashboardVibration from "@/components/dashboard/DashboardVibration";
import "@/components/dashboard/moduleDashboard.css";
import "@/components/dashboard/operationsDashboard.css";

export default function ModuleDashboard({ demipEnabled, vibrationEnabled, loading, description, demip, vibration }) {
  const [params, setParams] = useSearchParams();
  const requested = params.get("module");
  const tab = requested === "vibration" && vibrationEnabled ? "vibration" : demipEnabled ? "demip" : "vibration";
  useEffect(() => {
    if (!loading && (demipEnabled || vibrationEnabled) && requested !== tab) {
      setParams(prev => { const next = new URLSearchParams(prev); next.set("module", tab); return next; }, { replace: true });
    }
  }, [loading, demipEnabled, vibrationEnabled, requested, tab, setParams]);
  const choose = value => setParams(prev => { const next = new URLSearchParams(prev); next.set("module", value); return next; });
  return (
    <div className="module-dashboard p-4 md:p-8 min-h-screen bg-dashboard-background text-foreground">
      <div className="op-content">
        <div className="op-hero op-a2">
        <header>
          <h1 className="text-3xl md:text-4xl font-bold mb-2">Dashboard</h1>
          <p className="text-muted-foreground">{description}</p>
        </header>
          <div role="tablist" aria-label="Moduly dashboardu" className="op-tabs">
            {[["demip", "DEMIP", Droplet, demipEnabled], ["vibration", "Vibrace", Activity, vibrationEnabled]].filter(item => item[3]).map(([value, label, Icon]) => (
              <button key={value} id={`dashboard-tab-${value}`} role="tab" aria-selected={tab === value} aria-controls={`dashboard-panel-${value}`} onClick={() => choose(value)}
                className={`op-tab ${tab === value ? "on" : ""}`}>
                <Icon className="w-4 h-4" />{label}
              </button>
            ))}
          </div>
        </div>
        {loading ? <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin" aria-label="Načítání dashboardu" /></div> : <>
          {!demipEnabled && !vibrationEnabled ? <p className="text-sm text-muted-foreground py-8">Pro tento podnik nejsou aktivní moduly DEMIP ani Vibrace.</p> :
            <section className={`op-mod ${tab === "demip" ? "op-a3" : "op-a4"}`} role="tabpanel" id={`dashboard-panel-${tab}`} aria-labelledby={`dashboard-tab-${tab}`}>
              <div className="op-modh">{tab === "demip" ? "DEMIP" : "Vibrace"}</div>
              {tab === "demip" ? <DashboardDemip {...demip} /> : <DashboardVibration {...vibration} />}
            </section>}
        </>}
      </div>
    </div>
  );
}