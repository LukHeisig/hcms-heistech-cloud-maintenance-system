import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Cpu } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cs } from "date-fns/locale";

export default function VseUnitCard({ unit, selected, onClick }) {
  const lastSeen = unit.last_seen ? new Date(unit.last_seen) : null;
  const online = lastSeen && Date.now() - lastSeen.getTime() < 15 * 60 * 1000;

  return (
    <Card
      onClick={onClick}
      className={`cursor-pointer transition-all border-2 ${selected ? "border-teal-500 shadow-md" : "border-transparent hover:border-teal-300"}`}
    >
      <CardContent className="p-4 flex items-start gap-3">
        <div className="p-2 bg-teal-50 rounded-lg">
          <Cpu className="w-5 h-5 text-teal-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="font-semibold text-slate-800 truncate">{unit.name || unit.unit_id}</p>
            <Badge className={online ? "bg-green-600" : "bg-slate-400"}>{online ? "Online" : "Offline"}</Badge>
          </div>
          <p className="text-xs text-slate-500 font-mono truncate">{unit.unit_id}</p>
          <p className="text-xs text-slate-500 mt-1">
            {lastSeen
              ? `Naposledy: ${formatDistanceToNow(lastSeen, { addSuffix: true, locale: cs })}`
              : "Zatím žádná data"}
            {" · "}{unit.messages_total || 0} zpráv
          </p>
        </div>
      </CardContent>
    </Card>
  );
}