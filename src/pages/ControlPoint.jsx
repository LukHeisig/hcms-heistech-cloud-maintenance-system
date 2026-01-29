import React, { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  ArrowLeft,
  Droplet,
  Clock,
  AlertTriangle,
  CheckCircle,
  Loader2,
  ClipboardCheck,
  Calendar as CalendarIcon,
  Camera,
  Upload,
  Image as ImageIcon,
  X,
  Plus,
  ChevronRight,
  Building2,
  Factory,
  Settings,
  FileText, // Added for generic files
  FileIcon, // Added for generic files
  FileImage // Added for image files
} from "lucide-react";
import { format } from "date-fns";
import { cs } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useOffline } from "@/components/OfflineProvider";

export default function ControlPoint() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const urlParams = new URLSearchParams(window.location.search);
  const pointId = urlParams.get("id");
  const [isProcessing, setIsProcessing] = useState(false);
  const [showIssueDialog, setShowIssueDialog] = useState(false);
  const [issueDescription, setIssueDescription] = useState("");
  const [isReportingIssue, setIsReportingIssue] = useState(false);
  
  // Změněno z photo-specific na generic doc state
  const [showDocPreviewDialog, setShowDocPreviewDialog] = useState(false);
  const [selectedDocPreview, setSelectedDocPreview] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [deleteDocId, setDeleteDocId] = useState(null); // Změněno z deletePhotoId

  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  const { isOnline, saveAction, getCachedData, setCachedData } = useOffline();

  const { data: point } = useQuery({
    queryKey: ["controlPoint", pointId],
    queryFn: async () => {
      const points = await base44.entities.ControlPoint.filter({ id: pointId });
      return points[0];
    },
    enabled: !!pointId && isOnline,
    initialData: () => {
      const allPoints = getCachedData("allControlPoints") || [];
      return allPoints.find(p => p.id === pointId);
    },
    staleTime: 60000,
  });

  const { data: machine } = useQuery({
    queryKey: ["machine", point?.machine_id],
    queryFn: async () => {
      if (!point?.machine_id) return null;
      const machines = await base44.entities.Machine.filter({ id: point.machine_id });
      return machines[0];
    },
    enabled: !!point?.machine_id,
    staleTime: 60000,
  });

  const { data: line } = useQuery({
    queryKey: ["line", machine?.line_id],
    queryFn: async () => {
      if (!machine?.line_id) return null;
      const lines = await base44.entities.Line.filter({ id: machine.line_id });
      return lines[0];
    },
    enabled: !!machine?.line_id,
    staleTime: 60000,
  });

  const { data: company } = useQuery({
    queryKey: ["company", line?.company_id],
    queryFn: async () => {
      if (!line?.company_id) return null;
      const companies = await base44.entities.Company.filter({ id: line.company_id });
      return companies[0];
    },
    enabled: !!line?.company_id,
    staleTime: 1000 * 60 * 5,
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

  const { data: records = [] } = useQuery({
    queryKey: ["records", pointId],
    queryFn: () =>
      base44.entities.ControlRecord.filter(
        { control_point_id: pointId },
        "-performed_at"
      ),
    enabled: !!pointId && isOnline,
    initialData: () => {
      const allRecords = getCachedData("allRecords") || [];
      return allRecords.filter(r => r.control_point_id === pointId);
    },
  });

  const { data: issues = [] } = useQuery({
    queryKey: ["issues", pointId],
    queryFn: () =>
      base44.entities.Issue.filter({ control_point_id: pointId }),
    enabled: !!pointId && isOnline,
    initialData: () => {
      const allIssues = getCachedData("allIssues") || [];
      return allIssues.filter(i => i.control_point_id === pointId);
    },
  });

  const { data: documentation = [] } = useQuery({
    queryKey: ["documentation", pointId],
    queryFn: () => base44.entities.Documentation.filter({ control_point_id: pointId }),
    enabled: !!pointId,
  });

  const recordMutation = useMutation({
    mutationFn: async (data) => {
      if (!isOnline) {
        saveAction({
          type: "create_control_record",
          payload: data
        });
        // Simulate success for offline
        return { id: "temp_" + Date.now(), ...data };
      }
      return base44.entities.ControlRecord.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["records"] });
      setIsProcessing(false);
    },
    onError: () => {
      setIsProcessing(false);
    },
  });

  const issueMutation = useMutation({
    mutationFn: async (data) => {
      if (!isOnline) {
        // Pass the whole data object including 'photo' (File) to saveAction
        // OfflineProvider will handle serialization of the File object
        await saveAction({
          type: "create_issue",
          payload: {
            ...data,
            photo: data.photo // Ensure photo file is passed
          }
        });
        return { id: "temp_" + Date.now(), ...data };
      }

      // Online flow
      let photoUrl = null;
      if (data.photo) {
        const { file_url } = await base44.integrations.Core.UploadFile({ file: data.photo });
        photoUrl = file_url;
      }
      
      return base44.entities.Issue.create({
        control_point_id: data.control_point_id || null,
        machine_id: data.machine_id || null,
        description: data.description,
        photo_url: photoUrl,
        status: "reported",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["issues"] });
      setShowIssueDialog(false);
      setIssueDescription("");
      setIsReportingIssue(false);
    },
    onError: () => {
      setIsReportingIssue(false);
    },
  });

  const uploadDocumentMutation = useMutation({ // Změněno z uploadPhotoMutation
    mutationFn: async (file) => {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      
      let detectedFileType = "other_file";
      if (file.type.startsWith("image/")) {
        detectedFileType = "photo";
      } else if (file.type === "application/pdf") {
        detectedFileType = "document";
      } else if (file.name.toLowerCase().endsWith(".dwg") || file.name.toLowerCase().endsWith(".dxf")) {
          detectedFileType = "schema";
      } else if (file.type.includes("word") || file.type.includes("excel")) {
          detectedFileType = "document";
      }

      return base44.entities.Documentation.create({
        control_point_id: pointId,
        file_url,
        file_name: file.name,
        file_type: detectedFileType,
        category: "other", // Pro kontrolní body zatím defaultně "other"
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documentation"] });
      setIsUploading(false);
    },
    onError: () => {
      setIsUploading(false);
      alert("Chyba při nahrávání souboru");
    },
  });

  const deleteDocumentMutation = useMutation({ // Změněno z deletePhotoMutation
    mutationFn: (id) => base44.entities.Documentation.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documentation"] });
      setDeleteDocId(null);
      setSelectedDocPreview(null); // Zavřít náhled po smazání
    },
  });

  const getPointStatus = () => {
    const vizType = company?.overdue_visualization_type || "two_colors";
    const tolerance = company?.overdue_tolerance_percent || 4;
    const interval = point?.interval_hours || 0;

    let lastPerformed;
    if (records.length > 0) {
        lastPerformed = new Date(records[0].performed_at);
    } else if (point?.first_confirmation_date) {
        lastPerformed = new Date(point.first_confirmation_date);
    } else {
         return vizType === "traffic_light" ? "critical" : "warning";
    }

    const now = new Date();
    const hoursSince = (now - lastPerformed) / (1000 * 60 * 60);

    if (hoursSince <= interval) return "ok";

    if (vizType === "two_colors") {
        return "warning";
    } else {
        const overduePercent = ((hoursSince - interval) / interval) * 100;
        if (overduePercent <= tolerance) {
            return "warning";
        } else {
            return "critical";
        }
    }
  };

  const getNextControlDate = () => {
    if (!point?.interval_hours) return null;
    
    let lastPerformed;
    if (records.length > 0) {
        lastPerformed = new Date(records[0].performed_at);
    } else if (point?.first_confirmation_date) {
        lastPerformed = new Date(point.first_confirmation_date);
    } else {
        return null;
    }

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
        : point.type === "prevention"
        ? "prevention"
        : "lubrication";

    await recordMutation.mutateAsync({
      control_point_id: point.id,
      record_type: recordType,
      performed_at: new Date().toISOString(),
    });
  };

  const handleReportIssue = async () => {
    if (!issueDescription.trim() || !point) return;
    setIsReportingIssue(true);

    await issueMutation.mutateAsync({
      control_point_id: point.id,
      description: issueDescription,
      status: "reported",
    });
  };

  const handleFileSelect = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    await uploadDocumentMutation.mutateAsync(file);
  };

  const handleCameraCapture = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    await uploadDocumentMutation.mutateAsync(file);
  };

  const getFileIcon = (fileType) => {
    switch (fileType) {
      case "photo":
        return <FileImage className="w-8 h-8 text-blue-500" />;
      case "schema":
        return <FileText className="w-8 h-8 text-purple-500" />;
      case "document":
        return <FileText className="w-8 h-8 text-green-500" />;
      case "other_file":
        return <FileIcon className="w-8 h-8 text-slate-500" />;
      case "application/pdf":
        return <FileText className="w-8 h-8 text-red-500" />;
      case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      case "application/msword":
        return <FileText className="w-8 h-8 text-blue-500" />;
      case "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
      case "application/vnd.ms-excel":
        return <FileText className="w-8 h-8 text-green-500" />;
      case "image/jpeg":
      case "image/png":
      case "image/gif":
        return <FileImage className="w-8 h-8 text-blue-500" />;
      default:
        return <FileIcon className="w-8 h-8 text-slate-500" />;
    }
  };


  if (!point) {
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

  const nfcScanned = urlParams.get("nfc_scanned") === "true";
  const manualConfirmationAllowed = company?.allow_manual_confirmation !== false;
  // Pokud není povoleno manuální potvrzení (globálně nebo pro tento typ bodu) a nebylo naskenováno NFC -> vyžadovat NFC
  const isNfcRequired = (!manualConfirmationAllowed || (point.type === "prevention" && point.prevention_confirmation_method === "nfc")) && !nfcScanned;

  return (
    <div className="p-4 md:p-8 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <Button
          variant="ghost"
          onClick={() => navigate(createPageUrl(`Machine?id=${point.machine_id}`))}
          className="mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Zpět na stroj
        </Button>

        {/* Breadcrumbs */}
        <div className="flex items-center gap-2 text-sm text-slate-600 mb-6 flex-wrap">
          <Building2 className="w-4 h-4" />
          <button
            onClick={() => navigate(createPageUrl(`Lines?company=${company?.id}`))}
            className="hover:text-slate-900 transition-colors"
          >
            {company?.name || "Podnik"}
          </button>
          <ChevronRight className="w-4 h-4 text-slate-400" />
          <button
            onClick={() => navigate(createPageUrl(`Lines?company=${company?.id}&line=${line?.id}`))}
            className="hover:text-slate-900 transition-colors"
          >
            {line?.name || "Linka"}
          </button>
          <ChevronRight className="w-4 h-4 text-slate-400" />
          <button
            onClick={() => navigate(createPageUrl(`Machine?id=${machine?.id}`))}
            className="hover:text-slate-900 transition-colors"
          >
            {machine?.name || "Stroj"}
          </button>
          <ChevronRight className="w-4 h-4 text-slate-400" />
          <span className="font-semibold text-slate-900">
            {point.number && `${point.number} - `}{point.name}
          </span>
        </div>

        {/* Hlavní karta s vším obsahem */}
        <Card className="shadow-xl">
          {/* Header s ikonou a názvem */}
          <CardHeader className="border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white pb-6">
            <div className="flex items-start gap-6">
              <div
                className={`w-16 h-16 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg ${
                  status === "critical"
                    ? "bg-gradient-to-br from-red-500 to-red-600"
                    : status === "warning" || status === "overdue" 
                    ? "bg-gradient-to-br from-yellow-500 to-yellow-600" 
                    : "bg-gradient-to-br from-green-500 to-green-600"
                }`}
              >
                {point.type === "inspection" ? (
                  <ClipboardCheck className="w-8 h-8 text-white" />
                ) : (
                  <Droplet className="w-8 h-8 text-white" />
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2 flex-wrap">
                  <h1 className="text-2xl font-bold text-slate-900">
                    {point.number && `${point.number} - `}
                    {point.name}
                  </h1>
                  {(status === "warning" || status === "overdue") && (
                    <Badge
                      variant="outline"
                      className="gap-1 bg-yellow-100 text-yellow-800 border-yellow-300"
                    >
                      <Clock className="w-3 h-3" />
                      Po termínu
                    </Badge>
                  )}
                  {status === "critical" && (
                    <Badge
                      variant="outline"
                      className="gap-1 bg-red-100 text-red-800 border-red-300"
                    >
                      <Clock className="w-3 h-3" />
                      KRITICKÉ
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
                  <p className="text-slate-600 mb-3">{point.description}</p>
                )}
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline">{machine?.name || "Stroj"}</Badge>
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
          </CardHeader>

          <CardContent className="p-8">
            {/* Aktivní závady - hned nahoře pokud existují */}
            {activeIssues.length > 0 && (
              <div className="mb-8 p-6 rounded-xl bg-orange-50 border-2 border-orange-200">
                <div className="flex items-center gap-2 mb-4">
                  <AlertTriangle className="w-5 h-5 text-orange-700" />
                  <h3 className="text-lg font-bold text-orange-900">
                    Aktivní závady ({activeIssues.length})
                  </h3>
                </div>
                <div className="space-y-3">
                  {activeIssues.map((issue) => (
                    <div
                      key={issue.id}
                      className="p-4 rounded-lg bg-white border border-orange-200"
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
                        {getUserDisplayName(issue.created_by)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Parametry a informace */}
            <div className="grid md:grid-cols-2 gap-8 mb-8">
              {/* Levý sloupec */}
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">
                    Parametry
                  </h3>
                  <div className="space-y-4">
                    {point.type === "lubrication" && (
                      <>
                        <div>
                          <p className="text-xs text-slate-500 mb-1">Mazivo</p>
                          <p className="text-lg font-semibold text-slate-900">
                            {point.lubricant_type || "-"}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500 mb-1">Množství</p>
                          <p className="text-lg font-semibold text-slate-900">
                            {point.lubricant_amount
                              ? `${point.lubricant_amount} g`
                              : "-"}
                          </p>
                        </div>
                      </>
                    )}
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Interval</p>
                      <p className="text-lg font-semibold text-slate-900">
                        {point.interval_hours ? `${point.interval_hours} h` : "-"}
                      </p>
                    </div>
                    {point.first_confirmation_date && (
                      <div>
                        <p className="text-xs text-slate-500 mb-1">Datum prvního potvrzení</p>
                        <p className="text-lg font-semibold text-slate-900">
                          {format(new Date(point.first_confirmation_date), "d. M. yyyy HH:mm", { locale: cs })}
                        </p>
                      </div>
                    )}
                    {point.type === "inspection" && point.inspection_tasks && (
                      <div>
                        <p className="text-xs text-slate-500 mb-2">
                          Úkoly k provedení
                        </p>
                        <p className="text-sm text-slate-900 whitespace-pre-wrap bg-slate-50 p-3 rounded-lg">
                          {point.inspection_tasks}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Pravý sloupec */}
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">
                    Plán kontrol
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <p className="text-xs text-slate-500 mb-1">
                        {point.type === "auto_lubricator" 
                          ? "Poslední výměna" 
                          : point.type === "inspection"
                          ? "Poslední kontrola"
                          : "Poslední mazání"}
                      </p>
                      <p className="text-lg font-semibold text-slate-900">
                        {records.length > 0
                          ? format(
                              new Date(records[0].performed_at),
                              "d. M. yyyy HH:mm",
                              { locale: cs }
                            )
                          : "Dosud neprovedeno"}
                      </p>
                    </div>
                    {nextDate && (
                      <div>
                        <p className="text-xs text-slate-500 mb-1">
                          {point.type === "auto_lubricator" 
                            ? "Následující výměna" 
                            : point.type === "inspection"
                            ? "Následující kontrola"
                            : "Následující mazání"}
                        </p>
                        <p className={`text-lg font-semibold ${
                          status === "critical" ? "text-red-700" : (status === "warning" || status === "overdue" ? "text-yellow-700" : "text-slate-900")
                        }`}>
                          {format(nextDate, "d. M. yyyy", { locale: cs })}
                          {(status === "warning" || status === "overdue") && (
                            <Badge variant="outline" className="ml-2 bg-yellow-100 text-yellow-800 border-yellow-300">
                              Po termínu
                            </Badge>
                          )}
                          {status === "critical" && (
                            <Badge variant="outline" className="ml-2 bg-red-100 text-red-800 border-red-300">
                              KRITICKÉ
                            </Badge>
                          )}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Tlačítka pro akce */}
            <div className="mb-8 grid grid-cols-1 md:grid-cols-2 gap-4">
              {isNfcRequired ? (
                <div className="h-14 flex items-center justify-center bg-slate-100 border-2 border-slate-200 rounded-lg text-slate-500 font-medium">
                  <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                    <path d="M12 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
                    <path d="M12 13v4" />
                    <path d="M10 15h4" />
                  </svg>
                  Nutné potvrzení přes NFC
                </div>
              ) : (
                <Button
                  onClick={handleConfirmRecord}
                  disabled={isProcessing}
                  className={`h-14 text-lg shadow-lg ${
                    point.type === "inspection"
                      ? "bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800"
                      : point.type === "prevention"
                      ? "bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800"
                      : point.type === "auto_lubricator"
                      ? "bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
                      : "bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800"
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
                      ) : point.type === "prevention" ? (
                        <>
                          <ClipboardCheck className="w-5 h-5 mr-2" />
                          Potvrdit preventivní údržbu
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
              )}

              <Button
                variant="outline"
                onClick={() => setShowIssueDialog(true)}
                className="h-14 text-lg border-2 border-orange-300 text-orange-700 hover:bg-orange-50 hover:text-orange-800 hover:border-orange-400"
              >
                <AlertTriangle className="w-5 h-5 mr-2" />
                Nahlásit závadu
              </Button>
            </div>

            {/* Dokumentace */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-slate-600" />
                  <h3 className="text-lg font-bold text-slate-900">
                    Dokumentace
                  </h3>
                </div>
                <div className="flex gap-2">
                  <input
                    ref={cameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleCameraCapture}
                    className="hidden"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => cameraInputRef.current?.click()}
                    disabled={isUploading}
                  >
                    <Camera className="w-4 h-4 mr-2" />
                    Vyfotit
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.dwg,.dxf"
                    multiple
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Nahrát
                  </Button>
                </div>
              </div>

              {isUploading && (
                <div className="flex items-center justify-center py-8 bg-slate-50 rounded-lg mb-4">
                  <Loader2 className="w-6 h-6 animate-spin text-slate-400 mr-2" />
                  <span className="text-slate-600">Nahrávání souboru...</span>
                </div>
              )}

              {documentation.length === 0 && !isUploading ? (
                <div className="text-center py-12 bg-slate-50 rounded-lg">
                  <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500 mb-2">Zatím není žádná dokumentace</p>
                  <p className="text-sm text-slate-400">
                    Použijte tlačítka výše pro přidání dokumentů nebo fotek
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {documentation.map((doc) => (
                    <div
                      key={doc.id}
                      className="group relative aspect-square rounded-lg overflow-hidden border-2 border-slate-200 hover:border-slate-400 transition-all cursor-pointer"
                      onClick={() => {
                        setSelectedDocPreview(doc);
                        setShowDocPreviewDialog(true);
                      }}
                    >
                      {doc.file_type === "photo" ? (
                        <img
                          src={doc.file_url}
                          alt={doc.file_name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                          <div className="flex flex-col items-center justify-center h-full bg-slate-100 p-2">
                              {getFileIcon(doc.file_type)}
                              <p className="text-xs text-slate-600 mt-2 text-center w-full truncate px-1" title={doc.file_name}>{doc.file_name}</p>
                          </div>
                      )}
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-all flex items-center justify-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="opacity-0 group-hover:opacity-100 transition-opacity bg-red-600 hover:bg-red-700 text-white"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteDocId(doc.id);
                          }}
                        >
                          <X className="w-5 h-5" />
                        </Button>
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                        <p className="text-xs text-white/70 text-right">
                          {format(new Date(doc.created_date), "d. M. yyyy", { locale: cs })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Historie záznamů */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <CalendarIcon className="w-5 h-5 text-slate-600" />
                <h3 className="text-lg font-bold text-slate-900">
                  Historie záznamů
                </h3>
              </div>
              {records.length === 0 ? (
                <div className="text-center py-8 bg-slate-50 rounded-lg">
                  <p className="text-slate-500">Zatím nejsou žádné záznamy</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {records.map((record) => (
                    <div
                      key={record.id}
                      className="flex items-start gap-4 p-4 rounded-lg bg-slate-50 border border-slate-200 hover:bg-slate-100 transition-colors"
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
                          {getUserDisplayName(record.created_by)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Dialog pro zobrazení/náhled dokumentu */}
        <Dialog open={showDocPreviewDialog} onOpenChange={setShowDocPreviewDialog}>
          <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>{selectedDocPreview?.file_name}</DialogTitle>
              <DialogDescription>
                Nahráno {selectedDocPreview && format(new Date(selectedDocPreview.created_date), "d. M. yyyy HH:mm", { locale: cs })}
                {selectedDocPreview?.created_by && ` • ${getUserDisplayName(selectedDocPreview.created_by)}`}
              </DialogDescription>
            </DialogHeader>
            <div className="flex-1 flex items-center justify-center overflow-auto p-4 bg-slate-50 rounded-md">
              {selectedDocPreview?.file_type === "photo" ? (
                <img
                  src={selectedDocPreview.file_url}
                  alt={selectedDocPreview.file_name}
                  className="max-w-full max-h-full object-contain"
                />
              ) : selectedDocPreview?.file_type === "document" && selectedDocPreview.file_url.endsWith(".pdf") ? (
                <iframe
                  src={selectedDocPreview.file_url}
                  title={selectedDocPreview.file_name}
                  className="w-full h-full border-none"
                />
              ) : (
                <div className="text-center">
                  {getFileIcon(selectedDocPreview?.file_type)}
                  <p className="text-slate-600 mt-4">Náhled pro tento typ souboru není dostupný.</p>
                  <p className="text-sm text-slate-500">Můžete jej otevřít v nové záložce.</p>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => window.open(selectedDocPreview?.file_url, "_blank")}
              >
                Otevřít v nové záložce
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  setShowDocPreviewDialog(false);
                  setDeleteDocId(selectedDocPreview?.id);
                }}
              >
                <X className="w-4 h-4 mr-2" />
                Smazat
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Alert dialog pro smazání dokumentu */}
        <AlertDialog
          open={!!deleteDocId}
          onOpenChange={() => setDeleteDocId(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Opravdu smazat dokument?</AlertDialogTitle>
              <AlertDialogDescription>
                Tato akce je nevratná. Dokument bude trvale odstraněn.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Zrušit</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteDocumentMutation.mutate(deleteDocId)}
                className="bg-red-600 hover:bg-red-700"
              >
                Smazat
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Dialog pro hlášení závady */}
        <Dialog open={showIssueDialog} onOpenChange={setShowIssueDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-orange-700">
                <AlertTriangle className="w-5 h-5" />
                Nahlásit závadu
              </DialogTitle>
              <DialogDescription>
                Popište zjištěnou závadu na kontrolním bodě "{point?.name || ''}"
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="description">Popis závady *</Label>
                <Textarea
                  id="description"
                  value={issueDescription}
                  onChange={(e) => setIssueDescription(e.target.value)}
                  placeholder="Popište podrobně zjištěnou závadu..."
                  rows={5}
                  className="mt-2"
                />
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-900">
                  <strong>Tip:</strong> Uveďte co nejvíce detailů - co jste zjistili, 
                  jaký je stav, co je potřeba opravit, atd.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowIssueDialog(false);
                  setIssueDescription("");
                }}
                disabled={isReportingIssue}
              >
                Zrušit
              </Button>
              <Button
                onClick={handleReportIssue}
                disabled={!issueDescription.trim() || isReportingIssue}
                className="bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800"
              >
                {isReportingIssue ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Ukládání...
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-4 h-4 mr-2" />
                    Nahlásit závadu
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