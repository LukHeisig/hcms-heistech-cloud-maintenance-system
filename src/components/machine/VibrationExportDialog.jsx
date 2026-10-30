import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2 } from "lucide-react";
import { format, subDays } from "date-fns";

// Export statických hodnot vibrací do Excelu (CSV) — points: [{ label, sensorId }]
export default function VibrationExportDialog({ open, onClose, machineName, points }) {
  const [selected, setSelected] = useState(() => points.map((p) => p.sensorId));
  const [from, setFrom] = useState(format(subDays(new Date(), 30), "yyyy-MM-dd"));
  const [to, setTo] = useState(format(new Date(), "yyyy-MM-dd"));
  const [loading, setLoading] = useState(false);
  const toggle = (sid) => setSelected((s) => (s.includes(sid) ? s.filter((x) => x !== sid) : [...s, sid]));

  const handleExport = async () => {
    setLoading(true);
    const toSec = new Date(to + "T23:59:59Z").getTime() / 1000;
    const num = (v) => (v == null ? "" : String(Math.round(v * 1000) / 1000).replace(".", ","));
    const lines = ["Místo;Snímač;Datum a čas;Vel X [mm/s];Vel Y [mm/s];Vel Z [mm/s];Zrychlení Z [g];Obálka Z [g]"];
    for (const p of points.filter((p) => selected.includes(p.sensorId))) {
      const res = await base44.functions.invoke("getSensorTrend", { sensor_id: p.sensorId, from_date: from, limit: 5000 });
      for (const r of res.data.data || []) {
        if (r.ts_unix > toSec) continue;
        const dt = new Date(r.ts_unix * 1000).toISOString().slice(0, 16).replace("T", " ");
        lines.push([p.label, p.sensorId, dt, num(r.vel_rms_x_mm_s), num(r.vel_rms_y_mm_s), num(r.vel_rms_z_mm_s), num(r.oa_acc_z), num(r.env_rms_z)].join(";"));
      }
    }
    const blob = new Blob(["\uFEFF" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `vibrace_${machineName || "stroj"}_${from}_${to}.csv`;
    a.click();
    setLoading(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>Export vibrací do Excelu</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-xs text-muted-foreground">Od</label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div><label className="text-xs text-muted-foreground">Do</label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        </div>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {points.map((p) => (
            <label key={p.sensorId} className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox checked={selected.includes(p.sensorId)} onCheckedChange={() => toggle(p.sensorId)} />
              {p.label} <span className="text-xs text-muted-foreground">({p.sensorId})</span>
            </label>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Zrušit</Button>
          <Button onClick={handleExport} disabled={loading || selected.length === 0}>
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}Exportovat
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}