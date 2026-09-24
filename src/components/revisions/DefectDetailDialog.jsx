import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import DefectStatusBadge, { ClassificationBadge } from "./DefectStatusBadge";
import DefectAttachments from "./DefectAttachments";
import DefectTrail from "./DefectTrail";
import ChangeHistory from "./ChangeHistory";
import { STATUSES, CLASSIFICATIONS, VTZ_TYPES, todayIso, userName } from "./revisionConstants";
import { logChanges } from "./revisionLog";

const F = ({ label, children, className = "" }) => <div className={className}><Label className="text-xs">{label}</Label>{children}</div>;

export default function DefectDetailDialog({ defect, report, users, user, canEdit, onClose }) {
  const qc = useQueryClient();
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setForm(defect ? { ...defect, status: defect.status || "new" } : null); }, [defect]);
  if (!defect || !form) return null;

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const txt = (k) => ({ value: form[k] || "", disabled: !canEdit, onChange: (e) => set({ [k]: e.target.value }) });

  const setStatus = (status) => {
    const patch = { status };
    if (status === "removed" && !form.removed_date) patch.removed_date = todayIso();
    if (status === "closed") {
      if (!form.closed_date) patch.closed_date = todayIso();
      if (!form.closed_by) patch.closed_by = user?.email;
    }
    set(patch);
  };

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["revisionDefects"] });
    qc.invalidateQueries({ queryKey: ["revisionLog", defect.id] });
  };

  const formatValue = (field, v) => {
    if (field === "status") return STATUSES[v]?.label || v;
    if (["assigned_to", "closed_by"].includes(field)) return v ? userName(users, v) : "";
    return v;
  };

  const save = async () => {
    setSaving(true);
    const { id, created_date, updated_date, created_by_id, created_by, attachments, ...data } = form;
    if (data.assigned_to && data.status === "new") data.status = "assigned";
    await base44.entities.RevisionDefect.update(defect.id, data);
    await logChanges({ user, recordType: "defect", recordId: defect.id, companyId: defect.company_id, before: defect, after: data });
    refresh();
    setSaving(false);
    onClose();
  };

  const saveAttachments = async (list, message) => {
    await base44.entities.RevisionDefect.update(defect.id, { attachments: list });
    await logChanges({ user, recordType: "defect", recordId: defect.id, companyId: defect.company_id, action: "attachment", after: message });
    set({ attachments: list });
    refresh();
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            Závada {defect.defect_number} <ClassificationBadge value={form.classification} /> <DefectStatusBadge defect={form} />
          </DialogTitle>
          <DialogDescription>
            {VTZ_TYPES[defect.vtz_type]} · Zpráva {report?.report_number} – {report?.subject}{defect.location ? ` · ${defect.location}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[65vh] overflow-y-auto space-y-5 px-1">
          <DefectTrail defect={form} users={users} />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <F label="Popis závady" className="md:col-span-3"><Textarea rows={3} {...txt("description")} /></F>
            {defect.standard_ref && <p className="md:col-span-3 text-xs text-slate-500">Norma: {defect.standard_ref}</p>}
            <F label="Klasifikace">
              <Select value={form.classification} onValueChange={(v) => set({ classification: v })} disabled={!canEdit}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(CLASSIFICATIONS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
              </Select>
            </F>
            <F label="Datum zjištění"><Input type="date" {...txt("found_date")} /></F>
            <F label="Termín odstranění"><Input type="date" {...txt("due_date")} /></F>
            <F label="Odpovědná osoba / útvar"><Input {...txt("responsible")} /></F>
            <F label="Přidělený pracovník">
              <Select value={form.assigned_to || "none"} onValueChange={(v) => set({ assigned_to: v === "none" ? "" : v })} disabled={!canEdit}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— nepřiděleno —</SelectItem>
                  {users.map((u) => <SelectItem key={u.id} value={u.email}>{u.custom_display_name || u.full_name || u.email}</SelectItem>)}
                </SelectContent>
              </Select>
            </F>
            <F label="Stav">
              <Select value={form.status} onValueChange={setStatus} disabled={!canEdit}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(STATUSES).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
              </Select>
            </F>
            <F label="Způsob odstranění / popis opravy" className="md:col-span-3"><Textarea rows={2} {...txt("removal_method")} /></F>
            <F label="Datum odstranění"><Input type="date" {...txt("removed_date")} /></F>
            <F label="Odstranil"><Input {...txt("removed_by")} /></F>
            <F label="Následnou kontrolu provedl"><Input {...txt("verified_by")} /></F>
            <F label="Datum ukončení"><Input type="date" {...txt("closed_date")} /></F>
            <F label="Ukončil / potvrdil">
              <Input disabled value={form.closed_by ? userName(users, form.closed_by) : ""} />
            </F>
            <F label="Poznámka" className="md:col-span-3"><Textarea rows={2} {...txt("note")} /></F>
          </div>

          <DefectAttachments attachments={form.attachments || []} onChange={saveAttachments} canEdit={canEdit} user={user} />
          <ChangeHistory recordId={defect.id} formatValue={formatValue} />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Zavřít</Button>
          {canEdit && (
            <Button onClick={save} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />} Uložit změny
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}