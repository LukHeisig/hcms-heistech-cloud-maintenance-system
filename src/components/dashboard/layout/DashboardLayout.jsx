import React, { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Pencil, Check, ImageOff } from "lucide-react";
import LayoutCanvas from "./LayoutCanvas";
import LayoutLegend from "./LayoutLegend";

// Záložka Layout — celkový stav vibrací strojů na obrázku podniku / linky
export default function DashboardLayout({ user, companies = [], lines = [], machines = [], vib }) {
  const options = companies.flatMap((c) => [
    { key: `company:${c.id}`, type: "company", id: c.id, companyId: c.id, label: `Podnik — ${c.name}`, image: c.layout_image_url },
    ...lines.filter((l) => l.company_id === c.id).map((l) => ({ key: `line:${l.id}`, type: "line", id: l.id, companyId: c.id, label: `${companies.length > 1 ? c.name + " / " : ""}Linka — ${l.name}`, image: l.layout_image_url })),
  ]).filter((o) => o.image);
  const [selected, setSelected] = useState(null);
  const [editing, setEditing] = useState(false);
  const current = options.find((o) => o.key === selected) || options[0];
  const canEdit = ["manager", "admin", "superAdmin"].includes(user?.user_type);

  if (!current) return (
    <div className="text-center py-12 text-muted-foreground">
      <ImageOff className="w-12 h-12 mx-auto mb-3 opacity-50" />
      <p>Zatím není nahrán žádný obrázek layoutu.</p>
      <p className="text-sm">Obrázek nahrajete v administraci podniku nebo linky.</p>
    </div>
  );

  const scopeMachines = machines.filter((m) => current.type === "line"
    ? m.line_id === current.id
    : lines.some((l) => l.id === m.line_id && l.company_id === current.id));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={current.key} onValueChange={(v) => { setSelected(v); setEditing(false); }}>
          <SelectTrigger className="w-full sm:w-80"><SelectValue /></SelectTrigger>
          <SelectContent>{options.map((o) => <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>)}</SelectContent>
        </Select>
        {canEdit && (
          <Button variant={editing ? "default" : "outline"} size="sm" className="gap-2" onClick={() => setEditing((v) => !v)}>
            {editing ? <Check className="w-4 h-4" /> : <Pencil className="w-4 h-4" />}{editing ? "Hotovo" : "Upravit"}
          </Button>
        )}
        {editing && <span className="text-xs text-muted-foreground">Klikněte do obrázku pro přidání stroje, křížkem stroj odeberete.</span>}
      </div>
      <LayoutCanvas key={current.key} scopeType={current.type} scopeId={current.id} companyId={current.companyId}
        image={current.image} machines={scopeMachines} vib={vib} editing={editing} />
      <LayoutLegend />
    </div>
  );
}