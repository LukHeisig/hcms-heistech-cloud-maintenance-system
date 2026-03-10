import React, { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  AlertTriangle, ClipboardCheck, Activity, ArrowLeft, ChevronRight,
  FileText, Image as ImageIcon, Camera, Upload, X, Loader2, Pencil, CheckCircle2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { format } from "date-fns";
import { cs } from "date-fns/locale";

const formatInterval = (hours) => {
  if (!hours) return "-";
  if (hours % 730 === 0) {
    const months = hours / 730;
    return `${months} ${months === 1 ? 'měsíc' : months < 5 ? 'měsíce' : 'měsíců'}`;
  }
  if (hours % 168 === 0) {
    const weeks = hours / 168;
    return `${weeks} ${weeks === 1 ? 'týden' : weeks < 5 ? 'týdny' : 'týdnů'}`;
  }
  return `${hours} ${hours === 1 ? 'hodina' : hours < 5 ? 'hodiny' : 'hodin'}`;
};

export default function ControlPointDetail({
  currentPoint,
  currentMachineForPoint,
  currentLineForPoint,
  selectedPointRecords,
  pointIssues,
  documentation,
  status,
  nextDate,
  user,
  selectedPoint,
  selectedCompany,
  selectedLine,
  selectedMachine,
  activeTab,
  nfcScanned,
  activeCompanySettings,
  getUserDisplayName,
  urlParams,
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [showIssueDialog, setShowIssueDialog] = useState(false);
  const [issueDescription, setIssueDescription] = useState("");
  const [issuePhoto, setIssuePhoto] = useState(null);
  const [isReportingIssue, setIsReportingIssue] = useState(false);
  const [showDocPreviewDialog, setShowDocPreviewDialog] = useState(false);
  const [selectedDocPreview, setSelectedDocPreview] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [deleteDocId, setDeleteDocId] = useState(null);
  const [imageErrors, setImageErrors] = useState({});
  const [showEditPointDialog, setShowEditPointDialog] = useState(false);
  const [editingPoint, setEditingPoint] = useState(null);
  const [nfcChipId, setNfcChipId] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [nfcSupported] = useState('NDEFReader' in window);

  const [isConfirmingControl, setIsConfirmingControl] = useState(false);
  const [confirmSuccess, setConfirmSuccess] = useState(false);

  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const issuePhotoInputRef = useRef(null);
  const issueCameraInputRef = useRef(null);

  const isOverdue = status === "overdue";
  const canEdit = user?.user_type === "manager" || user?.user_type === "admin" || user?.user_type === "superAdmin";
  const manualConfirmationAllowed = activeCompanySettings?.allow_manual_confirmation !== false;

  const shouldShowConfirmButton =
    !confirmSuccess &&
    ((currentPoint.type === "prevention" && currentPoint.prevention_confirmation_method === "manual" && manualConfirmationAllowed) ||
    nfcScanned);

  const createControlRecordMutation = useMutation({
    mutationFn: (data) => base44.entities.ControlRecord.create(data),
    onMutate: async (newRecord) => {
      // Optimistická aktualizace — přidat nový záznam okamžitě do cache
      await queryClient.cancelQueries({ queryKey: ["pointRecords", selectedPoint] });
      const previousRecords = queryClient.getQueryData(["pointRecords", selectedPoint, user?.id]);
      const optimisticRecord = {
        id: "optimistic-" + Date.now(),
        ...newRecord,
        created_date: new Date().toISOString(),
        created_by: user?.email,
      };
      queryClient.setQueryData(["pointRecords", selectedPoint, user?.id], (old) =>
        [optimisticRecord, ...(old || [])]
      );
      return { previousRecords };
    },
    onSuccess: (savedRecord) => {
      // Nahradit optimistický záznam skutečným
      queryClient.setQueryData(["pointRecords", selectedPoint, user?.id], (old) =>
        (old || []).map(r => r.id.startsWith("optimistic-") ? savedRecord : r)
      );
      queryClient.invalidateQueries({ queryKey: ["allRecords"] });
      setIsConfirmingControl(false);
      setConfirmSuccess(true);

      const newSearch = window.location.search.replace(/[?&]nfc_scanned=true/, '');
      const newUrl = window.location.pathname + (newSearch.startsWith('&') ? '?' + newSearch.substring(1) : newSearch);
      window.history.replaceState({}, '', newUrl);
    },
    onError: (_err, _newRecord, context) => {
      // Rollback optimistické aktualizace
      if (context?.previousRecords) {
        queryClient.setQueryData(["pointRecords", selectedPoint, user?.id], context.previousRecords);
      }
      setIsConfirmingControl(false);
      alert("Chyba při potvrzení kontroly");
    },
  });

  const handleConfirmControl = () => {
    if (!currentPoint || isConfirmingControl || confirmSuccess) return;
    setIsConfirmingControl(true);
    const recordType = currentPoint.type === "auto_lubricator"
      ? "lubricator_change"
      : currentPoint.type === "inspection"
      ? "inspection"
      : currentPoint.type === "prevention"
      ? "prevention"
      : "lubrication";

    createControlRecordMutation.mutate({
      control_point_id: currentPoint.id,
      record_type: recordType,
      performed_at: new Date().toISOString(),
    });
  };

  const uploadDocumentMutation = useMutation({
    mutationFn: async ({ file, pointId }) => {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      let detectedFileType = "other_file";
      if (file.type.startsWith("image/")) detectedFileType = "photo";
      else if (file.type === "application/pdf") detectedFileType = "document";
      return base44.entities.Documentation.create({
        control_point_id: pointId, file_url, file_name: file.name, file_type: detectedFileType, category: "other",
      });
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["documentation"] }); setIsUploading(false); },
    onError: () => { setIsUploading(false); alert("Chyba při nahrávání souboru"); },
  });

  const deleteDocumentMutation = useMutation({
    mutationFn: (id) => base44.entities.Documentation.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["documentation"] }); setDeleteDocId(null); setSelectedDocPreview(null); },
    onError: () => alert("Chyba při mazání dokumentu."),
  });

  const updateControlPointMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.ControlPoint.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["allControlPoints"] }); setShowEditPointDialog(false); setEditingPoint(null); setNfcChipId(""); },
    onError: (error) => alert("Chyba při ukládání: " + (error.message || "Neznámá chyba")),
  });

  const issueMutation = useMutation({
    mutationFn: async (data) => {
      let photoUrl = null;
      if (data.photo) {
        const { file_url } = await base44.integrations.Core.UploadFile({ file: data.photo });
        photoUrl = file_url;
      }
      return base44.entities.Issue.create({
        control_point_id: data.control_point_id || null,
        description: data.description,
        photo_url: photoUrl,
        status: "reported",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["allIssues"] });
      setShowIssueDialog(false);
      setIssueDescription("");
      setIssuePhoto(null);
      setIsReportingIssue(false);
    },
    onError: () => { setIsReportingIssue(false); alert("Chyba při nahlášení závady."); },
  });

  const handleNfcScan = async () => {
    if (!nfcSupported) { alert("NFC není podporováno v tomto prohlížeči."); return; }
    setIsScanning(true);
    try {
      const ndef = new NDEFReader();
      const abortController = new AbortController();
      await ndef.scan({ signal: abortController.signal });
      const timeoutId = setTimeout(() => { abortController.abort(); alert("Časový limit vypršel (10s)."); setIsScanning(false); }, 10000);
      ndef.addEventListener("reading", ({ serialNumber }) => {
        clearTimeout(timeoutId); setNfcChipId(serialNumber); setIsScanning(false); abortController.abort();
      }, { signal: abortController.signal });
      ndef.addEventListener("readingerror", () => { setIsScanning(false); abortController.abort(); }, { signal: abortController.signal });
    } catch (error) {
      alert("Chyba NFC: " + (error.message || "Neznámá chyba")); setIsScanning(false);
    }
  };

  const pointRecords = selectedPointRecords;
  const lastRecord = pointRecords[0];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg">
        <div className="max-w-5xl mx-auto p-4">
          <Button
            variant="ghost" size="sm"
            onClick={() => {
              const category = urlParams.get('category') || activeTab;
              const url = selectedCompany
                ? `Dashboard?company=${selectedCompany}&line=${selectedLine}&machine=${selectedMachine}&category=${category}`
                : `Dashboard?line=${selectedLine}&machine=${selectedMachine}&category=${category}`;
              navigate(createPageUrl(url));
            }}
            className="text-white hover:bg-white/20 mb-3"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Zpět na kontrolní body
          </Button>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h1 className="text-xl font-bold leading-tight mb-1">
                {currentPoint.number && `${currentPoint.number} - `}{currentPoint.name}
              </h1>
              <div className="flex items-center gap-2 text-xs text-blue-100 mt-1 mb-2 opacity-90">
                <span>{currentLineForPoint?.name || "Neznámá linka"}</span>
                <ChevronRight className="w-3 h-3" />
                <span>{currentMachineForPoint?.name || "Neznámý stroj"}</span>
              </div>
              {currentPoint.description && (
                <p className="text-sm text-blue-100 opacity-90">{currentPoint.description}</p>
              )}
            </div>
            {canEdit && (
              <Button variant="ghost" size="icon" onClick={() => { setEditingPoint(currentPoint); setNfcChipId(currentPoint.nfc_chip_id || ""); setShowEditPointDialog(true); }} className="text-white hover:bg-white/20 flex-shrink-0">
                <Pencil className="w-5 h-5" />
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-3 md:p-6 space-y-3 md:space-y-4">
        <Card className="shadow-lg">
          <CardContent className="p-3 md:p-6 space-y-2">
            {currentPoint.type === "lubrication" && (
              <>
                <div className="flex items-center justify-between py-2 border-b border-slate-200">
                  <span className="text-sm text-slate-600">Typ maziva:</span>
                  <span className="font-semibold text-slate-900">{currentPoint.lubricant_type || "-"}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-slate-200">
                  <span className="text-sm text-slate-600">Množství pro doplnění:</span>
                  <span className="font-semibold text-slate-900">{currentPoint.lubricant_amount ? `${currentPoint.lubricant_amount} g` : "-"}</span>
                </div>
              </>
            )}
            {currentPoint.type === "inspection" && currentPoint.inspection_tasks && (
              <div className="py-2 border-b border-slate-200">
                <p className="text-sm text-slate-600 mb-1">Inspekční úkoly:</p>
                <p className="text-sm text-slate-900 whitespace-pre-wrap">{currentPoint.inspection_tasks}</p>
              </div>
            )}
            {currentPoint.type === "prevention" && (
              <>
                {currentPoint.inspection_tasks && (
                  <div className="py-2 border-b border-slate-200">
                    <p className="text-sm text-slate-600 mb-1">Preventivní úkoly:</p>
                    <p className="text-sm text-slate-900 whitespace-pre-wrap">{currentPoint.inspection_tasks}</p>
                  </div>
                )}
                <div className="flex items-center justify-between py-2 border-b border-slate-200">
                  <span className="text-sm text-slate-600">Časový interval:</span>
                  <span className="font-semibold text-slate-900">{formatInterval(currentPoint.interval_hours)}</span>
                </div>
              </>
            )}
            <div className="flex items-center justify-between py-2 border-b border-slate-200">
              <span className="text-sm text-slate-600">
                Naposledy {currentPoint.type === "lubrication" ? "mazáno" : "kontrolováno"}:
              </span>
              <span className="font-semibold text-slate-900 text-right">
                {lastRecord ? format(new Date(lastRecord.performed_at), "d.M.yyyy HH:mm", { locale: cs }) : "Dosud neprovedeno"}
              </span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-slate-200">
              <span className="text-sm text-slate-600">Interval:</span>
              <span className="font-semibold text-slate-900">{formatInterval(currentPoint.interval_hours)}</span>
            </div>
            <div className="flex items-center justify-between py-3">
              <span className="text-sm text-slate-600">Datum další kontroly:</span>
              <div className="text-right">
                <span className={`font-bold text-lg ${isOverdue ? "text-red-600" : "text-green-600"}`}>
                  {nextDate ? format(nextDate, "d.M.yyyy", { locale: cs }) : "-"}
                </span>
                {isOverdue && <Badge className="ml-2 bg-red-600 text-white text-xs">Po termínu</Badge>}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Confirm button */}
        {confirmSuccess ? (
          <div className="w-full h-14 bg-gradient-to-r from-green-500 to-green-600 text-white shadow-xl text-lg font-semibold rounded-md flex items-center justify-center gap-2">
            <CheckCircle2 className="w-6 h-6" />
            Potvrzeno a uloženo
          </div>
        ) : shouldShowConfirmButton && (
          <Button
            onClick={handleConfirmControl}
            disabled={isConfirmingControl}
            className="w-full h-14 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white shadow-xl text-lg font-semibold"
          >
            {isConfirmingControl ? (
              <><Loader2 className="w-6 h-6 mr-2 animate-spin" />Ukládání...</>
            ) : (
              <><ClipboardCheck className="w-6 h-6 mr-2" />Potvrdit kontrolu</>
            )}
          </Button>
        )}

        <Card className="shadow-lg">
          <CardHeader className="pb-2">
            <CardTitle className="text-base md:text-lg">
              Historie {currentPoint.type === "lubrication" ? "mazání" : "kontrol"}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3">
            {pointRecords.length === 0 ? (
              <p className="text-center text-slate-500 py-6 text-sm">Zatím nejsou žádné záznamy</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {pointRecords.map((record) => (
                  <div key={record.id} className={`p-3 rounded-lg transition-all ${record.id?.startsWith('optimistic-') ? 'bg-green-50 border border-green-200' : 'bg-slate-50'}`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-slate-900 text-sm">
                        {format(new Date(record.performed_at), "d.M.yyyy HH:mm", { locale: cs })}
                      </span>
                      <div className="flex items-center gap-2">
                        {record.id?.startsWith('optimistic-') && (
                          <span className="text-xs text-green-600 font-medium flex items-center gap-1">
                            <Loader2 className="w-3 h-3 animate-spin" /> Ukládám...
                          </span>
                        )}
                        <span className="text-xs text-slate-600">{getUserDisplayName(record.created_by)}</span>
                      </div>
                    </div>
                    {record.note && <p className="text-sm text-slate-600">{record.note}</p>}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {pointIssues.length > 0 && (
          <Card className="shadow-lg border-2 border-orange-300 bg-orange-50">
            <CardHeader className="pb-2">
              <CardTitle className="text-base md:text-lg text-orange-900 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 md:w-5 md:h-5" />
                Aktivní závady ({pointIssues.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 space-y-2">
              {pointIssues.map((issue) => (
                <div key={issue.id} className="bg-white p-3 rounded-lg border border-orange-200">
                  <p className="text-sm text-slate-900 mb-1">{issue.description}</p>
                  {issue.photo_url && <div className="mt-2"><img src={issue.photo_url} alt="Závada" className="max-h-24 object-contain rounded-md" /></div>}
                  <p className="text-xs text-slate-500 mt-2">
                    {format(new Date(issue.created_date), "d.M.yyyy HH:mm", { locale: cs })} • {getUserDisplayName(issue.created_by)}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <Card className="shadow-lg">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base md:text-lg flex items-center gap-2">
                <FileText className="w-4 h-4 md:w-5 md:h-5 text-blue-600" />
                Dokumentace
              </CardTitle>
              <div className="flex gap-2">
                <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setIsUploading(true); uploadDocumentMutation.mutate({ file: f, pointId: selectedPoint }); }}} className="hidden" />
                <Button variant="outline" size="sm" onClick={() => cameraInputRef.current?.click()} disabled={isUploading} className="h-8 px-2 md:px-3">
                  <Camera className="w-4 h-4 md:mr-1" /><span className="hidden md:inline">Vyfotit</span>
                </Button>
                <input ref={fileInputRef} type="file" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.dwg,.dxf" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setIsUploading(true); uploadDocumentMutation.mutate({ file: f, pointId: selectedPoint }); }}} className="hidden" />
                <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="h-8 px-2 md:px-3">
                  <Upload className="w-4 h-4 md:mr-1" /><span className="hidden md:inline">Nahrát</span>
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-3">
            {isUploading && <div className="flex items-center justify-center py-6 bg-slate-50 rounded-lg mb-3"><Loader2 className="w-5 h-5 animate-spin text-slate-400 mr-2" /><span className="text-sm text-slate-600">Nahrávání...</span></div>}
            {documentation.length === 0 && !isUploading ? (
              <div className="text-center py-8 bg-slate-50 rounded-lg">
                <ImageIcon className="w-12 h-12 text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-500">Zatím není žádná dokumentace</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-3">
                {documentation.map((doc) => (
                  <div key={doc.id} className="group relative aspect-square rounded-lg overflow-hidden border-2 border-slate-200 hover:border-blue-400 transition-all cursor-pointer" onClick={() => { setSelectedDocPreview(doc); setShowDocPreviewDialog(true); }}>
                    {doc.file_type === "photo" && !imageErrors[doc.id] ? (
                      <img src={doc.file_url} alt={doc.file_name} className="w-full h-full object-cover" loading="lazy" onError={() => setImageErrors(p => ({ ...p, [doc.id]: true }))} />
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full bg-slate-100 p-2">
                        <FileText className="w-8 h-8 text-slate-400 mb-1" />
                        <span className="text-[10px] text-slate-600 text-center truncate w-full px-1">{doc.file_name}</span>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-all flex items-center justify-center">
                      <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity bg-red-600 hover:bg-red-700 text-white" onClick={(e) => { e.stopPropagation(); setDeleteDocId(doc.id); }}>
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Button onClick={() => setShowIssueDialog(true)} className="w-full h-12 bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800 text-white shadow-lg">
          <AlertTriangle className="w-5 h-5 mr-2" />
          Nahlásit závadu
        </Button>
      </div>

      {/* Dialogs */}
      <Dialog open={showDocPreviewDialog} onOpenChange={setShowDocPreviewDialog}>
        <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0">
          <DialogHeader className="p-4 border-b">
            <DialogTitle>{selectedDocPreview?.file_name}</DialogTitle>
            <DialogDescription>
              {selectedDocPreview && format(new Date(selectedDocPreview.created_date), "d.M.yyyy HH:mm", { locale: cs })}
              {selectedDocPreview?.created_by && ` • ${getUserDisplayName(selectedDocPreview.created_by)}`}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 flex items-center justify-center overflow-auto p-4 bg-slate-50">
            {selectedDocPreview?.file_type === "photo" ? (
              <img src={selectedDocPreview.file_url} alt={selectedDocPreview.file_name} className="max-w-full max-h-full object-contain" />
            ) : (
              <div className="text-center"><FileText className="w-16 h-16 text-slate-400 mx-auto mb-4" /><p className="text-slate-600">Náhled není dostupný</p></div>
            )}
          </div>
          <DialogFooter className="p-4 border-t">
            <Button variant="outline" onClick={() => selectedDocPreview?.file_url && window.open(selectedDocPreview.file_url, "_blank")}>Otevřít v nové záložce</Button>
            <Button variant="destructive" onClick={() => { setShowDocPreviewDialog(false); setDeleteDocId(selectedDocPreview?.id); }}>
              <X className="w-4 h-4 mr-2" />Smazat
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteDocId} onOpenChange={() => setDeleteDocId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Opravdu smazat fotografii?</AlertDialogTitle>
            <AlertDialogDescription>Tato akce je nevratná.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Zrušit</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteDocumentMutation.mutate(deleteDocId)} className="bg-red-600 hover:bg-red-700">Smazat</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={showEditPointDialog} onOpenChange={setShowEditPointDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Pencil className="w-5 h-5 text-blue-600" />Upravit kontrolní bod</DialogTitle>
            <DialogDescription>{editingPoint?.name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="nfc_chip_id">NFC čip ID</Label>
              <div className="flex gap-2 mt-2">
                <Input id="nfc_chip_id" value={nfcChipId} onChange={(e) => setNfcChipId(e.target.value)} placeholder="Zadejte nebo naskenujte ID čipu" className="flex-1" />
                <Button onClick={handleNfcScan} disabled={isScanning || !nfcSupported} variant="outline" className="flex-shrink-0">
                  {isScanning ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Skenování...</> : <><Activity className="w-4 h-4 mr-2" />Skenovat</>}
                </Button>
              </div>
              {!nfcSupported && <p className="text-xs text-orange-600 mt-2">NFC není podporováno. Použijte Chrome na Androidu.</p>}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowEditPointDialog(false); setEditingPoint(null); setNfcChipId(""); }} disabled={updateControlPointMutation.isPending}>Zrušit</Button>
            <Button onClick={() => updateControlPointMutation.mutate({ id: editingPoint.id, data: { nfc_chip_id: nfcChipId.trim() || null } })} disabled={updateControlPointMutation.isPending} className="bg-gradient-to-r from-blue-600 to-blue-700">
              {updateControlPointMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Ukládání...</> : "Uložit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showIssueDialog} onOpenChange={(isOpen) => { setShowIssueDialog(isOpen); if (!isOpen) { setIssueDescription(""); setIssuePhoto(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-orange-700"><AlertTriangle className="w-5 h-5" />Nahlásit závadu</DialogTitle>
            <DialogDescription>Popište zjištěnou závadu na kontrolním bodě</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="description">Popis závady *</Label>
              <Textarea id="description" value={issueDescription} onChange={(e) => setIssueDescription(e.target.value)} placeholder="Popište podrobně zjištěnou závadu..." rows={5} className="mt-2" />
            </div>
            <div>
              <Label>Fotografie závady (volitelné)</Label>
              <div className="flex gap-2 mt-2">
                <input ref={issuePhotoInputRef} type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) setIssuePhoto(f); }} className="hidden" />
                <Button type="button" variant="outline" onClick={() => issuePhotoInputRef.current?.click()} className="flex-1">
                  <Upload className="w-4 h-4 mr-2" />{issuePhoto ? issuePhoto.name : "Nahrát fotku"}
                </Button>
                <input ref={issueCameraInputRef} type="file" accept="image/*" capture="environment" onChange={(e) => { const f = e.target.files?.[0]; if (f) setIssuePhoto(f); }} className="hidden" />
                <Button type="button" variant="outline" onClick={() => issueCameraInputRef.current?.click()}><Camera className="w-4 h-4" /></Button>
                {issuePhoto && <Button type="button" variant="ghost" size="icon" onClick={() => setIssuePhoto(null)}><X className="w-4 h-4 text-red-600" /></Button>}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowIssueDialog(false); setIssueDescription(""); setIssuePhoto(null); }} disabled={isReportingIssue}>Zrušit</Button>
            <Button onClick={() => { setIsReportingIssue(true); issueMutation.mutate({ control_point_id: selectedPoint, description: issueDescription, photo: issuePhoto }); }} disabled={!issueDescription.trim() || isReportingIssue} className="bg-gradient-to-r from-orange-600 to-orange-700">
              {isReportingIssue ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Ukládání...</> : <><AlertTriangle className="w-4 h-4 mr-2" />Nahlásit závadu</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}