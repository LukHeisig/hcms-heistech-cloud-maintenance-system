import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/utils";
import { useFileUrl } from "@/lib/privateFiles";
import LayoutMarkerDot from "./LayoutMarkerDot";
import AddMarkerDialog from "./AddMarkerDialog";

// Obrázek layoutu s kolečky strojů
export default function LayoutCanvas({ scopeType, scopeId, companyId, image, machines, vib, editing }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const url = useFileUrl(image);
  const [pending, setPending] = useState(null);
  const key = ["layoutMarkers", scopeType, scopeId];
  const { data: markers = [] } = useQuery({
    queryKey: key,
    queryFn: () => base44.entities.LayoutMarker.filter({ scope_type: scopeType, scope_id: scopeId }, null, 500),
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: key });

  const handleClick = (e) => {
    if (!editing) return;
    const r = e.currentTarget.getBoundingClientRect();
    setPending({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 });
  };
  const save = async (machineId) => {
    await base44.entities.LayoutMarker.create({ scope_type: scopeType, scope_id: scopeId, company_id: companyId, machine_id: machineId, ...pending });
    setPending(null);
    refresh();
  };
  const remove = async (m) => { await base44.entities.LayoutMarker.delete(m.id); refresh(); };

  if (!url) return <div className="h-64 rounded-xl bg-muted animate-pulse" />;
  return (
    <>
      <div className={`relative w-full rounded-xl overflow-hidden border bg-card ${editing ? "cursor-crosshair ring-2 ring-dashboard-accent" : ""}`} onClick={handleClick}>
        <img src={url} alt="Layout" className="w-full h-auto block select-none" draggable={false} />
        {markers.map((m) => (
          <LayoutMarkerDot key={m.id} marker={m} machine={machines.find((x) => x.id === m.machine_id)}
            stats={vib?.byMachine?.[m.machine_id]} editing={editing} onDelete={remove}
            onOpen={(machine) => machine && navigate(createPageUrl(`Machine?id=${machine.id}`))} />
        ))}
      </div>
      <AddMarkerDialog open={!!pending} machines={machines} onClose={() => setPending(null)} onSave={save} />
    </>
  );
}