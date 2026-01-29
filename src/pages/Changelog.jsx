import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { cs } from "date-fns/locale";
import { Sparkles, Wrench, Zap, Megaphone, Calendar } from "lucide-react";
import ReactMarkdown from "react-markdown";

export default function ChangelogPage() {
  const { data: changelogs = [], isLoading } = useQuery({
    queryKey: ["changelogs"],
    queryFn: () => base44.entities.Changelog.list("-release_date", 100),
  });

  const getTypeIcon = (type) => {
    switch (type) {
      case "feature": return <Sparkles className="w-5 h-5 text-purple-500" />;
      case "fix": return <Wrench className="w-5 h-5 text-red-500" />;
      case "improvement": return <Zap className="w-5 h-5 text-blue-500" />;
      case "announcement": return <Megaphone className="w-5 h-5 text-orange-500" />;
      default: return <Sparkles className="w-5 h-5 text-gray-500" />;
    }
  };

  const getTypeLabel = (type) => {
    switch (type) {
      case "feature": return "Nová funkce";
      case "fix": return "Oprava chyby";
      case "improvement": return "Vylepšení";
      case "announcement": return "Oznámení";
      default: return type;
    }
  };

  const getTypeColor = (type) => {
    switch (type) {
      case "feature": return "bg-purple-100 text-purple-800 border-purple-200";
      case "fix": return "bg-red-100 text-red-800 border-red-200";
      case "improvement": return "bg-blue-100 text-blue-800 border-blue-200";
      case "announcement": return "bg-orange-100 text-orange-800 border-orange-200";
      default: return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <div className="text-center space-y-4 mb-12">
        <h1 className="text-4xl font-bold tracking-tight text-slate-900">Novinky a aktualizace</h1>
        <p className="text-lg text-slate-600">Sledujte, co je nového v aplikaci HCMS</p>
      </div>

      {isLoading ? (
        <div className="space-y-6">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48 w-full rounded-xl" />
          ))}
        </div>
      ) : changelogs.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-slate-200 shadow-sm">
          <Sparkles className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-900">Zatím žádné novinky</h3>
          <p className="text-slate-500">Brzy se zde objeví první aktualizace.</p>
        </div>
      ) : (
        <div className="relative border-l-2 border-slate-200 ml-4 space-y-12">
          {changelogs.map((log) => (
            <div key={log.id} className="relative pl-8">
              {/* Timeline dot */}
              <div className={`absolute -left-[9px] top-6 w-4 h-4 rounded-full border-2 border-white shadow-sm ${
                log.type === 'feature' ? 'bg-purple-500' : 
                log.type === 'fix' ? 'bg-red-500' :
                log.type === 'announcement' ? 'bg-orange-500' : 'bg-blue-500'
              }`} />
              
              <Card className="hover:shadow-md transition-shadow duration-200 border-slate-200/60 overflow-hidden">
                <CardHeader className="bg-slate-50/50 pb-4 border-b border-slate-100">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-3 flex-wrap">
                        <Badge variant="outline" className={`${getTypeColor(log.type)} border px-3 py-1 flex items-center gap-2`}>
                          {getTypeIcon(log.type)}
                          {getTypeLabel(log.type)}
                        </Badge>
                        <span className="text-sm text-slate-500 flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          {format(new Date(log.release_date), "d. MMMM yyyy", { locale: cs })}
                        </span>
                        {log.version && (
                          <Badge variant="secondary" className="bg-slate-100 text-slate-600">
                            v{log.version}
                          </Badge>
                        )}
                      </div>
                      <CardTitle className="text-xl pt-2">{log.title}</CardTitle>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-6 text-slate-600 prose prose-slate max-w-none prose-p:leading-relaxed prose-headings:text-slate-800 prose-a:text-blue-600 hover:prose-a:text-blue-700">
                  <ReactMarkdown>{log.description}</ReactMarkdown>
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}