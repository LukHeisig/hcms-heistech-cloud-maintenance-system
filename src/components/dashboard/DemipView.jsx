import React, { useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/utils";
import {
  AlertTriangle,
  Droplet,
  ClipboardCheck,
  Activity,
  ChevronRight,
  Clock,
  ArrowLeft,
  Building2,
  Factory,
  FileText,
  Image as ImageIcon,
  Camera,
  Upload,
  X,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { format } from "date-fns";
import { cs } from "date-fns/locale";

export default function DemipView({
  user,
  activeCompanies,
  allLines,
  lines,
  machines,
  activeControlPoints,
  controlPoints,
  activeIssues,
  issues,
  records,
  getPointStatus,
  getNextControlDate,
  getUserDisplayName,
  allCompanies,
  showIssueDialog,
  setShowIssueDialog,
  issueDescription,
  setIssueDescription,
  isReportingIssue,
  handleReportIssue,
  showDocPreviewDialog,
  setShowDocPreviewDialog,
  selectedDocPreview,
  setSelectedDocPreview,
  isUploading,
  deleteDocId,
  setDeleteDocId,
  handleFileSelect,
  handleCameraCapture,
  deleteDocumentMutation,
}) {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  const urlParams = new URLSearchParams(window.location.search);
  const selectedCompany = urlParams.get('company');
  const selectedLine = urlParams.get('line');
  const selectedMachine = urlParams.get('machine');
  const selectedPoint = urlParams.get('point');

  const demipCompanies = (user?.user_type === "admin" || user?.user_type === "superAdmin")
    ? activeCompanies
    : [];

  const demipAllLines = (user?.user_type === "admin" || user?.user_type === "superAdmin")
    ? allLines
    : lines;

  const demipMachines = (user?.user_type === "admin" || user?.user_type === "superAdmin")
    ? machines
    : machines.filter(m => lines.some(l => l.id === m.line_id));

  const demipControlPoints = (user?.user_type === "admin" || user?.user_type === "superAdmin")
    ? activeControlPoints
    : controlPoints;

  const demipIssues = (user?.user_type === "admin" || user?.user_type === "superAdmin")
    ? activeIssues
    : issues;

  // Point detail view
  if (selectedPoint) {
    const currentPoint = demipControlPoints.find(p => p.id === selectedPoint);
    if (!currentPoint) {
      return <div className="p-8">Kontrolní bod nenalezen</div>;
    }

    const pointRecords = records.filter(r => r.control_point_id === selectedPoint);
    const pointIssues = demipIssues.filter(i => i.control_point_id === selectedPoint);
    const status = getPointStatus(currentPoint);
    const nextDate = getNextControlDate(currentPoint);
    const lastRecord = pointRecords[0];
    const isOverdue = status === "overdue";

    const { data: documentation = [] } = useQuery({
      queryKey: ["documentation", selectedPoint],
      queryFn: () => base44.entities.Documentation.filter({ control_point_id: selectedPoint }),
      enabled: !!selectedPoint,
    });

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg">
          <div className="max-w-5xl mx-auto p-3 md:p-6">
            <div className="flex items-center justify-between mb-2 md:mb-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const url = selectedCompany
                    ? `Dashboard?company=${selectedCompany}&line=${selectedLine}&machine=${selectedMachine}`
                    : `Dashboard?line=${selectedLine}&machine=${selectedMachine}`;
                  navigate(createPageUrl(url));
                }}
                className="text-white hover:bg-white/20 p-2 h-auto"
              >
                <ArrowLeft className="w-4 h-4 md:w-5 md:h-5" />
              </Button>
              {pointIssues.length > 0 && (
                <AlertTriangle className="w-6 h-6 md:w-8 md:h-8 text-yellow-300" />
              )}
            </div>
            <h1 className="text-lg md:text-2xl font-bold leading-tight">
              {currentPoint.number && `${currentPoint.number} - `}
              {currentPoint.name}
            </h1>
          </div>
        </div>

        <div className="max-w-5xl mx-auto p-3 md:p-6 space-y-3 md:space-y-4">
          {/* ... rest of point detail content ... */}
        </div>

        {/* Dialogs */}
        <Dialog open={showDocPreviewDialog} onOpenChange={setShowDocPreviewDialog}>
          {/* ... dialog content ... */}
        </Dialog>

        <AlertDialog open={!!deleteDocId} onOpenChange={() => setDeleteDocId(null)}>
          {/* ... alert dialog content ... */}
        </AlertDialog>

        <Dialog open={showIssueDialog} onOpenChange={setShowIssueDialog}>
          {/* ... issue dialog content ... */}
        </Dialog>
      </div>
    );
  }

  // Company selection
  if ((user?.user_type === "admin" || user?.user_type === "superAdmin") && !selectedCompany) {
    return (
      <div className="p-4 md:p-8 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold text-slate-900 mb-6">Výběr podniku - DEMIP</h1>
          <div className="space-y-2">
            {demipCompanies.map((company) => {
              const companyLines = demipAllLines.filter(l => l.company_id === company.id);
              const companyLineIds = companyLines.map(l => l.id);
              const companyMachines = demipMachines.filter(m => companyLineIds.includes(m.line_id));
              const companyMachineIds = companyMachines.map(m => m.id);
              const companyPoints = demipControlPoints.filter(p => companyMachineIds.includes(p.machine_id));
              const companyOverdue = companyPoints.filter(p => getPointStatus(p) === "overdue").length;

              return (
                <Card
                  key={company.id}
                  className="cursor-pointer transition-all hover:shadow-md border-l-4 border-l-blue-500"
                  onClick={() => navigate(createPageUrl(`Dashboard?company=${company.id}`))}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 flex-1">
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-blue-100">
                          <Building2 className="w-5 h-5 text-blue-700" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-bold text-slate-900 text-base">{company.name}</h3>
                            {companyOverdue > 0 && (
                              <Badge variant="destructive" className="gap-1">
                                <Clock className="w-3 h-3" />
                                {companyOverdue}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-4 text-sm text-slate-600">
                            <span>{companyLines.length} linek</span>
                            <span>·</span>
                            <span>{companyPoints.length} bodů</span>
                          </div>
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-slate-400" />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // Line selection
  if (!selectedLine) {
    const companyId = selectedCompany || user?.company_id;
    const currentCompany = [...demipCompanies, ...allCompanies].find(c => c.id === companyId);
    const companyLines = demipAllLines.filter(l => l.company_id === companyId);

    return (
      <div className="p-4 md:p-8 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
        <div className="max-w-4xl mx-auto">
          {(user?.user_type === "admin" || user?.user_type === "superAdmin") && (
            <Button
              variant="ghost"
              onClick={() => navigate(createPageUrl("Dashboard"))}
              className="mb-4"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Zpět na podniky
            </Button>
          )}
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Výběr linky - DEMIP</h1>
          {currentCompany && <p className="text-slate-600 mb-6">{currentCompany.name}</p>}
          {/* ... line cards ... */}
        </div>
      </div>
    );
  }

  // Machine selection
  if (!selectedMachine) {
    return <div>Machine selection view</div>;
  }

  // Points list view
  return <div>Points list view</div>;
}