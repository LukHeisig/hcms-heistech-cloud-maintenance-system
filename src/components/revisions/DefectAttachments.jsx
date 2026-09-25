import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Paperclip, Loader2, Trash2, Upload } from "lucide-react";
import { ATTACHMENT_KINDS } from "./revisionConstants";

export default function DefectAttachments({ attachments = [], onChange, canEdit, canAdd = canEdit, user }) {
  const [kind, setKind] = useState("photo_before");
  const [uploading, setUploading] = useState(false);

  const upload = async (files) => {
    if (!files?.length) return;
    setUploading(true);
    const added = [];
    for (const file of files) {
      const { file_url } = await base44.integrations.Core.UploadPublicFile({ file });
      added.push({ url: file_url, name: file.name, kind, uploaded_by: user?.email, uploaded_at: new Date().toISOString() });
    }
    await onChange([...attachments, ...added], `Přidáno: ${added.map((a) => `${ATTACHMENT_KINDS[kind]} – ${a.name}`).join(", ")}`);
    setUploading(false);
  };

  const remove = (i) => onChange(attachments.filter((_, idx) => idx !== i), `Odebráno: ${attachments[i].name}`);

  return (
    <div>
      <h3 className="font-semibold text-sm flex items-center gap-2 mb-2"><Paperclip className="w-4 h-4" /> Dokumentace a přílohy</h3>
      <div className="space-y-1 mb-2">
        {attachments.length === 0 && <p className="text-xs text-slate-500">Žádné přílohy.</p>}
        {attachments.map((a, i) => (
          <div key={i} className="flex items-center justify-between gap-2 text-sm border rounded p-2 bg-white">
            <a href={a.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 min-w-0 hover:underline">
              {/\.(png|jpe?g|webp|gif)$/i.test(a.name) && <img src={a.url} alt="" className="w-10 h-10 object-cover rounded" />}
              <span className="min-w-0">
                <span className="block text-xs text-slate-500">{ATTACHMENT_KINDS[a.kind] || "Příloha"}</span>
                <span className="block truncate">{a.name}</span>
              </span>
            </a>
            {canEdit && <Button variant="ghost" size="icon" onClick={() => remove(i)}><Trash2 className="w-4 h-4 text-red-600" /></Button>}
          </div>
        ))}
      </div>
      {canAdd && (
        <div className="flex gap-2">
          <Select value={kind} onValueChange={setKind}>
            <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
            <SelectContent>{Object.entries(ATTACHMENT_KINDS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
          </Select>
          <Button variant="outline" asChild disabled={uploading}>
            <label className="cursor-pointer gap-2">
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} Nahrát
              <input type="file" multiple className="hidden" onChange={(e) => upload(Array.from(e.target.files || []))} />
            </label>
          </Button>
        </div>
      )}
    </div>
  );
}