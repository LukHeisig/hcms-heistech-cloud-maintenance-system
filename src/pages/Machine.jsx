import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
  MessageSquare,
  Plus,
  FileText
} from "lucide-react";
import { format } from "date-fns";
import { cs } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function Machine() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
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
    queryKey: ["records"],
    queryFn: () => base44.entities.ControlRecord.list("-performed_at"),
  });

  const { data: issues = [] } = useQuery({
    queryKey: ["issues"],
    queryFn: () => base44.entities.Issue.list(),
  });

  const { data: documentation = [] } = useQuery({
    queryKey: ["documentation", machineId],
    queryFn: () => base44.entities.Documentation.filter({ machine_id: machineId }),
    enabled: !!machineId,
  });

  const recordMutation = useMutation({
    mutationFn: (data) => base44.entities.ControlRecord.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["records"] });
    },
  });

  const getPointStatus = (point) => {
    const pointRecords = records.filter((r) => r.control_point_id === point.id);
    if (pointRecords.length === 0) return "overdue";

    const latestRecord = pointRecords[0];
    const lastPerformed = new Date(latestRecord.performed_at);
    const now = new Date();
    const hoursSince = (now - lastPerformed) / (1000 * 60 * 60);

    return hoursSince > point.interval_hours ? "overdue" : "ok";
  };

  const handleConfirmRecord = async (pointId, recordType) => {
    await recordMutation.mutateAsync({
      control_point_id: pointId,
      record_type: recordType,
      performed_at: new Date().toISOString(),
    });
  };

  const lubricationPoints = controlPoints.filter(p => p.type === "lubrication");
  const inspectionPoints = controlPoints.filter(p => p.type === "inspection");
  const lubricatorPoints = controlPoints.filter(p => p.type === "auto_lubricator");

  if (!machine) {
    return (
      <div className="p-8">
        <div className="max-w-7xl mx-auto">
          <p className="text-center text-slate-500">Načítání...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
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

        {/* Tabs */}
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

          {/* Mazací body */}
          <TabsContent value="lubrication">
            <div className="grid gap-4">
              {lubricationPoints.map((point) => {
                const status = getPointStatus(point);
                const pointRecords = records.filter(r => r.control_point_id === point.id);
                const pointIssues = issues.filter(i => i.control_point_id === point.id && i.status === "reported");

                return (
                  <Card key={point.id} className={`border-2 ${
                    pointIssues.length > 0 ? "border-orange-300 bg-orange-50" :
                    status === "overdue" ? "border-red-300 bg-red-50" :
                    "border-green-300 bg-green-50"
                  }`}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="flex items-center gap-3">
                            {point.number} {point.name}
                            {status === "overdue" && (
                              <Badge variant="destructive" className="gap-1">
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
                          </CardTitle>
                          {point.description && (
                            <p className="text-sm text-slate-600 mt-2">{point.description}</p>
                          )}
                        </div>
                        <div className={`w-4 h-4 rounded-full ${
                          pointIssues.length > 0 ? "bg-orange-500" :
                          status === "overdue" ? "bg-red-500" : "bg-green-500"
                        }`} />
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid md:grid-cols-2 gap-4 mb-4">
                        <div>
                          <p className="text-sm text-slate-600 mb-1">Mazivo</p>
                          <p className="font-semibold">{point.lubricant_type || "-"}</p>
                        </div>
                        <div>
                          <p className="text-sm text-slate-600 mb-1">Množství</p>
                          <p className="font-semibold">{point.lubricant_amount ? `${point.lubricant_amount} g` : "-"}</p>
                        </div>
                        <div>
                          <p className="text-sm text-slate-600 mb-1">Interval</p>
                          <p className="font-semibold">{point.interval_hours ? `${point.interval_hours} h` : "-"}</p>
                        </div>
                        <div>
                          <p className="text-sm text-slate-600 mb-1">Poslední mazání</p>
                          <p className="font-semibold">
                            {pointRecords.length > 0
                              ? format(new Date(pointRecords[0].performed_at), "d. M. yyyy HH:mm", { locale: cs })
                              : "-"}
                          </p>
                        </div>
                      </div>

                      <Button
                        onClick={() => handleConfirmRecord(point.id, "lubrication")}
                        className="w-full bg-green-600 hover:bg-green-700"
                      >
                        <Droplet className="w-4 h-4 mr-2" />
                        Potvrdit mazání
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          {/* Inspekční body */}
          <TabsContent value="inspection">
            <div className="grid gap-4">
              {inspectionPoints.map((point) => {
                const status = getPointStatus(point);
                const pointRecords = records.filter(r => r.control_point_id === point.id);

                return (
                  <Card key={point.id} className={`border-2 ${
                    status === "overdue" ? "border-red-300 bg-red-50" : "border-green-300 bg-green-50"
                  }`}>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-3">
                        {point.number} {point.name}
                        {status === "overdue" && (
                          <Badge variant="destructive" className="gap-1">
                            <Clock className="w-3 h-3" />
                            Po termínu
                          </Badge>
                        )}
                      </CardTitle>
                      {point.inspection_tasks && (
                        <p className="text-sm text-slate-600 mt-2">{point.inspection_tasks}</p>
                      )}
                    </CardHeader>
                    <CardContent>
                      <div className="grid md:grid-cols-2 gap-4 mb-4">
                        <div>
                          <p className="text-sm text-slate-600 mb-1">Interval</p>
                          <p className="font-semibold">{point.interval_hours ? `${point.interval_hours} h` : "-"}</p>
                        </div>
                        <div>
                          <p className="text-sm text-slate-600 mb-1">Poslední kontrola</p>
                          <p className="font-semibold">
                            {pointRecords.length > 0
                              ? format(new Date(pointRecords[0].performed_at), "d. M. yyyy HH:mm", { locale: cs })
                              : "-"}
                          </p>
                        </div>
                      </div>

                      <Button
                        onClick={() => handleConfirmRecord(point.id, "inspection")}
                        className="w-full bg-purple-600 hover:bg-purple-700"
                      >
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Potvrdit inspekci
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          {/* Automatické maznice */}
          <TabsContent value="lubricators">
            <div className="grid gap-4">
              {lubricatorPoints.map((point) => {
                const pointRecords = records.filter(r => r.control_point_id === point.id);

                return (
                  <Card key={point.id} className="border-2 border-blue-300 bg-blue-50">
                    <CardHeader>
                      <CardTitle>{point.number} {point.name}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid md:grid-cols-2 gap-4 mb-4">
                        <div>
                          <p className="text-sm text-slate-600 mb-1">Poslední výměna</p>
                          <p className="font-semibold">
                            {pointRecords.length > 0
                              ? format(new Date(pointRecords[0].performed_at), "d. M. yyyy", { locale: cs })
                              : "-"}
                          </p>
                        </div>
                      </div>

                      <Button
                        onClick={() => handleConfirmRecord(point.id, "lubricator_change")}
                        className="w-full bg-blue-600 hover:bg-blue-700"
                      >
                        <Droplet className="w-4 h-4 mr-2" />
                        Potvrdit výměnu maznice
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          {/* Dokumentace */}
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