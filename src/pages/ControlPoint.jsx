
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
  Plus, // Added from outline
  ChevronRight, // Added from outline
  Building2, // Added from outline
  Factory, // Added from outline
  Settings // Added from outline
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
  const [showIssueDialog, setShowIssueDialog] = useState(false);
  const [issueDescription, setIssueDescription] = useState("");
  const [isReportingIssue, setIsReportingIssue] = useState(false);
  const [showPhotoDialog, setShowPhotoDialog] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [deletePhotoId, setDeletePhotoId] = useState(null);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

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

  const { data: line } = useQuery({
    queryKey: ["line", machine?.line_id],
    queryFn: async () => {
      if (!machine?.line_id) return null;
      const lines = await base44.entities.Line.list();
      return lines.find((l) => l.id === machine.line_id);
    },
    enabled: !!machine?.line_id,
  });

  const { data: company } = useQuery({
    queryKey: ["company", line?.company_id],
    queryFn: async () => {
      if (!line?.company_id) return null;
      const companies = await base44.entities.Company.list();
      return companies.find((c) => c.id === line.company_id);
    },
    enabled: !!line?.company_id,
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

  const { data: documentation = [] } = useQuery({
    queryKey: ["documentation", pointId],
    queryFn: () => base44.entities.Documentation.filter({ control_point_id: pointId }),
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

  const issueMutation = useMutation({
    mutationFn: (data) => base44.entities.Issue.create(data),
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

  const uploadPhotoMutation = useMutation({
    mutationFn: async (file) => {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      return base44.entities.Documentation.create({
        control_point_id: pointId,
        file_url,
        file_name: file.name,
        file_type: "photo",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documentation"] });
      setIsUploading(false);
    },
    onError: () => {
      setIsUploading(false);
      alert("Chyba při nahrávání fotografie");
    },
  });

  const deletePhotoMutation = useMutation({
    mutationFn: (id) => base44.entities.Documentation.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documentation"] });
      setDeletePhotoId(null);
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

    if (!file.type.startsWith("image/")) {
      alert("Prosím vyberte pouze obrázkové soubory");
      return;
    }

    setIsUploading(true);
    await uploadPhotoMutation.mutateAsync(file);
  };

  const handleCameraCapture = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    await uploadPhotoMutation.mutateAsync(file);
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
                  status === "overdue" 
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
                        {issue.created_by}
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
                          status === "overdue" ? "text-yellow-700" : "text-slate-900"
                        }`}>
                          {format(nextDate, "d. M. yyyy", { locale: cs })}
                          {status === "overdue" && (
                            <Badge variant="outline" className="ml-2 bg-yellow-100 text-yellow-800 border-yellow-300">
                              Po termínu
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
              <Button
                onClick={handleConfirmRecord}
                disabled={isProcessing}
                className={`h-14 text-lg shadow-lg ${
                  point.type === "inspection"
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

              <Button
                variant="outline"
                onClick={() => setShowIssueDialog(true)}
                className="h-14 text-lg border-2 border-orange-300 text-orange-700 hover:bg-orange-50 hover:text-orange-800 hover:border-orange-400"
              >
                <AlertTriangle className="w-5 h-5 mr-2" />
                Nahlásit závadu
              </Button>
            </div>

            {/* Fotodokumentace */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <ImageIcon className="w-5 h-5 text-slate-600" />
                  <h3 className="text-lg font-bold text-slate-900">
                    Fotodokumentace
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
                    accept="image/*"
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
                    Nahrát foto
                  </Button>
                </div>
              </div>

              {isUploading && (
                <div className="flex items-center justify-center py-8 bg-slate-50 rounded-lg mb-4">
                  <Loader2 className="w-6 h-6 animate-spin text-slate-400 mr-2" />
                  <span className="text-slate-600">Nahrávání fotografie...</span>
                </div>
              )}

              {documentation.length === 0 && !isUploading ? (
                <div className="text-center py-12 bg-slate-50 rounded-lg">
                  <ImageIcon className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500 mb-2">Zatím nejsou žádné fotografie</p>
                  <p className="text-sm text-slate-400">
                    Použijte tlačítka výše pro přidání dokumentace
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {documentation.map((doc) => (
                    <div
                      key={doc.id}
                      className="group relative aspect-square rounded-lg overflow-hidden border-2 border-slate-200 hover:border-slate-400 transition-all cursor-pointer"
                      onClick={() => {
                        setSelectedPhoto(doc);
                        setShowPhotoDialog(true);
                      }}
                    >
                      <img
                        src={doc.file_url}
                        alt={doc.file_name}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-all flex items-center justify-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="opacity-0 group-hover:opacity-100 transition-opacity bg-red-600 hover:bg-red-700 text-white"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeletePhotoId(doc.id);
                          }}
                        >
                          <X className="w-5 h-5" />
                        </Button>
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                        <p className="text-xs text-white truncate">{doc.file_name}</p>
                        <p className="text-xs text-white/70">
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
                          {record.created_by}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Dialog pro zobrazení fotografie */}
        <Dialog open={showPhotoDialog} onOpenChange={setShowPhotoDialog}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>{selectedPhoto?.file_name}</DialogTitle>
              <DialogDescription>
                Nahráno {selectedPhoto && format(new Date(selectedPhoto.created_date), "d. M. yyyy HH:mm", { locale: cs })}
                {selectedPhoto?.created_by && ` • ${selectedPhoto.created_by}`}
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <img
                src={selectedPhoto?.file_url}
                alt={selectedPhoto?.file_name}
                className="w-full h-auto max-h-[70vh] object-contain rounded-lg"
              />
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => window.open(selectedPhoto?.file_url, "_blank")}
              >
                Otevřít v nové záložce
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  setShowPhotoDialog(false);
                  setDeletePhotoId(selectedPhoto?.id);
                }}
              >
                <X className="w-4 h-4 mr-2" />
                Smazat
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Alert dialog pro smazání fotografie */}
        <AlertDialog
          open={!!deletePhotoId}
          onOpenChange={() => setDeletePhotoId(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Opravdu smazat fotografii?</AlertDialogTitle>
              <AlertDialogDescription>
                Tato akce je nevratná. Fotografie bude trvale odstraněna.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Zrušit</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deletePhotoMutation.mutate(deletePhotoId)}
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
