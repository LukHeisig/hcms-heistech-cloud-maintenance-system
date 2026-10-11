import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { moduleData } from "@/lib/moduleData";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";

export default function AcknowledgeAlertDialog({ alert, onClose }) {
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const queryClient = useQueryClient();

  const handleConfirm = async () => {
    setLoading(true);
    const user = await base44.auth.me();
    await moduleData.update("VibrationAlert", alert.id, {
      status: "acknowledged",
      acknowledged_by: user?.email || user?.full_name || "neznámý",
      acknowledged_at: new Date().toISOString(),
      acknowledge_note: note.trim() || null,
    });
    queryClient.invalidateQueries({ queryKey: ["machineAlerts"] });
    queryClient.invalidateQueries({ queryKey: ["vibrationAlerts"] });
    queryClient.invalidateQueries({ queryKey: ["activeVibrationAlerts"] });
    setLoading(false);
    setNote("");
    onClose();
  };

  return (
    <Dialog open={!!alert} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Kvitovat alarm</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-slate-600">
          {alert?.measurement_point} — {alert?.metric_label || alert?.metric_key}: {alert?.value?.toFixed(3)} {alert?.metric_unit}
        </p>
        <Textarea placeholder="Poznámka (volitelné)" value={note} onChange={(e) => setNote(e.target.value)} />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Zrušit</Button>
          <Button onClick={handleConfirm} disabled={loading}>
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Kvitovat
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}