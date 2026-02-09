import React, { useState, useEffect } from "react";
import { useDebug } from "@/components/DebugContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trash2, Filter, Download, Terminal } from "lucide-react";
import { format } from "date-fns";
import { base44 } from "@/api/base44Client";

export default function DebugLog() {
  const { logs, clearLogs } = useDebug();
  const [filter, setFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [user, setUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setUser);
  }, []);

  if (!user || user.user_type !== "superAdmin") {
    return (
      <div className="p-8 text-center text-slate-500">
        Nemáte oprávnění pro zobrazení této stránky.
      </div>
    );
  }

  const filteredLogs = logs.filter(log => {
    const matchesText = log.message.toLowerCase().includes(filter.toLowerCase());
    const matchesType = typeFilter === "all" || log.type === typeFilter;
    return matchesText && matchesType;
  });

  const getLogColor = (type) => {
    switch (type) {
      case 'error': return 'text-red-500 bg-red-50 border-red-100';
      case 'warn': return 'text-orange-500 bg-orange-50 border-orange-100';
      case 'info': return 'text-blue-500 bg-blue-50 border-blue-100';
      default: return 'text-slate-600 bg-white border-slate-100';
    }
  };

  const handleExport = () => {
    const content = logs.map(l => `[${l.timestamp}] [${l.type.toUpperCase()}] ${l.message}`).join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `console-log-${new Date().toISOString()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
            <Terminal className="w-8 h-8 text-slate-700" />
            Log ladění
          </h1>
          <p className="text-slate-500 mt-1">
            Záznam výstupu konzole pro diagnostiku chyb
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport} className="gap-2">
            <Download className="w-4 h-4" />
            Exportovat
          </Button>
          <Button variant="destructive" onClick={clearLogs} className="gap-2">
            <Trash2 className="w-4 h-4" />
            Vymazat
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Filter className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
              <Input 
                placeholder="Hledat v lozích..." 
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex gap-2">
              <Button 
                variant={typeFilter === "all" ? "default" : "outline"}
                onClick={() => setTypeFilter("all")}
                size="sm"
              >
                Vše
              </Button>
              <Button 
                variant={typeFilter === "error" ? "destructive" : "outline"}
                onClick={() => setTypeFilter("error")}
                size="sm"
                className={typeFilter === "error" ? "" : "text-red-600 hover:text-red-700 hover:bg-red-50"}
              >
                Chyby
              </Button>
              <Button 
                variant={typeFilter === "warn" ? "secondary" : "outline"}
                onClick={() => setTypeFilter("warn")}
                size="sm"
                className={typeFilter === "warn" ? "bg-orange-100 text-orange-800" : "text-orange-600 hover:text-orange-700 hover:bg-orange-50"}
              >
                Varování
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="bg-slate-900 rounded-lg p-4 h-[600px] overflow-auto font-mono text-sm shadow-inner custom-scrollbar">
            {filteredLogs.length === 0 ? (
              <div className="text-slate-500 text-center py-20 italic">
                Žádné záznamy k zobrazení
              </div>
            ) : (
              <div className="space-y-1">
                {filteredLogs.map((log) => (
                  <div key={log.id} className="flex gap-2 items-start hover:bg-slate-800/50 p-1 rounded transition-colors">
                    <span className="text-slate-500 shrink-0 select-none">
                      {format(new Date(log.timestamp), "HH:mm:ss.SSS")}
                    </span>
                    <span className={`uppercase font-bold text-xs w-16 shrink-0 select-none ${
                      log.type === 'error' ? 'text-red-400' :
                      log.type === 'warn' ? 'text-orange-400' :
                      log.type === 'info' ? 'text-blue-400' :
                      'text-green-400'
                    }`}>
                      [{log.type}]
                    </span>
                    <span className={`break-all whitespace-pre-wrap ${
                      log.type === 'error' ? 'text-red-300' :
                      log.type === 'warn' ? 'text-orange-300' :
                      'text-slate-300'
                    }`}>
                      {log.message}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="text-right text-xs text-slate-400 mt-2">
            Zobrazeno {filteredLogs.length} z {logs.length} záznamů
          </div>
        </CardContent>
      </Card>
    </div>
  );
}