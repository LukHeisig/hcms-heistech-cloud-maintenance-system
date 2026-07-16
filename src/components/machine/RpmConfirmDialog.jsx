import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Gauge, CheckCircle } from "lucide-react";

// Dialog pro potvrzení / ruční zadání otáček stroje před AI analýzou
export default function RpmConfirmDialog({ open, onClose, detected, onConfirm }) {
  const [rpm, setRpm] = useState("");

  useEffect(() => {
    if (open) setRpm(detected?.rpm != null ? String(detected.rpm) : "");
  }, [open, detected]);

  const rpmNum = parseFloat(rpm);
  const valid = !isNaN(rpmNum) && rpmNum > 0;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-purple-700">
            <Gauge className="w-5 h-5" />
            Otáčky stroje
          </DialogTitle>
          <DialogDescription>
            Před analýzou potvrďte otáčkovou frekvenci stroje.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-1">
          {detected ? (
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-sm">
              <p className="text-xs text-purple-500 font-semibold uppercase tracking-wide mb-1">
                Autodetekce z FFT rychlosti (6–80 Hz)
              </p>
              <p className="font-mono font-bold text-purple-800">
                {detected.freq} Hz = {detected.rpm} RPM
              </p>
            </div>
          ) : (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-xs text-yellow-800">
              Otáčky se nepodařilo automaticky detekovat ze spektra. Zadejte je prosím ručně.
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1.5">
              Otáčky [RPM]
            </label>
            <Input
              type="number"
              min="1"
              value={rpm}
              onChange={(e) => setRpm(e.target.value)}
              placeholder="např. 1480"
            />
            {valid && (
              <p className="text-[11px] text-slate-400 mt-1 font-mono">= {(rpmNum / 60).toFixed(2)} Hz</p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Zrušit</Button>
          <Button
            className="bg-purple-600 hover:bg-purple-700 gap-1.5"
            disabled={!valid}
            onClick={() => onConfirm(rpmNum / 60)}
          >
            <CheckCircle className="w-4 h-4" />
            Potvrdit a analyzovat
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}