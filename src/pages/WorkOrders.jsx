import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  ClipboardList,
  Calendar,
  User,
  AlertCircle,
  CheckCircle,
  Clock,
  ArrowRight,
  Building2,
  Briefcase
} from "lucide-react";
import { format } from "date-fns";
import { cs } from "date-fns/locale";

export default function WorkOrders() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);

  const { data: currentUser } = useQuery({
    queryKey: ["currentUser"],
    queryFn: async () => {
      const u = await base44.auth.me();
      setUser(u);
      return u;
    },
  });

  // Fetch necessary data
  const { data: workOrders = [] } = useQuery({
    queryKey: ["allWorkOrders"],
    queryFn: () => base44.entities.PlannedMaintenance.list("-planned_date"),
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
    queryFn: async () => {
      const { data } = await base44.functions.invoke("getUsers");
      return data;
    },
  });

  // Helper to get display name
  const getUserDisplayName = (email) => {
    const u = allUsers.find((user) => user.email === email);
    return u ? u.custom_display_name || u.full_name || u.email : email;
  };

  // Enrich work orders with machine, line, company info
  const enrichedWorkOrders = useMemo(() => {
    return workOrders.map((wo) => {
      const machine = machines.find((m) => m.id === wo.machine_id);
      const line = lines.find((l) => l.id === machine?.line_id);
      const company = companies.find((c) => c.id === line?.company_id);

      return {
        ...wo,
        machineName: machine?.name || "Neznámý stroj",
        lineName: line?.name || "Neznámá linka",
        companyName: company?.name || "Neznámý podnik",
        companyId: company?.id,
      };
    });
  }, [workOrders, machines, lines, companies]);

  // Filter logic based on user role
  const filteredWorkOrders = useMemo(() => {
    if (!currentUser) return [];

    if (currentUser.user_type === "technician") {
      return enrichedWorkOrders.filter(
        (wo) => wo.assigned_to === currentUser.email
      );
    }

    if (currentUser.user_type === "manager") {
      return enrichedWorkOrders.filter(
        (wo) => wo.companyId === currentUser.company_id
      );
    }

    if (currentUser.user_type === "admin") {
      const assignedIds = currentUser.assigned_company_ids || [];
      return enrichedWorkOrders.filter((wo) =>
        assignedIds.includes(wo.companyId)
      );
    }

    if (currentUser.user_type === "superAdmin") {
      return enrichedWorkOrders;
    }

    return [];
  }, [currentUser, enrichedWorkOrders]);

  // Group by company for Admin/SuperAdmin
  const groupedWorkOrders = useMemo(() => {
    if (!currentUser || currentUser.user_type === "technician") return null;

    const grouped = {};
    filteredWorkOrders.forEach((wo) => {
      const cId = wo.companyId || "unknown";
      if (!grouped[cId]) {
        grouped[cId] = {
          name: wo.companyName,
          orders: [],
        };
      }
      grouped[cId].orders.push(wo);
    });
    return grouped;
  }, [filteredWorkOrders, currentUser]);

  // Status Badge helper
  const getStatusBadge = (status, priority) => {
    const priorityColors = {
      low: "bg-slate-100 text-slate-700",
      medium: "bg-blue-100 text-blue-700",
      high: "bg-red-100 text-red-700",
    };

    const statusColors = {
      planned: "bg-slate-100 text-slate-700",
      assigned: "bg-blue-100 text-blue-700",
      in_progress: "bg-orange-100 text-orange-700",
      completed: "bg-green-100 text-green-700",
      cancelled: "bg-red-50 text-red-500",
    };

    const statusLabels = {
      planned: "Naplánováno",
      assigned: "Přiřazeno",
      in_progress: "Probíhá",
      completed: "Dokončeno",
      cancelled: "Zrušeno",
    };

    return (
      <div className="flex gap-2">
        <Badge className={priorityColors[priority] || priorityColors.medium}>
          {priority === "high" ? "Vysoká" : priority === "medium" ? "Střední" : "Nízká"}
        </Badge>
        <Badge className={statusColors[status] || statusColors.planned}>
          {statusLabels[status] || status}
        </Badge>
      </div>
    );
  };

  const renderWorkOrderCard = (wo) => (
    <Card
      key={wo.id}
      className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-blue-500"
      onClick={() => navigate(createPageUrl(`Machine?id=${wo.machine_id}#maintenance`))}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-semibold text-lg text-slate-900 truncate">
                {wo.title}
              </h4>
              {getStatusBadge(wo.status, wo.priority)}
            </div>
            <div className="flex flex-wrap gap-y-1 gap-x-4 text-sm text-slate-500 mb-2">
              <div className="flex items-center gap-1">
                <Building2 className="w-3 h-3" />
                <span>{wo.companyName}</span>
              </div>
              <div className="flex items-center gap-1">
                <ArrowRight className="w-3 h-3" />
                <span>{wo.lineName}</span>
              </div>
              <div className="flex items-center gap-1">
                <ArrowRight className="w-3 h-3" />
                <span className="font-medium text-slate-700">{wo.machineName}</span>
              </div>
            </div>
            <p className="text-sm text-slate-600 line-clamp-2 mb-3">
              {wo.description}
            </p>
            
            <div className="flex items-center gap-4 text-xs text-slate-500">
              <div className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                <span className={new Date(wo.planned_date) < new Date() && wo.status !== 'completed' ? "text-red-600 font-bold" : ""}>
                  Termín: {format(new Date(wo.planned_date), "d. M. yyyy", { locale: cs })}
                </span>
              </div>
              {wo.assigned_to && (
                <div className="flex items-center gap-1">
                  <User className="w-3 h-3" />
                  <span>{getUserDisplayName(wo.assigned_to)}</span>
                </div>
              )}
              {wo.estimated_duration_hours && (
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  <span>{wo.estimated_duration_hours}h</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (!currentUser) return <div className="p-8">Načítání...</div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
              <ClipboardList className="w-8 h-8 text-blue-600" />
              Pracovní příkazy
            </h1>
            <p className="text-slate-600 mt-1">
              {currentUser.user_type === "technician"
                ? "Přehled vašich přiřazených úkolů"
                : "Správa pracovních příkazů a údržby"}
            </p>
          </div>
        </div>

        {/* Technician View - Flat List */}
        {currentUser.user_type === "technician" && (
          <div className="space-y-4">
            {filteredWorkOrders.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-xl shadow-sm border border-dashed border-slate-300">
                <CheckCircle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <h3 className="text-lg font-medium text-slate-900">Žádné aktivní úkoly</h3>
                <p className="text-slate-500">Nemáte přiřazené žádné pracovní příkazy.</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {filteredWorkOrders.map(renderWorkOrderCard)}
              </div>
            )}
          </div>
        )}

        {/* Manager/Admin/SuperAdmin View - Grouped by Company */}
        {currentUser.user_type !== "technician" && groupedWorkOrders && (
          <div className="space-y-6">
            {Object.keys(groupedWorkOrders).length === 0 ? (
              <div className="text-center py-12 bg-white rounded-xl shadow-sm border border-dashed border-slate-300">
                <ClipboardList className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <h3 className="text-lg font-medium text-slate-900">Žádné pracovní příkazy</h3>
                <p className="text-slate-500">V systému nejsou evidovány žádné pracovní příkazy.</p>
              </div>
            ) : (
              <Accordion type="multiple" defaultValue={Object.keys(groupedWorkOrders)} className="space-y-4">
                {Object.entries(groupedWorkOrders).map(([companyId, data]) => (
                  <AccordionItem key={companyId} value={companyId} className="bg-white border rounded-xl px-4 shadow-sm">
                    <AccordionTrigger className="hover:no-underline py-4">
                      <div className="flex items-center gap-3 w-full">
                        <Building2 className="w-5 h-5 text-blue-600" />
                        <span className="font-bold text-lg text-slate-900">{data.name}</span>
                        <Badge variant="secondary" className="ml-auto mr-4">
                          {data.orders.length} úkolů
                        </Badge>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pt-2 pb-6">
                      <div className="grid gap-3">
                        {data.orders.length > 0 ? (
                          data.orders.map(renderWorkOrderCard)
                        ) : (
                          <p className="text-slate-500 italic text-center py-4">Žádné úkoly pro tento podnik.</p>
                        )}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            )}
          </div>
        )}
      </div>
    </div>
  );
}