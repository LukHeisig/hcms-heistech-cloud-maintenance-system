import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertTriangle, CheckCircle, Clock, Factory, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { cs } from "date-fns/locale";

export default function IssueApproval() {
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [selectedIssue, setSelectedIssue] = useState(null);
  const [showResolveDialog, setShowResolveDialog] = useState(false);
  const [resolutionNote, setResolutionNote] = useState("");
  const [isResolving, setIsResolving] = useState(false);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    const currentUser = await base44.auth.me();
    setUser(currentUser);
  };

  const { data: reportedIssues = [] } = useQuery({
    queryKey: ["reportedIssues"],
    queryFn: () => base44.entities.Issue.filter({ status: "reported" }, "-created_date"),
  });

  const { data: resolvedIssues = [] } = useQuery({
    queryKey: ["resolvedIssues"],
    queryFn: () => base44.entities.Issue.filter({ status: "resolved" }, "-resolved_at"),
  });

  const { data: controlPoints = [] } = useQuery({
    queryKey: ["controlPoints"],
    queryFn: () => base44.entities.ControlPoint.list(),
  });

  const { data: machines = [] } = useQuery({
    queryKey: ["machines"],
    queryFn: () => base44.entities.Machine.list(),
  });

  const { data: lines = [] } = useQuery({
    queryKey: ["lines"],
    queryFn: () => base44.entities.Line.list(),
  });

  const resolveIssueMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Issue.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reportedIssues"] });
      queryClient.invalidateQueries({ queryKey: ["resolvedIssues"] });
      queryClient.invalidateQueries({ queryKey: ["issues"] });
      setShowResolveDialog(false);
      setSelectedIssue(null);
      setResolutionNote("");
      setIsResolving(false);
    },
    onError: () => {
      setIsResolving(false);
    },
  });

  const handleOpenResolveDialog = (issue) => {
    setSelectedIssue(issue);
    setResolutionNote("");
    setShowResolveDialog(true);
  };

  const handleResolveIssue = async () => {
    if (!selectedIssue) return;
    setIsResolving(true);

    await resolveIssueMutation.mutateAsync({
      id: selectedIssue.id,
      data: {
        status: "resolved",
        resolved_at: new Date().toISOString(),
        resolved_by: user?.email || "",
        resolution_note: resolutionNote.trim() || undefined,
      },
    });
  };

  const getPointInfo = (controlPointId) => {
    const point = controlPoints.find((p) => p.id === controlPointId);
    if (!point) return { pointName: "Neznámý bod", machineName: "", lineName: "" };

    const machine = machines.find((m) => m.id === point.machine_id);
    const line = lines.find((l) => l.id === machine?.line_id);

    return {
      pointName: point.name,
      pointNumber: point.number,
      machineName: machine?.name || "",
      lineName: line?.name || "",
    };
  };

  const canResolveIssues = user?.user_type === "admin" || user?.user_type === "manager";

  const renderIssueCard = (issue, isResolved = false) => {
    const { pointName, pointNumber, machineName, lineName } = getPointInfo(issue.control_point_id);

    return (
      <Card
        key={issue.id}
        className={`border-l-4 ${
          isResolved ? "border-l-green-500 bg-green-50/30" : "border-l-orange-500 bg-orange-50/30"
        }`}
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                {isResolved ? (
                  <CheckCircle className="w-5 h-5 text-green-600" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-orange-600" />
                )}
                <CardTitle className="text-lg">
                  {pointNumber && `${pointNumber} - `}{pointName}
                </CardTitle>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-600">
                {lineName && (
                  <>
                    <span>{lineName}</span>
                    <span>•</span>
                  </>
                )}
                <span>{machineName}</span>
              </div>
            </div>
            {!isResolved && canResolveIssues && (
              <Button
                onClick={() => handleOpenResolveDialog(issue)}
                className="bg-gradient-to-r from-green-600 to-green-700"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Vyřešit
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium text-slate-700 mb-1">Popis závady:</p>
              <p className="text-sm text-slate-900 bg-white p-3 rounded-lg border border-slate-200">
                {issue.description}
              </p>
            </div>

            <div className="flex items-center gap-4 text-xs text-slate-500">
              <div className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                <span>
                  Nahlášeno: {format(new Date(issue.created_date), "d. M. yyyy HH:mm", { locale: cs })}
                </span>
              </div>
              <span>•</span>
              <span>{issue.created_by}</span>
            </div>

            {isResolved && (
              <>
                <div className="border-t border-slate-200 pt-3 mt-3">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <p className="text-sm font-medium text-green-700">Vyřešeno</p>
                  </div>
                  {issue.resolution_note && (
                    <p className="text-sm text-slate-700 bg-green-50 p-3 rounded-lg border border-green-200 mb-2">
                      {issue.resolution_note}
                    </p>
                  )}
                  <div className="flex items-center gap-4 text-xs text-slate-500">
                    <span>
                      {format(new Date(issue.resolved_at), "d. M. yyyy HH:mm", { locale: cs })}
                    </span>
                    <span>•</span>
                    <span>{issue.resolved_by}</span>
                  </div>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="p-4 md:p-8 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Správa závad</h1>
          <p className="text-slate-600">
            Přehled všech nahlášených a vyřešených závad
          </p>
        </div>

        {!canResolveIssues && (
          <Card className="mb-6 border-blue-200 bg-blue-50">
            <CardContent className="p-4">
              <p className="text-sm text-blue-900">
                <strong>Informace:</strong> Pouze vedoucí a administrátoři mohou označovat závady jako vyřešené.
              </p>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="reported" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 bg-white shadow-sm">
            <TabsTrigger value="reported" className="gap-2">
              <AlertTriangle className="w-4 h-4" />
              Nahlášené ({reportedIssues.length})
            </TabsTrigger>
            <TabsTrigger value="resolved" className="gap-2">
              <CheckCircle className="w-4 h-4" />
              Vyřešené ({resolvedIssues.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="reported">
            {reportedIssues.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">
                    Žádné nahlášené závady
                  </h3>
                  <p className="text-slate-500">
                    Momentálně nejsou žádné aktivní závady
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {reportedIssues.map((issue) => renderIssueCard(issue, false))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="resolved">
            {resolvedIssues.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <AlertTriangle className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">
                    Žádné vyřešené závady
                  </h3>
                  <p className="text-slate-500">
                    Zatím nebyly vyřešeny žádné závady
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {resolvedIssues.map((issue) => renderIssueCard(issue, true))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Dialog pro vyřešení závady */}
        <Dialog open={showResolveDialog} onOpenChange={setShowResolveDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-green-700">
                <CheckCircle className="w-5 h-5" />
                Označit závadu jako vyřešenou
              </DialogTitle>
              <DialogDescription>
                {selectedIssue && (
                  <>
                    Vyřešení závady na bodě: {getPointInfo(selectedIssue.control_point_id).pointName}
                  </>
                )}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {selectedIssue && (
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                  <p className="text-sm font-medium text-slate-700 mb-2">Původní popis závady:</p>
                  <p className="text-sm text-slate-900">{selectedIssue.description}</p>
                </div>
              )}
              <div>
                <Label htmlFor="resolutionNote">Poznámka k vyřešení (volitelné)</Label>
                <Textarea
                  id="resolutionNote"
                  value={resolutionNote}
                  onChange={(e) => setResolutionNote(e.target.value)}
                  placeholder="Jak byla závada vyřešena, co bylo provedeno..."
                  rows={4}
                  className="mt-2"
                />
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-900">
                  Závada bude označena jako vyřešená a přesunuta do historie vyřešených závad.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowResolveDialog(false);
                  setResolutionNote("");
                }}
                disabled={isResolving}
              >
                Zrušit
              </Button>
              <Button
                onClick={handleResolveIssue}
                disabled={isResolving}
                className="bg-gradient-to-r from-green-600 to-green-700"
              >
                {isResolving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Ukládání...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Potvrdit vyřešení
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}