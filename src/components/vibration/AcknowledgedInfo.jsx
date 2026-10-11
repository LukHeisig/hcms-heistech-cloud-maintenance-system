import React from "react";
import { format } from "date-fns";
import { cs } from "date-fns/locale";
import { CheckCircle2 } from "lucide-react";

export default function AcknowledgedInfo({ alert }) {
  if (alert.status !== "acknowledged") return null;
  return (
    <div className="mt-2 flex items-start gap-1.5 text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-md px-2 py-1">
      <CheckCircle2 className="w-3.5 h-3.5 text-green-600 mt-0.5 flex-shrink-0" />
      <div>
        <span>Kvitoval <span className="font-semibold">{alert.acknowledged_by || "neznámý"}</span></span>
        {alert.acknowledged_at && <span> · {format(new Date(alert.acknowledged_at), "d.M.yyyy HH:mm", { locale: cs })}</span>}
        {alert.acknowledge_note && <p className="italic text-slate-500">„{alert.acknowledge_note}“</p>}
      </div>
    </div>
  );
}