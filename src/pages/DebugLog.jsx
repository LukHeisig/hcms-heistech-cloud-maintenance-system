import React, { useState, useEffect } from "react";
import { useDebug } from "@/components/DebugContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trash2, Filter, Download, Terminal, Smartphone, History } from "lucide-react";
import { format } from "date-fns";
import { base44 } from "@/api/base44Client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery } from "@tanstack/react-query";

export default function DebugLog() {
  const { clearLogs } = useDebug(); // We don't use local logs anymore for the main view
  const [filter, setFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [user, setUser] = useState(null);

  // Fetch System Logs from DB
  const { data: remoteLogs = [], refetch: refetchLogs } = useQuery({
    queryKey: ['systemLogs'],
    queryFn: () => base44.entities.SystemLog.list({ sort: { timestamp: -1 }, limit: 1000 }),
    enabled: !!user && user.user_type === "superAdmin",
    refetchInterval: 5000
  });

  useEffect(() => {
    base44.auth.me().then(setUser);
  }, []);

  const filteredLogs = remoteLogs.filter(log => {
    const search = filter.toLowerCase();
    const matchesText = 
      log.message?.toLowerCase().includes(search) ||
      log.created_by?.toLowerCase().includes(search) ||
      log.device_info?.toLowerCase().includes(search);
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

  const [nfcFilter, setNfcFilter] = useState("");
  const { data: nfcLogs = [] } = useQuery({
    queryKey: ['nfcLogs'],
    queryFn: () => base44.entities.NfcLog.list({ sort: { scanned_at: -1 }, limit: 2000 }),
    enabled: !!user && user.user_type === "superAdmin",
    refetchInterval: 5000
  });

  const filteredNfcLogs = nfcLogs.filter(log => {
    if (!nfcFilter) return true;
    const search = nfcFilter.toLowerCase();
    return (
      log.chip_id?.toLowerCase().includes(search) ||
      log.scanned_by?.toLowerCase().includes(search) ||
      log.log_content?.toLowerCase().includes(search) ||
      log.result?.toLowerCase().includes(search)
    );
  });

  if (!user || user.user_type !== "superAdmin") {
    return (
      <div className="p-8 text-center text-slate-500">
        Nemáte oprávnění pro zobrazení této stránky.
      </div>
    );
  }

  const handleExport = () => {
    const content = remoteLogs.map(l => `[${l.timestamp}] [${l.created_by}] [${l.type.toUpperCase()}] ${l.message}`).join('\n');
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
            Záznam výstupu konzole a historie NFC skenování
          </p>
        </div>
      </div>

      <Tabs defaultValue="console">
        <TabsList>
          <TabsTrigger value="console">Centrální Konzole (Všichni)</TabsTrigger>
          <TabsTrigger value="nfc">Historie NFC (Server)</TabsTrigger>
        </TabsList>

        <TabsContent value="console">
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
                  <Button variant="outline" onClick={handleExport} className="gap-2">
                    <Download className="w-4 h-4" />
                    Export
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
                      <div key={log.id} className="flex flex-col gap-1 border-b border-slate-800 pb-2 mb-2 last:border-0 hover:bg-slate-800/50 p-2 rounded transition-colors">
                        <div className="flex gap-2 items-center text-xs text-slate-500">
                           <span>{format(new Date(log.timestamp), "d.M. HH:mm:ss")}</span>
                           <span className="text-slate-400">|</span>
                           <span className="text-cyan-400 font-bold">{log.created_by}</span>
                           <span className="text-slate-400">|</span>
                           <span className="truncate max-w-[200px]" title={log.device_info}>{log.device_info}</span>
                        </div>
                        <div className="flex gap-2 items-start">
                          <span className={`uppercase font-bold text-xs w-12 shrink-0 select-none pt-0.5 ${
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
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="nfc">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <CardTitle>Historie skenování NFC</CardTitle>
                <div className="relative w-full md:w-64">
                  <Filter className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                  <Input 
                    placeholder="Hledat (čip, email, log)..." 
                    value={nfcFilter}
                    onChange={(e) => setNfcFilter(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {filteredNfcLogs.length === 0 ? (
                  <div className="text-center py-10 text-slate-500">Zatím žádné záznamy</div>
                ) : (
                  filteredNfcLogs.map(log => (
                    <div key={log.id} className="border rounded-lg p-4 hover:bg-slate-50">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <span className={`inline-block px-2 py-1 rounded text-xs font-bold mr-2 ${
                            log.result === 'success' ? 'bg-green-100 text-green-800' :
                            log.result === 'not_found' ? 'bg-orange-100 text-orange-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {log.result?.toUpperCase()}
                          </span>
                          <span className="font-mono font-bold text-slate-700">{log.chip_id}</span>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-medium">{log.scanned_by}</div>
                          <div className="text-xs text-slate-500">
                            {format(new Date(log.scanned_at), "d.M.yyyy HH:mm:ss")}
                          </div>
                        </div>
                      </div>
                      <div className="bg-slate-100 p-2 rounded text-xs font-mono whitespace-pre-wrap text-slate-700">
                        {log.log_content}
                      </div>
                      <div className="mt-2 text-xs text-slate-400 truncate">
                        {log.device_info}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}