import React, { useState, useEffect, useRef } from "react";
import { RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function UpdateBanner() {
  const [showBanner, setShowBanner] = useState(false);
  const initialEtagRef = useRef(null);

  const checkForUpdate = async () => {
    try {
      const res = await fetch("/index.html", { method: "HEAD", cache: "no-store" });
      const etag = res.headers.get("etag") || res.headers.get("last-modified");

      if (!etag) return;

      if (initialEtagRef.current === null) {
        initialEtagRef.current = etag;
      } else if (initialEtagRef.current !== etag) {
        setShowBanner(true);
      }
    } catch {
      // Ignoruj chyby sítě
    }
  };

  useEffect(() => {
    checkForUpdate();
    const interval = setInterval(checkForUpdate, 10 * 60 * 1000); // 10 minut
    return () => clearInterval(interval);
  }, []);

  if (!showBanner) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] flex items-center justify-between gap-4 px-4 py-2.5 text-white text-sm font-medium shadow-lg"
      style={{ background: "linear-gradient(135deg, #2150D8 0%, #1a40b0 100%)" }}
    >
      <div className="flex items-center gap-2">
        <RefreshCw className="w-4 h-4 animate-spin" />
        <span>Je k dispozici nová verze aplikace.</span>
      </div>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs border-white/50 text-white hover:bg-white/20 hover:text-white bg-transparent"
          onClick={() => window.location.reload()}
        >
          <RefreshCw className="w-3 h-3 mr-1.5" />
          Aktualizovat
        </Button>
        <button
          onClick={() => setShowBanner(false)}
          className="p-1 rounded hover:bg-white/20 transition-colors"
          aria-label="Zavřít"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}