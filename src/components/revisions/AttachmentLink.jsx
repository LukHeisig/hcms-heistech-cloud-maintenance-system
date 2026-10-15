import React from "react";
import { openFile } from "@/lib/privateFiles";
import PrivateImage from "@/components/PrivateImage";
import { ATTACHMENT_KINDS } from "./revisionConstants";

export default function AttachmentLink({ a }) {
  return (
    <button type="button" onClick={() => openFile(a.url)} className="flex items-center gap-2 min-w-0 hover:underline text-left">
      {/\.(png|jpe?g|webp|gif)$/i.test(a.name) && <PrivateImage src={a.url} className="w-10 h-10 object-cover rounded" />}
      <span className="min-w-0">
        <span className="block text-xs text-slate-500">{ATTACHMENT_KINDS[a.kind] || "Příloha"}</span>
        <span className="block truncate">{a.name}</span>
      </span>
    </button>
  );
}