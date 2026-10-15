import React from "react";
import { useFileUrl } from "@/lib/privateFiles";

// Zobrazí obrázek (nebo iframe) ze soukromého i staršího veřejného úložiště
export default function PrivateImage({ src, alt = "", as: Tag = "img", ...props }) {
  const url = useFileUrl(src);
  if (!url) return <div className={`${props.className || ""} bg-muted animate-pulse`} />;
  return Tag === "img" ? <img src={url} alt={alt} {...props} /> : <Tag src={url} {...props} />;
}