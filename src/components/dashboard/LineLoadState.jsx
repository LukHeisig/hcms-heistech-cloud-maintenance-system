import React from "react";
import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function LineLoadState({ loading, paused, failed, onRetry }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-8 text-center" role="status">
      {loading && !paused ? <>
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <p>Načítání linky…</p>
      </> : <>
        <p>{paused ? "Načítání čeká na připojení k internetu." : failed ? "Linku se nepodařilo načíst. Zkontrolujte připojení a zkuste to znovu." : "Linka nebyla nalezena nebo k ní nemáte přístup."}</p>
        <div className="flex flex-wrap justify-center gap-3">
          {(failed || paused) && <Button variant="outline" onClick={onRetry}>Zkusit znovu</Button>}
          <Button asChild><Link to="/">Zpět na dashboard</Link></Button>
        </div>
      </>}
    </div>
  );
}