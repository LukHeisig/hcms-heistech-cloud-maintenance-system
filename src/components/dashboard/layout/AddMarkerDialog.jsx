import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

// Výběr stroje pro nové kolečko na layoutu
export default function AddMarkerDialog({ open, machines, onClose, onSave }) {
  const [machineId, setMachineId] = useState("");
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { setMachineId(""); onClose(); } }}>
      <DialogContent>
        <DialogHeader><DialogTitle>Přidat stroj do layoutu</DialogTitle></DialogHeader>
        <Select value={machineId} onValueChange={setMachineId}>
          <SelectTrigger><SelectValue placeholder="Vyberte stroj" /></SelectTrigger>
          <SelectContent>
            {machines.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Zrušit</Button>
          <Button disabled={!machineId} onClick={() => { onSave(machineId); setMachineId(""); }}>Přidat</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}