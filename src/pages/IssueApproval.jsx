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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertTriangle,
  CheckCircle,
  XCircle,
  Loader2,
  ChevronRight,
  Trash2,
  ArrowLeft,
  Filter,
  Building2,
  Clock,
  Factory,
} from "lucide-react";
import { format } from "date-fns";
import { cs } from "date-fns/locale";

export default function IssueApproval() {
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [selectedIssue, setSelectedIssue] = useState(null);
  const [showResolveDialog, setShowResolveDialog] = useState(false);
  const [resolutionNote, setResolutionNote] = useState("");
  const [isResolving, setIsResolving] = useState(false);
  const [deleteIssueId, setDeleteIssueId] = useState(null);
  const [highlightedIssueId, setHighlightedIssueId] = useState(null);

  useEffect(() => {
    loadUser();
    
    // Zkontrolovat, zda je v URL parametr issue
    const urlParams = new URLSearchParams(window.location.search);
    const issueId = urlParams.get("issue");
    if (issueId) {
      setHighlightedIssueId(issueId);
      // Scrollnout k závadě po načtení
      setTimeout(() => {
        const element = document.getElementById(`issue-${issueId}`);
        if (element) {
          element.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 500);
    }
  }, []);

  const loadUser = async () => {
    const currentUser = await base44.auth.me();
    setUser(currentUser);
  };

  const { data: allReportedIssues = [] } = useQuery({
    queryKey: ["reportedIssues"],
    queryFn: () => base44.entities.Issue.filter({ status: "reported" }, "-created_date"),
  });

  const { data: allResolvedIssues = [] } = useQuery({
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

  const { data: companies = [] } = useQuery({
    queryKey: ["companies"],
    queryFn: () => base44.entities.Company.list(),
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ["allUsers"],
    queryFn: () => base44.entities.User.list(),
  });

  const userMap = React.useMemo(() => {
    return allUsers.reduce((acc, u) => {
      acc[u.email] = u;
      return acc;
    }, {});
  }, [allUsers]);

  const getUserDisplayName = (email) => {
    const u = userMap[email];
    return u ? (u.custom_display_name || u.full_name || u.email) : email;
  };

  // Filtrování závad podle podniku uživatele
  const reportedIssues = React.useMemo(() => {
    if (!user) return [];
    if (user.user_type === "superAdmin") return allReportedIssues;
    
    if (user.user_type === "admin") {
      // Admin vidí pouze závady z přiřazených podniků
      const assignedCompanyIds = user.assigned_company_ids || [];
      const companyLines = lines.filter(l => assignedCompanyIds.includes(l.company_id));
      const companyLineIds = companyLines.map(l => l.id);
      const companyMachines = machines.filter(m => companyLineIds.includes(m.line_id));
      const companyMachineIds = companyMachines.map(m => m.id);
      const companyControlPoints = controlPoints.filter(cp => companyMachineIds.includes(cp.machine_id));
      const companyControlPointIds = companyControlPoints.map(cp => cp.id);
      
      return allReportedIssues.filter(issue => 
        (issue.control_point_id && companyControlPointIds.includes(issue.control_point_id)) ||
        (issue.machine_id && companyMachineIds.includes(issue.machine_id))
      );
    }

    // Pro non-admin: filtrovat podle company_id
    const companyLines = lines.filter(l => l.company_id === user.company_id);
    const companyLineIds = companyLines.map(l => l.id);
    const companyMachines = machines.filter(m => companyLineIds.includes(m.line_id));
    const companyMachineIds = companyMachines.map(m => m.id);
    const companyControlPoints = controlPoints.filter(cp => companyMachineIds.includes(cp.machine_id));
    const companyControlPointIds = companyControlPoints.map(cp => cp.id);

    return allReportedIssues.filter(issue => 
      (issue.control_point_id && companyControlPointIds.includes(issue.control_point_id)) ||
      (issue.machine_id && companyMachineIds.includes(issue.machine_id))
    );
  }, [allReportedIssues, user, lines, machines, controlPoints]);

  const resolvedIssues = React.useMemo(() => {
    if (!user) return [];
    if (user.user_type === "superAdmin") return allResolvedIssues;
    
    if (user.user_type === "admin") {
      // Admin vidí pouze závady z přiřazených podniků
      const assignedCompanyIds = user.assigned_company_ids || [];
      const companyLines = lines.filter(l => assignedCompanyIds.includes(l.company_id));
      const companyLineIds = companyLines.map(l => l.id);
      const companyMachines = machines.filter(m => companyLineIds.includes(m.line_id));
      const companyMachineIds = companyMachines.map(m => m.id);
      const companyControlPoints = controlPoints.filter(cp => companyMachineIds.includes(cp.machine_id));
      const companyControlPointIds = companyControlPoints.map(cp => cp.id);
      
      return allResolvedIssues.filter(issue => 
        (issue.control_point_id && companyControlPointIds.includes(issue.control_point_id)) ||
        (issue.machine_id && companyMachineIds.includes(issue.machine_id))
      );
    }

    // Pro non-admin: filtrovat podle company_id
    const companyLines = lines.filter(l => l.company_id === user.company_id);
    const companyLineIds = companyLines.map(l => l.id);
    const companyMachines = machines.filter(m => companyLineIds.includes(m.line_id));
    const companyMachineIds = companyMachines.map(m => m.id);
    const companyControlPoints = controlPoints.filter(cp => companyMachineIds.includes(cp.machine_id));
    const companyControlPointIds = companyControlPoints.map(cp => cp.id);

    return allResolvedIssues.filter(issue => 
      (issue.control_point_id && companyControlPointIds.includes(issue.control_point_id)) ||
      (issue.machine_id && companyMachineIds.includes(issue.machine_id))
    );
  }, [allResolvedIssues, user, lines, machines, controlPoints]);

  const allVisibleIssues = React.useMemo(() => [...reportedIssues, ...resolvedIssues], [reportedIssues, resolvedIssues]);

  // Získat informace o bodě nebo stroji pro zobrazení
  const getIssueInfo = (issue) => {
    let category = "Ostatní";

    if (issue.control_point_id) {
      const point = controlPoints.find((p) => p.id === issue.control_point_id);
      if (!point) return { name: "Neznámý bod", machineName: "", lineName: "", companyName: "", type: "control_point", category };

      const machine = machines.find((m) => m.id === point.machine_id);
      const line = lines.find((l) => l.id === machine?.line_id);
      const company = companies.find((c) => c.id === line?.company_id);

      // Determine category based on CP type
      if (point.type === 'prevention') {
        category = "Prevence";
      } else {
        // lubrication, inspection, auto_lubricator
        category = "Mazání";
      }

      return {
        name: point.name,
        number: point.number,
        machineName: machine?.name || "",
        lineName: line?.name || "",
        companyName: company?.name || "",
        companyId: company?.id,
        type: "control_point",
        category
      };
    } else if (issue.machine_id) {
      const machine = machines.find((m) => m.id === issue.machine_id);
      if (!machine) return { name: "Neznámý stroj", machineName: "", lineName: "", companyName: "", type: "machine", category };

      const line = lines.find((l) => l.id === machine.line_id);
      const company = companies.find((c) => c.id === line?.company_id);

      category = "Technická diagnostika";

      return {
        name: machine.name,
        machineName: machine.name,
        lineName: line?.name || "",
        companyName: company?.name || "",
        companyId: company?.id,
        type: "machine",
        category
      };
    }

    return { name: "Neznámá lokace", machineName: "", lineName: "", companyName: "", type: "unknown", category };
  };

  const groupedReportedIssues = React.useMemo(() => {
    const grouped = {};

    reportedIssues.forEach(issue => {
      const details = getIssueInfo(issue);
      if (!details.companyId) return;

      if (!grouped[details.companyId]) {
        grouped[details.companyId] = {
          companyName: details.companyName,
          count: 0,
          categories: {
            "Mazání": [],
            "Prevence": [],
            "Technická diagnostika": []
          }
        };
      }

      const company = companies.find(c => c.id === details.companyId);
      const diagEnabled = company && (company.enable_vibration || company.enable_thermo || company.enable_tribo);

      let targetCategory = details.category;
      if (targetCategory === "Technická diagnostika" && !diagEnabled) {
         // Optional: handle diagnostics disabled
      }

      if (!grouped[details.companyId].categories[targetCategory]) {
        grouped[details.companyId].categories[targetCategory] = [];
      }

      grouped[details.companyId].categories[targetCategory].push({ ...issue, ...details });
      grouped[details.companyId].count++;
    });

    return grouped;
  }, [reportedIssues, controlPoints, machines, lines, companies]);

  const resolveIssueMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Issue.update(id, data),
    onSuccess: async (updatedIssue) => {
      const info = getIssueInfo(updatedIssue);
      await base44.entities.AuditLog.create({
        entity_type: "Issue",
        entity_id: updatedIssue.id,
        changed_by: user?.email || "",
        change_description: `Vyřešil závadu "${updatedIssue.description.slice(0, 50)}..." na ${info.type === "control_point" ? "kontrolním bodě" : "stroji"} "${info.name || "Neznámý"}"`,
        user_type: user?.user_type,
        company_id: user?.company_id || null,
      });
      queryClient.invalidateQueries({ queryKey: ["reportedIssues"] });
      queryClient.invalidateQueries({ queryKey: ["resolvedIssues"] });
      queryClient.invalidateQueries({ queryKey: ["issues"] });
      queryClient.invalidateQueries({ queryKey: ["auditLogs"] });
      setShowResolveDialog(false);
      setSelectedIssue(null);
      setResolutionNote("");
      setIsResolving(false);
    },
    onError: () => {
      setIsResolving(false);
    },
  });

  const deleteIssueMutation = useMutation({
    mutationFn: (id) => base44.entities.Issue.delete(id),
    onSuccess: async (_, deletedId) => {
      const deletedIssue = allVisibleIssues.find(i => i.id === deletedId);
      await base44.entities.AuditLog.create({
        entity_type: "Issue",
        entity_id: deletedId,
        changed_by: user?.email || "",
        change_description: `Smazal vyřešenou závadu "${deletedIssue?.description.slice(0, 50) || "Neznámá závada"}..."`,
        user_type: user?.user_type,
        company_id: user?.company_id || null,
      });
      queryClient.invalidateQueries({ queryKey: ["reportedIssues"] });
      queryClient.invalidateQueries({ queryKey: ["resolvedIssues"] });
      queryClient.invalidateQueries({ queryKey: ["issues"] });
      queryClient.invalidateQueries({ queryKey: ["auditLogs"] });
      setDeleteIssueId(null);
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

  const canResolveIssues = user?.user_type === "admin" || user?.user_type === "manager" || user?.user_type === "superAdmin";
  const canDeleteIssues = user?.user_type === "admin" || user?.user_type === "manager" || user?.user_type === "superAdmin";

  const renderIssueCard = (issue, isResolved = false) => {
    const issueInfo = getIssueInfo(issue);
    const isHighlighted = issue.id === highlightedIssueId;

    return (
      <Card
        key={issue.id}
        id={`issue-${issue.id}`}
        className={`border-l-4 transition-all ${
          isResolved ? "border-l-green-500 bg-green-50/30" : "border-l-orange-500 bg-orange-50/30"
        } ${
          isHighlighted ? "ring-4 ring-blue-400 ring-opacity-50 shadow-xl" : ""
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
                  {issueInfo.type === "control_point" && issueInfo.number && `${issueInfo.number} - `}
                  {issueInfo.name}
                </CardTitle>
                {issueInfo.type === "machine" && (
                  <Badge className="bg-blue-100 text-blue-700">Celý stroj</Badge>
                )}
                {isHighlighted && (
                  <Badge className="bg-blue-600 text-white">
                    Vybraná závada
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-600 flex-wrap">
                {issueInfo.companyName && (
                  <>
                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                      {issueInfo.companyName}
                    </Badge>
                    <span>•</span>
                  </>
                )}
                {issueInfo.lineName && (
                  <>
                    <span>{issueInfo.lineName}</span>
                    <span>•</span>
                  </>
                )}
                <span>{issueInfo.machineName}</span>
              </div>
            </div>
            <div className="flex gap-2">
              {!isResolved && canResolveIssues && (
                <Button
                  onClick={() => handleOpenResolveDialog(issue)}
                  className="bg-gradient-to-r from-green-600 to-green-700"
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Vyřešit
                </Button>
              )}
              {isResolved && canDeleteIssues && (
                <Button
                  onClick={() => setDeleteIssueId(issue.id)}
                  variant="ghost"
                  size="icon"
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>
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

            {issue.photo_url && (
              <div>
                <p className="text-sm font-medium text-slate-700 mb-2">Fotografie:</p>
                <div 
                  className="relative aspect-video rounded-lg overflow-hidden border-2 border-slate-200 cursor-pointer hover:border-orange-400 transition-all"
                  onClick={() => window.open(issue.photo_url, "_blank")}
                >
                  <img
                    src={issue.photo_url}
                    alt="Fotografie závady"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/0 hover:bg-black/30 transition-all flex items-center justify-center">
                    <span className="text-white font-medium opacity-0 hover:opacity-100 transition-opacity">
                      Kliknout pro zvětšení
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center gap-4 text-xs text-slate-500">
              <div className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                <span>
                  Nahlášeno: {format(new Date(issue.created_date), "d. M. yyyy HH:mm", { locale: cs })}
                </span>
              </div>
              <span>•</span>
              <span>{getUserDisplayName(issue.created_by)}</span>
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
                    <span>{getUserDisplayName(issue.resolved_by)}</span>
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
            {user?.user_type === "superAdmin" 
              ? "Přehled všech nahlášených a vyřešených závad" 
              : user?.user_type === "admin"
              ? "Přehled závad z vašich přiřazených podniků"
              : "Přehled nahlášených a vyřešených závad vašeho podniku"
            }
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
              <div className="space-y-4">
                {user?.user_type !== 'manager' ? (
                   <Accordion type="multiple" className="space-y-4">
                     {Object.entries(groupedReportedIssues).map(([companyId, data]) => (
                       <AccordionItem key={companyId} value={companyId} className="bg-white border rounded-lg px-4">
                         <AccordionTrigger className="hover:no-underline py-4">
                           <div className="flex items-center gap-3 w-full">
                             <div className="flex items-center gap-2">
                                <Building2 className="w-5 h-5 text-blue-600" />
                                <span className="font-bold text-lg">{data.companyName}</span>
                             </div>
                             <Badge variant="secondary" className="ml-auto mr-4 bg-orange-100 text-orange-700">
                                {data.count} závad
                             </Badge>
                           </div>
                         </AccordionTrigger>
                         <AccordionContent className="pt-2 pb-6">
                           <div className="space-y-8">
                              {Object.entries(data.categories).map(([category, issues]) => {
                                 if (issues.length === 0) return null;
                                 return (
                                   <div key={category} className="space-y-3">
                                      <h4 className="font-semibold text-slate-700 border-b pb-2 flex items-center gap-2">
                                         {category === "Prevence" ? <Factory className="w-4 h-4 text-purple-600" /> :
                                          category === "Mazání" ? <Factory className="w-4 h-4 text-blue-600" /> :
                                          <Activity className="w-4 h-4 text-green-600" />}
                                         {category} ({issues.length})
                                      </h4>
                                      <div className="grid gap-4">
                                         {issues.map(issue => renderIssueCard(issue, false))}
                                      </div>
                                   </div>
                                 );
                              })}
                           </div>
                         </AccordionContent>
                       </AccordionItem>
                     ))}
                   </Accordion>
                ) : (
                   <div className="space-y-8">
                     {Object.values(groupedReportedIssues).map((data) => (
                        <div key={data.companyName} className="space-y-8">
                             {Object.entries(data.categories).map(([category, issues]) => {
                                   if (issues.length === 0) return null;
                                   return (
                                     <div key={category} className="space-y-3">
                                        <h4 className="font-bold text-lg text-slate-800 border-b pb-2 flex items-center gap-2">
                                           {category === "Prevence" ? <Factory className="w-5 h-5 text-purple-600" /> :
                                            category === "Mazání" ? <Factory className="w-5 h-5 text-blue-600" /> :
                                            <Activity className="w-5 h-5 text-green-600" />}
                                           {category}
                                           <Badge variant="secondary" className="ml-2">{issues.length}</Badge>
                                        </h4>
                                        <div className="grid gap-4">
                                           {issues.map(issue => renderIssueCard(issue, false))}
                                        </div>
                                     </div>
                                   );
                                })}
                        </div>
                     ))}
                   </div>
                )}
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
                    Vyřešení závady na: {getIssueInfo(selectedIssue).name}
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
                    Ukládám...
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

        {/* Alert dialog pro smazání vyřešené závady */}
        <AlertDialog
          open={!!deleteIssueId}
          onOpenChange={() => setDeleteIssueId(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Opravdu smazat vyřešenou závadu?</AlertDialogTitle>
              <AlertDialogDescription>
                Tato akce je nevratná. Záznam o vyřešené závadě bude trvale odstraněn z databáze.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel
                onClick={() => setDeleteIssueId(null)}
                disabled={deleteIssueMutation.isLoading}
              >
                Zrušit
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteIssueMutation.mutate(deleteIssueId)}
                className="bg-red-600 hover:bg-red-700"
                disabled={deleteIssueMutation.isLoading}
              >
                {deleteIssueMutation.isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Smazávám...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4 mr-2" />
                    Smazat
                  </>
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}