
import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  Droplet,
  Clock,
  AlertTriangle,
  CheckCircle,
  Image as ImageIcon,
  FileText,
  Loader2,
  ClipboardCheck,
  ChevronRight
} from "lucide-react";
import { format } from "date-fns";
import { cs } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function Machine() {
  const navigate = useNavigate();
  const urlParams = new URLSearchParams(window.location.search);
  const machineId = urlParams.get("id");

  const { data: machine } = useQuery({
    queryKey: ["machine", machineId],
    queryFn: async () => {
      const machines = await base44.entities.Machine.list();
      return machines.find(m => m.id === machineId);
    },
    enabled: !!machineId,
  });

  const { data: line } = useQuery({
    queryKey: ["line", machine?.line_id],
    queryFn: async () => {
      if (!machine?.line_id) return null;
      const lines = await base44.entities.Line.list();
      return lines.find(l => l.id === machine.line_id);
    },
    enabled: !!machine?.line_id,
  });

  const { data: controlPoints = [] } = useQuery({
    queryKey: ["controlPoints", machineId],
    queryFn: () => base44.entities.ControlPoint.filter({ machine_id: machineId }),
    enabled: !!machineId,
  });

  const { data: records = [] } = useQuery({
    queryKey: ["records", machineId],
    queryFn: async () => {
      const allRecords = await base44.entities.ControlRecord.list("-performed_at");
      return allRecords.filter(record =>
        controlPoints.some(point => point.id === record.control_point_id)
      );
    },
    enabled: !!machineId && controlPoints.length > 0,
  });

  const { data: issues = [] } = useQuery({
    queryKey: ["issues"],
    queryFn: async () => {
      const allIssues = await base44.entities.Issue.filter({ status: "reported" });
      return allIssues.filter(issue =>
        controlPoints.some(point => point.id === issue.control_point_id)
      );
    },
    enabled: controlPoints.length > 0,
  });

  const { data: documentation = [] } = useQuery({
    queryKey: ["documentation", machineId],
    queryFn: () => base44.entities.Documentation.filter({ machine_id: machineId }),
    enabled: !!machineId,
  });

  const getPointStatus = (point) => {
    const pointRecords = records.filter((r) => r.control_point_id === point.id);
    if (pointRecords.length === 0) return "overdue";

    const latestRecord = pointRecords[0];
    const lastPerformed = new Date(latestRecord.performed_at);
    const now = new Date();
    const hoursSince = (now - lastPerformed) / (1000 * 60 * 60);

    return hoursSince > (point.interval_hours || 0) ? "overdue" : "ok";
  };

  const getNextControlDate = (point) => {
    const pointRecords = records.filter(r => r.control_point_id === point.id);
    if (pointRecords.length === 0 || !point.interval_hours) return null;

    const latestRecord = pointRecords[0];
    const lastPerformed = new Date(latestRecord.performed_at);
    const nextDate = new Date(lastPerformed.getTime() + point.interval_hours * 60 * 60 * 1000);
    return nextDate;
  };

  const lubricationPoints = controlPoints.filter(p => p.type === "lubrication");
  const inspectionPoints = controlPoints.filter(p => p.type === "inspection");
  const lubricatorPoints = controlPoints.filter(p => p.type === "auto_lubricator");

  if (!machine) {
    return (
      <div className="p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
          </div>
        </div>
      </div>
    );
  }

  const renderPointsList = (points, type) => {
    if (points.length === 0) {
      return (
        <Card>
          <CardContent className="p-12 text-center">
            <Droplet className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500">
              {type === "lubrication" ? "Nejsou definovány žádné mazací body" :
               type === "inspection" ? "Nejsou definovány žádné inspekční body" :
               "Nejsou definovány žádné automatické maznice"}
            </p>
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="space-y-2">
        {points.map((point) => {
          const status = getPointStatus(point);
          const pointRecords = records.filter(r => r.control_point_id === point.id);
          const pointIssues = issues.filter(i => i.control_point_id === point.id && i.status === "reported");
          const nextDate = getNextControlDate(point);

          return (
            <Card
              key={point.id}
              className={`cursor-pointer transition-all hover:shadow-md border-l-4 ${
                status === "overdue" ? "border-l-yellow-500 bg-yellow-50/50" :
                "border-l-green-500 bg-green-50/50"
              }`}
              onClick={() => navigate(createPageUrl(`ControlPoint?id=${point.id}`))}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 flex-1">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      status === "overdue" ? "bg-yellow-100" : "bg-green-100"
                    }`}>
                      {type === "lubrication" ? (
                        <Droplet className={`w-5 h-5 ${status === "overdue" ? "text-yellow-700" : "text-green-700"}`} />
                      ) : type === "inspection" ? (
                        <ClipboardCheck className={`w-5 h-5 ${status === "overdue" ? "text-yellow-700" : "text-green-700"}`} />
                      ) : (
                        <Droplet className={`w-5 h-5 ${status === "overdue" ? "text-yellow-700" : "text-green-700"}`} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold text-slate-900 text-base">
                          {point.number && `${point.number} - `}{point.name}
                        </h3>
                        {status === "overdue" && (
                          <Badge variant="outline" className="gap-1 bg-yellow-100 text-yellow-800 border-yellow-300">
                            <Clock className="w-3 h-3" />
                            Po termínu
                          </Badge>
                        )}
                        {pointIssues.length > 0 && (
                          <Badge className="bg-orange-500 gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            {pointIssues.length}
                          </Badge>
                        )}
                      </div>
                      <div className="flex flex-col gap-1 text-sm text-slate-600">
                        <div className="flex items-center gap-4 flex-wrap">
                          {point.interval_hours && (
                            <span>Interval: {point.interval_hours}h</span>
                          )}
                          {pointRecords.length > 0 && (
                            <>
                              <span className="hidden sm:inline">·</span>
                              <span>
                                Poslední: {format(new Date(pointRecords[0].performed_at), "d.M. HH:mm", { locale: cs })}
                              </span>
                            </>
                          )}
                        </div>
                        {nextDate && (
                          <span className={status === "overdue" ? "text-yellow-700 font-medium" : "text-slate-600"}>
                            Následující: {format(nextDate, "d.M. yyyy", { locale: cs })}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${
                      status === "overdue" ? "bg-yellow-500" : "bg-green-500"
                    }`} />
                    <ChevronRight className="w-5 h-5 text-slate-400" />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  };

  return (
    <div className="p-4 md:p-8 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate(createPageUrl(`Lines?line=${machine.line_id}`))}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Zpět na {line?.name}
          </Button>
          <h1 className="text-3xl font-bold text-slate-900">{machine.name}</h1>
          <p className="text-slate-600 mt-1">{controlPoints.length} kontrolních bodů</p>
        </div>

        <Tabs defaultValue="lubrication" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 bg-white shadow-sm">
            <TabsTrigger value="lubrication" className="gap-2">
              <Droplet className="w-4 h-4" />
              Mazání ({lubricationPoints.length})
            </TabsTrigger>
            <TabsTrigger value="inspection" className="gap-2">
              <CheckCircle className="w-4 h-4" />
              Inspekce ({inspectionPoints.length})
            </TabsTrigger>
            <TabsTrigger value="lubricators" className="gap-2">
              <Droplet className="w-4 h-4" />
              Maznice ({lubricatorPoints.length})
            </TabsTrigger>
            <TabsTrigger value="docs" className="gap-2">
              <ImageIcon className="w-4 h-4" />
              Dokumenty ({documentation.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="lubrication">
            {renderPointsList(lubricationPoints, "lubrication")}
          </TabsContent>

          <TabsContent value="inspection">
            {renderPointsList(inspectionPoints, "inspection")}
          </TabsContent>

          <TabsContent value="lubricators">
            {renderPointsList(lubricatorPoints, "lubricator")}
          </TabsContent>

          <TabsContent value="docs">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Fotodokumentace a schémata
                </CardTitle>
              </CardHeader>
              <CardContent>
                {documentation.length === 0 ? (
                  <div className="text-center py-12">
                    <ImageIcon className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                    <p className="text-slate-500">Zatím nebyla přidána žádná dokumentace</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {documentation.map((doc) => (
                      <a
                        key={doc.id}
                        href={doc.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group"
                      >
                        <div className="aspect-square rounded-lg overflow-hidden border-2 border-slate-200 group-hover:border-slate-400 transition-colors">
                          <img
                            src={doc.file_url}
                            alt={doc.file_name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <p className="text-sm text-slate-600 mt-2 truncate">{doc.file_name}</p>
                      </a>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
