import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Activity,
} from "lucide-react";
import { format } from "date-fns";
import { cs } from "date-fns/locale";

export default function IssueApproval() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [selectedIssue, setSelectedIssue] = useState(null);
  const [showResolveDialog, setShowResolveDialog] = useState(false);
  const [resolutionNote, setResolutionNote] = useState("");
  const [isResolving, setIsResolving] = useState(false);
  const [deleteIssueId, setDeleteIssueId] = useState(null);
  const [highlightedIssueId, setHighlightedIssueId] = useState(null);
  
  // Work Order State
  const [showCreateWorkOrderDialog, setShowCreateWorkOrderDialog] = useState(false);
  const [workOrderForm, setWorkOrderForm] = useState({
    title: "",
    description: "",
    maintenance_type: "corrective",
    planned_date: "",
    priority: "medium",
    assigned_to: "",
    estimated_duration_hours: "",
  });

  useEffect(() => {
    loadUser();
    
    // Zkontrolovat, zda je v URL parametr issue
    const urlParams = new URLSearchParams(window.location.search);
    const issueId = urlParams.get("issue");
    const action = urlParams.get("action");

    if (issueId) {
      setHighlightedIssueId(issueId);
      // Scrollnout k závadě po načtení a provést akci
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
    queryFn: () => base44.entities.Issue.filter({ status: "reported" }, "-created_date", 1000),
  });

  const { data: allResolvedIssues = [] } = useQuery({
    queryKey: ["resolvedIssues"],
    queryFn: () => base44.entities.Issue.filter({ status: "resolved" }, "-resolved_at", 1000),
  });

  const { data: controlPoints = [] } = useQuery({
    queryKey: ["controlPoints"],
    queryFn: () => base44.entities.ControlPoint.list(null, 1000),
  });

  const { data: machines = [] } = useQuery({
    queryKey: ["machines"],
    queryFn: () => base44.entities.Machine.list(null, 1000),
  });

  const { data: lines = [] } = useQuery({
    queryKey: ["lines"],
    queryFn: () => base44.entities.Line.list(null, 1000),
  });

  const { data: companies = [] } = useQuery({
    queryKey: ["companies"],
    queryFn: () => base44.entities.Company.list(null, 1000),
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ["allUsers"],
    queryFn: async () => {
      const { data } = await base44.functions.invoke("getUsers");
      return data;
    },
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

  // Filtrování závad podle podniku uživatele
  const reportedIssues = React.useMemo(() => {
    if (!user) return [];
    // Filter logic unified for all roles to ensure consistency
    return allReportedIssues.filter(issue => {
      const details = getIssueInfo(issue);
      if (!details.companyId) return false; // Hide orphans

      if (user.user_type === "superAdmin") return true;
      if (user.user_type === "admin") {
        return user.assigned_company_ids?.includes(details.companyId);
      }
      return user.company_id === details.companyId;
    });
  }, [allReportedIssues, user, lines, machines, controlPoints]);

  const resolvedIssues = React.useMemo(() => {
    if (!user) return [];
    return allResolvedIssues.filter(issue => {
      const details = getIssueInfo(issue);
      if (!details.companyId) return false;

      if (user.user_type === "superAdmin") return true;
      if (user.user_type === "admin") {
        return user.assigned_company_ids?.includes(details.companyId);
      }
      return user.company_id === details.companyId;
    });
  }, [allResolvedIssues, user, lines, machines, controlPoints]);

  const allVisibleIssues = React.useMemo(() => [...reportedIssues, ...resolvedIssues], [reportedIssues, resolvedIssues]);

  // Effect pro automatické otevření dialogu po načtení dat
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const issueId = urlParams.get("issue");
    const action = urlParams.get("action");

    if (issueId && action && allVisibleIssues.length > 0) {
       const issue = allVisibleIssues.find(i => i.id === issueId);
       if (issue) {
          if (action === 'create_wo' && !showCreateWorkOrderDialog && !selectedIssue) {
             handleOpenCreateWorkOrder(issue);
          } else if (action === 'resolve' && !showResolveDialog && !selectedIssue) {
             handleOpenResolveDialog(issue);
          }
       }
    }
  }, [allVisibleIssues]);

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

  const createWorkOrderMutation = useMutation({
    mutationFn: async (data) => {
      // 1. Create PlannedMaintenance
      const plannedMaintenance = await base44.entities.PlannedMaintenance.create({
        ...data,
        status: data.assigned_to ? "assigned" : "planned",
        work_order_created_at: new Date().toISOString(),
      });

      // 2. Update Issue
      await base44.entities.Issue.update(selectedIssue.id, {
        status: "work_order_created",
        planned_maintenance_id: plannedMaintenance.id,
      });

      // 3. Send Email if assigned
      if (data.assigned_to) {
        const assignedUserName = getUserDisplayName(data.assigned_to);
        try {
          await base44.integrations.Core.SendEmail({
            to: data.assigned_to,
            subject: `[HCMS] Přiřazen pracovní příkaz: ${data.title}`,
            body: `Dobrý den ${assignedUserName},\n\nByl vám přiřazen nový pracovní příkaz na základě nahlášené závady.\n\nNázev: ${data.title}\nPopis: ${data.description}\nTermín: ${format(new Date(data.planned_date), "d. M. yyyy", { locale: cs })}\n\nProsím zkontrolujte aplikaci pro více detailů.\n\nS pozdravem,\nHCMS`,
          });
        } catch (e) {
          console.error("Failed to send email", e);
        }
      }

      return plannedMaintenance;
    },
    onSuccess: async (pm) => {
      await base44.entities.AuditLog.create({
        entity_type: "Issue",
        entity_id: selectedIssue.id,
        changed_by: user?.email || "",
        change_description: `Vytvořil pracovní příkaz "${pm.title}" pro závadu`,
        user_type: user?.user_type,
        company_id: user?.company_id || null,
      });
      queryClient.invalidateQueries({ queryKey: ["reportedIssues"] });
      queryClient.invalidateQueries({ queryKey: ["resolvedIssues"] });
      queryClient.invalidateQueries({ queryKey: ["issues"] });
      setShowCreateWorkOrderDialog(false);
      setSelectedIssue(null);
    },
    onError: (error) => {
      alert("Chyba při vytváření pracovního příkazu: " + error.message);
    }
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

  const handleOpenCreateWorkOrder = (issue) => {
    const issueInfo = getIssueInfo(issue);
    setSelectedIssue(issue);
    setWorkOrderForm({
      title: `Oprava: ${issueInfo.name}`,
      description: `Na základě nahlášené závady:\n${issue.description}`,
      maintenance_type: "corrective",
      planned_date: format(new Date(), "yyyy-MM-dd"),
      priority: "medium",
      assigned_to: "",
      estimated_duration_hours: "1",
    });
    setShowCreateWorkOrderDialog(true);
  };

  const renderIssueCard = (issue, isResolved = false) => {
    const issueInfo = getIssueInfo(issue);
    const isHighlighted = issue.id === highlightedIssueId;
    const hasWorkOrder = issue.status === 'work_order_created' || issue.planned_maintenance_id;

    return (
      <Card
        key={issue.id}
        id={`issue-${issue.id}`}
        className={`border-l-4 transition-all cursor-pointer hover:shadow-md ${
          isResolved 
            ? "border-l-green-500 bg-green-50/30" 
            : hasWorkOrder 
              ? "border-l-blue-500 bg-blue-50/30" 
              : "border-l-orange-500 bg-orange-50/30"
        } ${
          isHighlighted ? "ring-4 ring-blue-400 ring-opacity-50 shadow-xl" : ""
        }`}
        onClick={(e) => {
           // Prevent navigation if clicking buttons
           if (e.target.closest('button') || e.target.closest('.prevent-nav')) return;
           navigate(createPageUrl(`IssueDetail?id=${issue.id}`));
        }}
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                {isResolved ? (
                  <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                ) : hasWorkOrder ? (
                  <Clock className="w-5 h-5 text-blue-600 flex-shrink-0" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-orange-600 flex-shrink-0" />
                )}
                
                <CardTitle className="text-lg truncate">
                  {issueInfo.type === "control_point" && issueInfo.number && `${issueInfo.number} - `}
                  {issueInfo.name}
                </CardTitle>
                
                {issueInfo.type === "machine" && (
                  <Badge className="bg-blue-100 text-blue-700">Celý stroj</Badge>
                )}
                
                {isResolved ? (
                  <Badge className="bg-green-100 text-green-700">Vyřešeno</Badge>
                ) : hasWorkOrder ? (
                  <Badge className="bg-blue-100 text-blue-700">PP Vytvořen</Badge>
                ) : (
                  <Badge className="bg-orange-100 text-orange-700">Nahlášeno</Badge>
                )}
              </div>
              
              <div className="flex items-center gap-2 text-sm text-slate-600 flex-wrap">
                {issueInfo.companyName && (
                  <>
                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                      {issueInfo.companyName}
                    </Badge>
                    <span className="hidden sm:inline">•</span>
                  </>
                )}
                {issueInfo.lineName && (
                  <>
                    <span>{issueInfo.lineName}</span>
                    <span className="hidden sm:inline">•</span>
                  </>
                )}
                <span>{issueInfo.machineName}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 flex-shrink-0 flex-col sm:flex-row">
              {!isResolved && !hasWorkOrder && canResolveIssues && (
                <>
                  <Button
                    onClick={() => handleOpenCreateWorkOrder(issue)}
                    variant="outline"
                    className="border-blue-200 text-blue-700 hover:bg-blue-50"
                    size="sm"
                  >
                    <Factory className="w-4 h-4 mr-2" />
                    Vytvořit PP
                  </Button>
                  <Button
                    onClick={() => handleOpenResolveDialog(issue)}
                    className="bg-gradient-to-r from-green-600 to-green-700"
                    size="sm"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Vyřešit
                  </Button>
                </>
              )}
              {!isResolved && hasWorkOrder && canResolveIssues && (
                 <Button
                    onClick={() => handleOpenResolveDialog(issue)}
                    variant="outline"
                    className="border-green-200 text-green-700 hover:bg-green-50"
                    size="sm"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Vyřešit ručně
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
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Left side - Photo */}
            {issue.photo_url && (
              <div className="flex-shrink-0">
                <img
                  src={issue.photo_url}
                  alt="Fotografie závady"
                  className="w-24 h-24 object-cover rounded-lg border border-slate-200 cursor-pointer hover:opacity-80 transition-opacity shadow-sm"
                  onClick={() => window.open(issue.photo_url, "_blank")}
                />
              </div>
            )}

            {/* Right side - Details */}
            <div className="flex-1 space-y-3">
              <div>
                <p className="text-sm text-slate-900 bg-white p-3 rounded-lg border border-slate-200 whitespace-pre-wrap">
                  {issue.description}
                </p>
              </div>

              <div className="flex items-center gap-4 text-xs text-slate-500 flex-wrap">
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  <span>
                    {format(new Date(issue.created_date), "d. M. yyyy HH:mm", { locale: cs })}
                  </span>
                </div>
                <span>•</span>
                <div className="flex items-center gap-1">
                  <span className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-600">
                    {getUserDisplayName(issue.created_by).charAt(0)}
                  </span>
                  <span>{getUserDisplayName(issue.created_by)}</span>
                </div>
              </div>

              {hasWorkOrder && !isResolved && (
                <div className="mt-2 bg-blue-50 p-2 rounded-md border border-blue-100 flex items-center gap-2 text-sm text-blue-800">
                  <Clock className="w-4 h-4" />
                  <span>
                    Pracovní příkaz byl vytvořen. Závada bude automaticky uzavřena po jeho dokončení.
                  </span>
                </div>
              )}

              {isResolved && (
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
              )}
            </div>
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
              <Activity className="w-4 h-4" />
              Aktivní ({reportedIssues.length})
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

        {/* Dialog pro vytvoření pracovního příkazu */}
        <Dialog open={showCreateWorkOrderDialog} onOpenChange={setShowCreateWorkOrderDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Vytvořit pracovní příkaz (PP)</DialogTitle>
              <DialogDescription>
                Vytvoří nový plánovaný úkol údržby na základě této závady.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
              <div>
                <Label htmlFor="wo_title">Název úkolu</Label>
                <Input
                  id="wo_title"
                  value={workOrderForm.title}
                  onChange={(e) => setWorkOrderForm({ ...workOrderForm, title: e.target.value })}
                />
              </div>
              
              <div>
                <Label htmlFor="wo_desc">Popis práce</Label>
                <Textarea
                  id="wo_desc"
                  value={workOrderForm.description}
                  onChange={(e) => setWorkOrderForm({ ...workOrderForm, description: e.target.value })}
                  rows={4}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="wo_date">Plánované datum</Label>
                  <Input
                    type="date"
                    id="wo_date"
                    value={workOrderForm.planned_date}
                    onChange={(e) => setWorkOrderForm({ ...workOrderForm, planned_date: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="wo_priority">Priorita</Label>
                  <Select
                    value={workOrderForm.priority}
                    onValueChange={(value) => setWorkOrderForm({ ...workOrderForm, priority: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Nízká</SelectItem>
                      <SelectItem value="medium">Střední</SelectItem>
                      <SelectItem value="high">Vysoká</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="wo_assigned">Přiřadit technikovi</Label>
                  <Select
                    value={workOrderForm.assigned_to}
                    onValueChange={(value) => setWorkOrderForm({ ...workOrderForm, assigned_to: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Vyberte technika" />
                    </SelectTrigger>
                    <SelectContent>
                      {allUsers
                        .filter(u => {
                          const issueInfo = selectedIssue ? getIssueInfo(selectedIssue) : null;
                          const targetCompanyId = issueInfo?.companyId;
                          
                          if (!targetCompanyId) return true; // Fallback if no company context

                          // Check if user belongs to or is assigned to the company
                          const isAssigned = u.company_id === targetCompanyId || 
                                           (Array.isArray(u.assigned_company_ids) && u.assigned_company_ids.includes(targetCompanyId));
                          
                          // Check role (allow admin if assigned)
                          const hasRole = u.user_type === "technician" || u.user_type === "manager" || (u.user_type === "admin" && isAssigned);

                          return isAssigned && hasRole;
                        })
                        .map(u => (
                          <SelectItem key={u.id} value={u.email}>
                            {getUserDisplayName(u.email)}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="wo_duration">Odhad času (hodiny)</Label>
                  <Input
                    type="number"
                    id="wo_duration"
                    value={workOrderForm.estimated_duration_hours}
                    onChange={(e) => setWorkOrderForm({ ...workOrderForm, estimated_duration_hours: e.target.value })}
                    step="0.5"
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateWorkOrderDialog(false)}>
                Zrušit
              </Button>
              <Button 
                onClick={() => {
                  // Get machine ID from selected Issue
                  let machineId = selectedIssue.machine_id;
                  if (!machineId && selectedIssue.control_point_id) {
                    const point = controlPoints.find(p => p.id === selectedIssue.control_point_id);
                    machineId = point?.machine_id;
                  }

                  if (!machineId) {
                    alert("Nelze určit stroj pro tento úkol.");
                    return;
                  }

                  createWorkOrderMutation.mutate({
                    ...workOrderForm,
                    machine_id: machineId,
                    issue_id: selectedIssue.id,
                    estimated_duration_hours: workOrderForm.estimated_duration_hours ? parseFloat(workOrderForm.estimated_duration_hours) : null
                  });
                }}
                className="bg-blue-600 hover:bg-blue-700"
                disabled={createWorkOrderMutation.isLoading}
              >
                {createWorkOrderMutation.isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Vytvářím...
                  </>
                ) : (
                  "Vytvořit pracovní příkaz"
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