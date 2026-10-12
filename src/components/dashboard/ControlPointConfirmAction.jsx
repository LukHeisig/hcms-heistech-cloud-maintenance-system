import React from "react";
import { ClipboardCheck, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useViewMode } from "@/components/ViewModeContext";

export default function ControlPointConfirmAction({ success, visible, pending, onConfirm, floating = false }) {
  const { viewMode } = useViewMode();
  if (!success && !visible) return null;
  if (floating && viewMode !== "demip") return null;
  const action = success ? (
    <div role="status" className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-status-success px-3 py-2 text-sm font-semibold text-demip-brand-foreground">
      <CheckCircle2 className="h-4 w-4 shrink-0" />Potvrzeno a uloženo
    </div>
  ) : (
    <Button onClick={onConfirm} disabled={pending} className="h-auto min-h-11 w-full whitespace-normal bg-status-success px-3 py-2 text-sm font-semibold text-demip-brand-foreground shadow-none hover:bg-status-success/90">
      {pending ? <><Loader2 className="h-4 w-4 shrink-0 animate-spin" />Ukládání...</> : <><ClipboardCheck className="h-4 w-4 shrink-0" />Potvrdit kontrolu</>}
    </Button>
  );
  if (!floating) return <div className={viewMode === "demip" ? "hidden md:block" : ""}>{action}</div>;
  return (
    <>
      <div className="h-16 md:hidden" aria-hidden="true" />
      <div className="fixed inset-x-0 bottom-[calc(3.75rem+env(safe-area-inset-bottom))] z-40 border-t border-border bg-card px-3 py-2 md:hidden">
        <div className="mx-auto w-full min-w-0 max-w-xl">{action}</div>
      </div>
    </>
  );
}