import React from "react";
import { useNavigate } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { fmtDate, isDefectOverdue } from "./revisionConstants";

export default function RevisionTasksBell({ tasks }) {
  const navigate = useNavigate();
  if (!tasks.length) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="relative p-2 rounded-lg hover:bg-slate-100 transition-colors" title="Úkoly v revizních závadách">
          <ShieldCheck className="w-5 h-5 text-violet-600" />
          <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 text-white text-[10px] font-bold rounded-full flex items-center justify-center bg-violet-600">
            {tasks.length}
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="p-3 border-b border-slate-200">
          <h3 className="font-semibold text-slate-900">Revizní závady – úkoly</h3>
          <p className="text-xs text-slate-500">{tasks.length} čeká na vás</p>
        </div>
        <div className="max-h-96 overflow-y-auto">
          {tasks.map((d) => (
            <DropdownMenuItem key={`${d.task}-${d.id}`} className="p-3 cursor-pointer"
              onClick={() => navigate(`/Revisions?company=${d.company_id}&defect=${d.id}`)}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <p className="font-semibold text-sm text-slate-900">{d.defect_number || "Závada"}</p>
                  <Badge variant="outline" className={d.task === "take" ? "bg-amber-100 text-amber-800" : "bg-violet-100 text-violet-800"}>
                    {d.task === "take" ? "K převzetí" : "K ověření"}
                  </Badge>
                  {isDefectOverdue(d) && <Badge variant="destructive" className="text-xs">Po termínu</Badge>}
                </div>
                <p className="text-xs text-slate-600 line-clamp-2">{d.description}</p>
                {d.due_date && <p className="text-xs text-slate-500">Termín: {fmtDate(d.due_date)}</p>}
              </div>
            </DropdownMenuItem>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}