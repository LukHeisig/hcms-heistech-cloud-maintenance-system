import React from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Hand, Send, CheckCircle2, Undo2 } from "lucide-react";

// Tlačítka pro přechody stavů závady dle schváleného postupu
export default function DefectWorkflowActions({ status, isAssigned, canConfirm, busy, onTake, onHandOver, onConfirm, onReturn }) {
  const spin = busy && <Loader2 className="w-4 h-4 animate-spin" />;
  if (isAssigned && status === "assigned") {
    return <Button onClick={onTake} disabled={busy} className="bg-amber-600 hover:bg-amber-700">{spin || <Hand className="w-4 h-4" />} Převzít k řešení</Button>;
  }
  if (isAssigned && status === "in_progress") {
    return <Button onClick={onHandOver} disabled={busy} className="bg-violet-600 hover:bg-violet-700">{spin || <Send className="w-4 h-4" />} Předat k ověření</Button>;
  }
  if (canConfirm && status === "awaiting_verification") {
    return (
      <>
        <Button variant="outline" onClick={onReturn} disabled={busy} className="border-amber-400 text-amber-700">{spin || <Undo2 className="w-4 h-4" />} Vrátit do řešení</Button>
        <Button onClick={onConfirm} disabled={busy} className="bg-green-600 hover:bg-green-700">{spin || <CheckCircle2 className="w-4 h-4" />} Potvrdit a ukončit</Button>
      </>
    );
  }
  return null;
}