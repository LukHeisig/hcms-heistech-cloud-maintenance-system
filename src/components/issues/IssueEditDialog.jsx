import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Loader2, Pencil, X } from "lucide-react";

export default function IssueEditDialog({ open, onOpenChange, issue, onSave, isSaving }) {
  const [description, setDescription] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (open && issue) {
      setDescription(issue.description || "");
      setPhotoUrl(issue.photo_url || "");
    }
  }, [open, issue]);

  const handlePhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadPublicFile({ file });
    setPhotoUrl(file_url);
    setUploading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Pencil className="w-5 h-5" />Upravit závadu</DialogTitle>
          <DialogDescription>Změny se projeví ve všech přehledech závad.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label htmlFor="edit_desc">Popis závady</Label>
            <Textarea id="edit_desc" rows={5} value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label>Fotografie</Label>
            {photoUrl ? (
              <div className="relative inline-block mt-1">
                <img src={photoUrl} alt="Fotografie závady" className="w-32 h-32 object-cover rounded-lg border" />
                <button type="button" onClick={() => setPhotoUrl("")} className="absolute -top-2 -right-2 bg-white border rounded-full p-1 shadow">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <Input type="file" accept="image/*" onChange={handlePhoto} disabled={uploading} className="mt-1" />
            )}
            {uploading && <p className="text-xs text-slate-500 mt-1">Nahrávám...</p>}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>Zrušit</Button>
          <Button onClick={() => onSave({ description: description.trim(), photo_url: photoUrl || null })} disabled={isSaving || uploading || !description.trim()}>
            {isSaving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Ukládám...</> : "Uložit změny"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}