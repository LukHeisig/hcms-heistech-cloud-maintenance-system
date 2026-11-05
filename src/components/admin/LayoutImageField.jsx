import React, { useState } from "react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, Upload, Trash2 } from "lucide-react";
import PrivateImage from "@/components/PrivateImage";
import { uploadPrivateFile } from "@/lib/privateFiles";

// Výběr obrázku layoutu (podnik / linka) pro dashboard
export default function LayoutImageField({ value, onChange }) {
  const [uploading, setUploading] = useState(false);
  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    onChange(await uploadPrivateFile(file));
    setUploading(false);
    e.target.value = "";
  };
  return (
    <div className="space-y-2">
      <Label>Obrázek layoutu (dashboard)</Label>
      {value && <PrivateImage src={value} alt="Layout" className="w-full max-h-48 object-contain rounded-lg border bg-muted" />}
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" disabled={uploading} asChild>
          <label className="cursor-pointer gap-2">
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {value ? "Změnit obrázek" : "Nahrát obrázek"}
            <input type="file" accept="image/*" className="hidden" onChange={handleFile} />
          </label>
        </Button>
        {value && <Button type="button" variant="ghost" size="sm" onClick={() => onChange("")}><Trash2 className="w-4 h-4 text-destructive" /></Button>}
      </div>
    </div>
  );
}