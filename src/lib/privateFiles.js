import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";

// Soubory se ukládají do soukromého úložiště; v záznamu je uložené file_uri.
// Starší soubory mají veřejné https URL – ty se používají beze změny.
const cache = new Map();
const isPublic = (v) => /^(https?:|data:|blob:)/.test(v || "");

export async function uploadPrivateFile(file) {
  const { file_uri } = await base44.integrations.Core.UploadPrivateFile({ file });
  return file_uri;
}

export async function resolveFileUrl(value) {
  if (!value || isPublic(value)) return value;
  const hit = cache.get(value);
  if (hit && hit.expires > Date.now()) return hit.url;
  const { signed_url } = await base44.integrations.Core.CreateFileSignedUrl({ file_uri: value, expires_in: 3600 });
  cache.set(value, { url: signed_url, expires: Date.now() + 50 * 60 * 1000 });
  return signed_url;
}

export async function openFile(value) {
  if (!value) return;
  const win = window.open("", "_blank");
  const url = await resolveFileUrl(value);
  if (win) win.location.href = url; else window.open(url, "_blank");
}

export function useFileUrl(value) {
  const [url, setUrl] = useState(isPublic(value) ? value : null);
  useEffect(() => {
    let alive = true;
    if (isPublic(value) || !value) { setUrl(value || null); return; }
    resolveFileUrl(value).then((u) => alive && setUrl(u));
    return () => { alive = false; };
  }, [value]);
  return url;
}