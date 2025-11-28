import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  AlertTriangle,
  CheckCircle,
  Clock,
  Factory,
  User,
  Calendar,
  FileText,
  ChevronRight,
  Building2,
  Activity,
  Wrench,
  ArrowRight,
  Loader2
} from "lucide-react";
import { format } from "date-fns";
import { cs } from "date-fns/locale";

export default function IssueDetail() {
  const navigate = useNavigate();
  const urlParams = new URLSearchParams(window.location.search);
  const issueId = urlParams.get("id");
  const [user, setUser] = useState(null);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    const currentUser = await base44.auth.me();
    setUser(currentUser);
  };

  const { data: issue, isLoading } = useQuery({
    queryKey: ["issue", issueId],
    queryFn: async () => {
      const res = await base44.entities.Issue.filter({ id: issueId });
      return res[0];
    },
    enabled: !!issueId,
  });

  const { data: workOrder } = useQuery({
    queryKey: ["workOrder", issue?.planned_maintenance_id],
    queryFn: async () => {
      if (!issue?.planned_maintenance_id) return null;
      const res = await base44.entities.PlannedMaintenance.filter({ id: issue.planned_maintenance_id });
      return res[0];
    },
    enabled: !!issue?.planned_maintenance_id,
  });

  const { data: maintenanceRecord } = useQuery({
    queryKey: ["maintenanceRecord", workOrder?.maintenance_record_id],
    queryFn: async () => {
      if (!workOrder?.maintenance_record_id) return null;
      const res = await base44.entities.MaintenanceRecord.filter({ id: workOrder.maintenance_record_id });
      return res[0];
    },
    enabled: !!workOrder?.maintenance_record_id,
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ["allUsers"],
    queryFn: () => base44.entities.User.list(),
  });

  // Fetch related entities for context
  const { data: controlPoint } = useQuery({
    queryKey: ["controlPoint", issue?.control_point_id],
    queryFn: async () => {
      if (!issue?.control_point_id) return null;
      const res = await base44.entities.ControlPoint.filter({ id: issue.control_point_id });
      return res[0];
    },
    enabled: !!issue?.control_point_id,
  });

  const { data: machine } = useQuery({
    queryKey: ["machine", issue?.machine_id || controlPoint?.machine_id],
    queryFn: async () => {
      const mId = issue?.machine_id || controlPoint?.machine_id;
      if (!mId) return null;
      const res = await base44.entities.Machine.filter({ id: mId });
      return res[0];
    },
    enabled: !!issue?.machine_id || !!controlPoint?.machine_id,
  });

  const { data: line } = useQuery({
    queryKey: ["line", machine?.line_id],
    queryFn: async () => {
      if (!machine?.line_id) return null;
      const res = await base44.entities.Line.filter({ id: machine.line_id });
      return res[0];
    },
    enabled: !!machine?.line_id,
  });

  const { data: company } = useQuery({
    queryKey: ["company", line?.company_id],
    queryFn: async () => {
      if (!line?.company_id) return null;
      const res = await base44.entities.Company.filter({ id: line.company_id });
      return res[0];
    },
    enabled: !!line?.company_id,
  });

  const getUserDisplayName = (email) => {
    const u = allUsers.find(user => user.email === email);
    return u ? (u.custom_display_name || u.full_name || u.email) : email;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!issue) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4">
        <AlertTriangle className="w-16 h-16 text-slate-300 mb-4" />
        <h1 className="text-xl font-bold text-slate-900">Závada nenalezena</h1>
        <Button onClick={() => navigate(createPageUrl("Dashboard"))} className="mt-4">
          Zpět na Dashboard
        </Button>
      </div>
    );
  }

  // Timeline Steps
  const steps = [
    {
      id: "reported",
      title: "Nahlášeno",
      date: issue.created_date,
      user: issue.created_by,
      status: "completed",
      icon: AlertTriangle,
      description: "Závada byla zjištěna a nahlášena do systému."
    },
    {
      id: "work_order",
      title: "Pracovní příkaz",
      date: workOrder?.created_date || (issue.status === "work_order_created" ? issue.updated_date : null),
      user: null, // System or Manager
      status: workOrder ? "completed" : (issue.status === "reported" ? "pending" : "skipped"),
      icon: FileText,
      description: workOrder ? `Vytvořen příkaz "${workOrder.title}" pro technika.` : "Čeká na vytvoření pracovního příkazu nebo přímé vyřešení."
    },
    {
      id: "execution",
      title: "Realizace",
      date: maintenanceRecord?.performed_at || (workOrder?.status === "completed" ? workOrder.completed_at : null),
      user: maintenanceRecord?.technician,
      status: maintenanceRecord || workOrder?.status === "completed" ? "completed" : (workOrder ? "in_progress" : "pending"),
      icon: Wrench,
      description: maintenanceRecord ? "Údržba byla provedena a zaznamenána." : (workOrder ? "Technik pracuje na odstranění závady." : "Čeká na zahájení prací.")
    },
    {
      id: "resolved",
      title: "Vyřešeno",
      date: issue.resolved_at,
      user: issue.resolved_by,
      status: issue.status === "resolved" ? "completed" : "pending",
      icon: CheckCircle,
      description: issue.status === "resolved" ? `Závada byla uzavřena. ${issue.resolution_note || ""}` : "Závada je stále aktivní."
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50 pb-12">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4 mb-4">
            <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Zpět
            </Button>
            <div className="flex items-center gap-2 text-sm text-slate-500">
               <Building2 className="w-3 h-3" />
               <span>{company?.name}</span>
               <ChevronRight className="w-3 h-3" />
               <span>{line?.name}</span>
               <ChevronRight className="w-3 h-3" />
               <span className="font-medium text-slate-900">{machine?.name}</span>
            </div>
          </div>
          
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
             <div>
                <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
                   {issue.status === "resolved" ? (
                     <CheckCircle className="w-6 h-6 text-green-600" />
                   ) : (
                     <AlertTriangle className="w-6 h-6 text-orange-600" />
                   )}
                   {controlPoint ? `${controlPoint.name} - Závada` : "Závada na stroji"}
                </h1>
                <p className="text-slate-500 mt-1">ID: {issue.id}</p>
             </div>
             
             <div className="flex items-center gap-2">
                <Badge className={
                   issue.status === 'resolved' ? "bg-green-100 text-green-800 hover:bg-green-100 text-sm px-3 py-1" : 
                   issue.status === 'work_order_created' ? "bg-blue-100 text-blue-800 hover:bg-blue-100 text-sm px-3 py-1" : 
                   "bg-orange-100 text-orange-800 hover:bg-orange-100 text-sm px-3 py-1"
                }>
                   {issue.status === 'resolved' ? 'Vyřešeno' : 
                    issue.status === 'work_order_created' ? 'V řešení (PP Vytvořen)' : 
                    'Nahlášeno'}
                </Badge>
             </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        
        {/* 1. Detail závady */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
           {/* Left Column: Image & Basic Info */}
           <div className="md:col-span-1 space-y-6">
              <Card>
                 <CardContent className="p-4">
                    {issue.photo_url ? (
                       <div className="aspect-square rounded-lg overflow-hidden bg-slate-100 border border-slate-200 mb-4 cursor-pointer" onClick={() => window.open(issue.photo_url, '_blank')}>
                          <img src={issue.photo_url} alt="Závada" className="w-full h-full object-cover hover:scale-105 transition-transform duration-300" />
                       </div>
                    ) : (
                       <div className="aspect-square rounded-lg bg-slate-100 border border-slate-200 mb-4 flex items-center justify-center text-slate-400">
                          <div className="text-center">
                             <Factory className="w-12 h-12 mx-auto mb-2" />
                             <span className="text-sm">Bez fotografie</span>
                          </div>
                       </div>
                    )}
                    
                    <div className="space-y-3">
                       <div>
                          <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Datum nahlášení</p>
                          <div className="flex items-center gap-2 mt-1">
                             <Calendar className="w-4 h-4 text-slate-400" />
                             <span className="text-sm font-medium">{format(new Date(issue.created_date), "d. M. yyyy HH:mm", { locale: cs })}</span>
                          </div>
                       </div>
                       <Separator />
                       <div>
                          <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Nahlásil</p>
                          <div className="flex items-center gap-2 mt-1">
                             <User className="w-4 h-4 text-slate-400" />
                             <span className="text-sm font-medium">{getUserDisplayName(issue.created_by)}</span>
                          </div>
                       </div>
                       <Separator />
                       <div>
                          <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Lokace</p>
                          <p className="text-sm font-medium mt-1">{controlPoint?.name || machine?.name}</p>
                          {controlPoint && <p className="text-xs text-slate-500">{machine?.name}</p>}
                       </div>
                    </div>
                 </CardContent>
              </Card>
           </div>

           {/* Right Column: Workflow & Description */}
           <div className="md:col-span-2 space-y-6">
              {/* Workflow Visualization */}
              <Card>
                 <CardHeader className="pb-4">
                    <CardTitle className="text-lg">Průběh řešení</CardTitle>
                 </CardHeader>
                 <CardContent>
                    <div className="relative">
                       {/* Connecting Line */}
                       <div className="absolute left-6 top-6 bottom-6 w-0.5 bg-slate-200"></div>
                       
                       <div className="space-y-8 relative">
                          {steps.map((step, index) => {
                             const isCompleted = step.status === 'completed';
                             const isInProgress = step.status === 'in_progress';
                             const isPending = step.status === 'pending';
                             
                             return (
                                <div key={step.id} className="flex gap-4 group">
                                   {/* Icon */}
                                   <div className={`
                                      w-12 h-12 rounded-full flex items-center justify-center border-4 z-10 transition-colors duration-300
                                      ${isCompleted ? 'bg-green-100 border-white text-green-600 ring-2 ring-green-100' : 
                                        isInProgress ? 'bg-blue-100 border-white text-blue-600 ring-2 ring-blue-100 animate-pulse' : 
                                        'bg-slate-100 border-white text-slate-300'}
                                   `}>
                                      <step.icon className="w-5 h-5" />
                                   </div>
                                   
                                   {/* Content */}
                                   <div className={`flex-1 pt-1 ${isPending ? 'opacity-50' : ''}`}>
                                      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-1">
                                         <h3 className={`font-bold text-base ${isCompleted ? 'text-green-700' : isInProgress ? 'text-blue-700' : 'text-slate-700'}`}>
                                            {step.title}
                                         </h3>
                                         {step.date && (
                                            <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded-full">
                                               {format(new Date(step.date), "d. M. yyyy HH:mm", { locale: cs })}
                                            </span>
                                         )}
                                      </div>
                                      <p className="text-sm text-slate-600 mb-1">{step.description}</p>
                                      {step.user && (
                                         <p className="text-xs text-slate-400 flex items-center gap-1">
                                            <User className="w-3 h-3" />
                                            {getUserDisplayName(step.user)}
                                         </p>
                                      )}
                                      
                                      {/* Context specific content */}
                                      {step.id === 'work_order' && workOrder && (
                                         <div className="mt-3 bg-blue-50 p-3 rounded-lg border border-blue-100">
                                            <div className="flex items-center justify-between">
                                               <div>
                                                  <p className="font-semibold text-sm text-blue-900">{workOrder.title}</p>
                                                  <p className="text-xs text-blue-700">Přiřazeno: {getUserDisplayName(workOrder.assigned_to)}</p>
                                               </div>
                                               {workOrder.status !== 'completed' && (
                                                  <Badge variant="outline" className="bg-white border-blue-200 text-blue-700">
                                                     {workOrder.priority === 'high' ? 'Vysoká priorita' : 'Standardní'}
                                                  </Badge>
                                               )}
                                            </div>
                                         </div>
                                      )}

                                      {step.id === 'execution' && maintenanceRecord && (
                                         <div className="mt-3 bg-green-50 p-3 rounded-lg border border-green-100">
                                            <p className="text-sm text-green-900 mb-1 font-medium">Záznam o údržbě:</p>
                                            <p className="text-sm text-green-800 italic">"{maintenanceRecord.notes || maintenanceRecord.description}"</p>
                                            <div className="flex gap-4 mt-2 text-xs text-green-700">
                                               <span>Trvání: {maintenanceRecord.duration_hours}h</span>
                                               {maintenanceRecord.cost > 0 && <span>Náklady: {maintenanceRecord.cost} Kč</span>}
                                            </div>
                                         </div>
                                      )}
                                   </div>
                                </div>
                             );
                          })}
                       </div>
                    </div>
                 </CardContent>
              </Card>

              {/* Description Card */}
              <Card>
                 <CardHeader>
                    <CardTitle className="text-lg">Popis problému</CardTitle>
                 </CardHeader>
                 <CardContent>
                    <p className="text-slate-700 whitespace-pre-wrap leading-relaxed">
                       {issue.description}
                    </p>
                 </CardContent>
              </Card>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3">
                  {issue.status !== 'resolved' && !workOrder && (user?.user_type === 'manager' || user?.user_type === 'admin' || user?.user_type === 'superAdmin') && (
                     <Button onClick={() => navigate(createPageUrl(`IssueApproval?issue=${issue.id}&action=create_wo`))} className="bg-blue-600 hover:bg-blue-700">
                        <FileText className="w-4 h-4 mr-2" />
                        Vytvořit pracovní příkaz
                     </Button>
                  )}
                  {issue.status !== 'resolved' && (user?.user_type === 'manager' || user?.user_type === 'admin' || user?.user_type === 'superAdmin') && (
                     <Button onClick={() => navigate(createPageUrl(`IssueApproval?issue=${issue.id}&action=resolve`))} variant="outline" className="border-green-600 text-green-600 hover:bg-green-50">
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Vyřešit
                     </Button>
                  )}
              </div>
           </div>
        </div>

      </div>
    </div>
  );
}