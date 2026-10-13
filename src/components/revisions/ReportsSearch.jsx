import React, { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import ReportsTable from "@/components/revisions/ReportsTable";

// Kontextové vyhledávání v revizních zprávách (prohledává všechna textová pole)
export default function ReportsSearch({ reports, defects, onOpen }) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return reports;
    return reports.filter((r) =>
      Object.values(r).some((v) => typeof v === "string" && v.toLowerCase().includes(term))
    );
  }, [reports, q]);

  return (
    <div className="space-y-3">
      <div className="relative max-w-md">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Hledat (číslo, předmět, technik, osoba…)" className="pl-9" />
      </div>
      {q && <p className="text-xs text-muted-foreground">Nalezeno: {filtered.length} z {reports.length}</p>}
      <ReportsTable reports={filtered} defects={defects} onOpen={onOpen} />
    </div>
  );
}