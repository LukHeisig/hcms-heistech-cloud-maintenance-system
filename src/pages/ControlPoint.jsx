
import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Droplet,
  Clock,
  AlertTriangle,
  CheckCircle,
  Loader2,
  ClipboardCheck,
  Calendar as CalendarIcon
} from "lucide-react";
import { format } from "date-fns";
import { cs } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function ControlPoint() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const urlParams = new URLSearchParams(window.location.search);
  const pointId = urlParams.get("id");
  const [isProcessing, setIsProcessing] = useState(false);

  const { data: point } = useQuery({
    queryKey: ["controlPoint", pointId],
    queryFn: async () => {
      const points = await base44.entities.ControlPoint.list();
      return points.find((p) => p.id === pointId);
    },
    enabled: !!pointId,
  });

  const { data: machine } = useQuery({
    queryKey: ["machine", point?.machine_id],
    queryFn: async () => {
      if (!point?.machine_id) return null;
      const machines = await base44.entities.Machine.list();
      return machines.find((m) => m.id === point.machine_id);
    },
    enabled: !!point?.machine_id,
  });

  const { data: records = [] } = useQuery({
    queryKey: ["records", pointId],
    queryFn: () =>
      base44.entities.ControlRecord.filter(
        { control_point_id: pointId },
        "-performed_at"
      ),
    enabled: !!pointId,
  });

  const { data: issues = [] } = useQuery({
    queryKey: ["issues", pointId],
    queryFn: () =>
      base44.entities.Issue.filter({ control_point_id: pointId }),
    enabled: !!pointId,
  });

  const recordMutation = useMutation({
    mutationFn: (data) => base44.entities.ControlRecord.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["records"] });
      setIsProcessing(false);
    },
    onError: () => {
      setIsProcessing(false);
    },
  });

  const getPointStatus = () => {
    if (records.length === 0) return "overdue";

    const latestRecord = records[0];
    const lastPerformed = new Date(latestRecord.performed_at);
    const now = new Date();
    const hoursSince = (now - lastPerformed) / (1000 * 60 * 60);

    return hoursSince > (point?.interval_hours || 0) ? "overdue" : "ok";
  };

  const getNextControlDate = () => {
    if (records.length === 0 || !point?.interval_hours) return null;
    
    const latestRecord = records[0];
    const lastPerformed = new Date(latestRecord.performed_at);
    const nextDate = new Date(lastPerformed.getTime() + point.interval_hours * 60 * 60 * 1000);
    return nextDate;
  };

  const handleConfirmRecord = async () => {
    if (!point) return;
    setIsProcessing(true);

    const recordType =
      point.type === "auto_lubricator"
        ? "lubricator_change"
        : point.type === "inspection"
        ? "inspection"
        : "lubrication";

    await recordMutation.mutateAsync({
      control_point_id: point.id,
      record_type: recordType,
      performed_at: new Date().toISOString(),
    });
  };

  if (!point || !machine) {
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

  const status = getPointStatus();
  const activeIssues = issues.filter((i) => i.status === "reported");
  const nextDate = getNextControlDate();

  return (
    <div className="p-4 md:p-8 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
      <div className="max-w-4xl mx-auto">
        <Button
          variant="ghost"
          onClick={() => navigate(createPageUrl(`Machine?id=${machine.id}`))}
          className="mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Zpět na {machine.name}
        </Button>

        {/* Header Card */}
        <Card className="mb-6 shadow-lg">
          <CardContent className="p-8">
            <div className="flex items-start gap-6">
              <div
                className={`w-16 h-16 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  status === "overdue" ? "bg-yellow-100" : "bg-green-100"
                }`}
              >
                {point.type === "inspection" ? (
                  <ClipboardCheck
                    className={`w-8 h-8 ${
                      status === "overdue" ? "text-yellow-700" : "text-green-700"
                    }`}
                  />
                ) : (
                  <Droplet
                    className={`w-8 h-8 ${
                      status === "overdue" ? "text-yellow-700" : "text-green-700"
                    }`}
                  />
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-2xl font-bold text-slate-900">
                    {point.number && `${point.number} - `}
                    {point.name}
                  </h1>
                  {status === "overdue" && (
                    <Badge
                      variant="outline"
                      className="gap-1 bg-yellow-100 text-yellow-800 border-yellow-300"
                    >
                      <Clock className="w-3 h-3" />
                      Po termínu
                    </Badge>
                  )}
                  {status === "ok" && (
                    <Badge
                      variant="outline"
                      className="gap-1 bg-green-100 text-green-800 border-green-300"
                    >
                      <CheckCircle className="w-3 h-3" />
                      V pořádku
                    </Badge>
                  )}
                </div>
                {point.description && (
                  <p className="text-slate-600 mb-4">{point.description}</p>
                )}
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{machine.name}</Badge>
                  <Badge variant="outline">
                    {point.type === "lubrication"
                      ? "Mazání"
                      : point.type === "inspection"
                      ? "Inspekce"
                      : "Automatická maznice"}
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Parametry */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Parametry</CardTitle>
          </CardHeader>
          <CardContent>
            {point.type === "lubrication" && (
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <p className="text-sm text-slate-600 mb-1">Mazivo</p>
                  <p className="text-lg font-semibold text-slate-900">
                    {point.lubricant_type || "-"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-600 mb-1">Množství</p>
                  <p className="text-lg font-semibold text-slate-900">
                    {point.lubricant_amount
                      ? `${point.lubricant_amount} g`
                      : "-"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-600 mb-1">Interval</p>
                  <p className="text-lg font-semibold text-slate-900">
                    {point.interval_hours ? `${point.interval_hours} h` : "-"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-600 mb-1">Poslední mazání</p>
                  <p className="text-lg font-semibold text-slate-900">
                    {records.length > 0
                      ? format(
                          new Date(records[0].performed_at),
                          "d. M. yyyy HH:mm",
                          { locale: cs }
                        )
                      : "-"}
                  </p>
                </div>
                {nextDate && (
                  <div className="md:col-span-2">
                    <p className="text-sm text-slate-600 mb-1">Následující mazání</p>
                    <p className={`text-lg font-semibold flex items-center ${
                      status === "overdue" ? "text-yellow-700" : "text-slate-900"
                    }`}>
                      {format(nextDate, "d. M. yyyy HH:mm", { locale: cs })}
                      {status === "overdue" && (
                        <Badge variant="outline" className="ml-2 bg-yellow-100 text-yellow-800 border-yellow-300">
                          Po termínu
                        </Badge>
                      )}
                    </p>
                  </div>
                )}
              </div>
            )}

            {point.type === "inspection" && (
              <div className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <p className="text-sm text-slate-600 mb-1">Interval</p>
                    <p className="text-lg font-semibold text-slate-900">
                      {point.interval_hours ? `${point.interval_hours} h` : "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-600 mb-1">
                      Poslední kontrola
                    </p>
                    <p className="text-lg font-semibold text-slate-900">
                      {records.length > 0
                        ? format(
                            new Date(records[0].performed_at),
                            "d. M. yyyy HH:mm",
                            { locale: cs }
                          )
                        : "-"}
                    </p>
                  </div>
                  {nextDate && (
                    <div className="md:col-span-2">
                      <p className="text-sm text-slate-600 mb-1">Následující kontrola</p>
                      <p className={`text-lg font-semibold flex items-center ${
                        status === "overdue" ? "text-yellow-700" : "text-slate-900"
                      }`}>
                        {format(nextDate, "d. M. yyyy HH:mm", { locale: cs })}
                        {status === "overdue" && (
                          <Badge variant="outline" className="ml-2 bg-yellow-100 text-yellow-800 border-yellow-300">
                            Po termínu
                          </Badge>
                        )}
                      </p>
                    </div>
                  )}
                </div>
                {point.inspection_tasks && (
                  <div>
                    <p className="text-sm text-slate-600 mb-2">
                      Úkoly k provedení
                    </p>
                    <p className="text-slate-900 whitespace-pre-wrap">
                      {point.inspection_tasks}
                    </p>
                  </div>
                )}
              </div>
            )}

            {point.type === "auto_lubricator" && (
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <p className="text-sm text-slate-600 mb-1">Poslední výměna</p>
                  <p className="text-lg font-semibold text-slate-900">
                    {records.length > 0
                      ? format(new Date(records[0].performed_at), "d. M. yyyy", {
                          locale: cs,
                        })
                      : "-"}
                  </p>
                </div>
                {nextDate && (
                  <div>
                    <p className="text-sm text-slate-600 mb-1">Následující výměna</p>
                    <p className={`text-lg font-semibold flex items-center ${
                      status === "overdue" ? "text-yellow-700" : "text-slate-900"
                    }`}>
                      {format(nextDate, "d. M. yyyy HH:mm", { locale: cs })}
                      {status === "overdue" && (
                        <Badge variant="outline" className="ml-2 bg-yellow-100 text-yellow-800 border-yellow-300">
                          Po termínu
                        </Badge>
                      )}
                    </p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Aktivní závady */}
        {activeIssues.length > 0 && (
          <Card className="mb-6 border-l-4 border-l-orange-500">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-orange-700">
                <AlertTriangle className="w-5 h-5" />
                Aktivní závady ({activeIssues.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {activeIssues.map((issue) => (
                  <div
                    key={issue.id}
                    className="p-4 rounded-lg bg-orange-50 border border-orange-200"
                  >
                    <p className="text-sm text-slate-900 mb-2">
                      {issue.description}
                    </p>
                    <p className="text-xs text-slate-500">
                      Nahlášeno:{" "}
                      {format(new Date(issue.created_date), "d. M. yyyy HH:mm", {
                        locale: cs,
                      })}
                    </p>
                    <p className="text-xs text-slate-600 mt-1">
                      {issue.created_by}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Akce */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <Button
              onClick={handleConfirmRecord}
              disabled={isProcessing}
              className={`w-full h-14 text-lg ${
                point.type === "inspection"
                  ? "bg-purple-600 hover:bg-purple-700"
                  : point.type === "auto_lubricator"
                  ? "bg-blue-600 hover:bg-blue-700"
                  : "bg-green-600 hover:bg-green-700"
              }`}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Ukládání...
                </>
              ) : (
                <>
                  {point.type === "inspection" ? (
                    <>
                      <CheckCircle className="w-5 h-5 mr-2" />
                      Potvrdit inspekci
                    </>
                  ) : point.type === "auto_lubricator" ? (
                    <>
                      <Droplet className="w-5 h-5 mr-2" />
                      Potvrdit výměnu maznice
                    </>
                  ) : (
                    <>
                      <Droplet className="w-5 h-5 mr-2" />
                      Potvrdit mazání
                    </>
                  )}
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Historie */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarIcon className="w-5 h-5" />
              Historie záznamů
            </CardTitle>
          </CardHeader>
          <CardContent>
            {records.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-slate-500">Zatím nejsou žádné záznamy</p>
              </div>
            ) : (
              <div className="space-y-3">
                {records.map((record) => (
                  <div
                    key={record.id}
                    className="flex items-start gap-4 p-4 rounded-lg bg-slate-50 border border-slate-200"
                  >
                    <div className="flex-shrink-0 mt-1">
                      {record.record_type === "lubrication" ? (
                        <Droplet className="w-5 h-5 text-blue-600" />
                      ) : record.record_type === "inspection" ? (
                        <ClipboardCheck className="w-5 h-5 text-purple-600" />
                      ) : (
                        <Droplet className="w-5 h-5 text-green-600" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-semibold text-slate-900">
                          {record.record_type === "lubrication"
                            ? "Mazání provedeno"
                            : record.record_type === "inspection"
                            ? "Inspekce provedena"
                            : "Výměna maznice"}
                        </p>
                        <Badge variant="outline" className="text-xs">
                          {format(
                            new Date(record.performed_at),
                            "d. M. yyyy HH:mm",
                            { locale: cs }
                          )}
                        </Badge>
                      </div>
                      {record.note && (
                        <p className="text-sm text-slate-600 mb-1">
                          {record.note}
                        </p>
                      )}
                      <p className="text-xs text-slate-500">
                        {record.created_by}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
