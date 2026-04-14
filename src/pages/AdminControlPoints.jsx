import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  GripVertical,
  Droplet,
  CheckCircle,
  Loader2,
  ChevronRight,
  Building2,
  Factory,
  Settings,
  ArrowUp,
  ArrowDown,
  Activity,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Badge } from "@/components/ui/badge";

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

export default function AdminControlPoints() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const urlParams = new URLSearchParams(window.location.search);
  const machineId = urlParams.get("machine");

  const [editingPoint, setEditingPoint] = useState(null);
  const [showPointDialog, setShowPointDialog] = useState(false);
  const [deletePointId, setDeletePointId] = useState(null);
  const [isNfcScanning, setIsNfcScanning] = useState(false);
  const [showNfcScanDialog, setShowNfcScanDialog] = useState(false);
  const [formData, setFormData] = useState({
    type: "lubrication",
    name: "",
    description: "",
    lubricant_type: "",
    lubricant_amount: "",
    interval_hours: "",
    interval_unit: "hours",
    inspection_tasks: "",
    nfc_chip_id: "",
    prevention_confirmation_method: "manual",
    first_confirmation_date: "",
  });

  const { data: machine } = useQuery({
    queryKey: ["machine", machineId],
    queryFn: async () => {
      const machines = await base44.entities.Machine.list();
      return machines.find((m) => m.id === machineId);
    },
    enabled: !!machineId,
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

  const { data: controlPoints = [], isLoading } = useQuery({
    queryKey: ["controlPoints", machineId],
    queryFn: () => base44.entities.ControlPoint.filter({ machine_id: machineId }, "order_index"),
    enabled: !!machineId,
  });

  // Seřadit kontrolní body podle order_index, pokud existuje, jinak podle created_date
  const sortedControlPoints = React.useMemo(() => {
    return [...controlPoints].sort((a, b) => {
      const orderA = a.order_index ?? 0;
      const orderB = b.order_index ?? 0;
      if (orderA !== orderB) {
        return orderA - orderB;
      }
      return new Date(a.created_date) - new Date(b.created_date);
    });
  }, [controlPoints]);

  const createPointMutation = useMutation({
    mutationFn: async (data) => {
      const point = await base44.entities.ControlPoint.create(data);
      const currentUser = await base44.auth.me();
      await base44.entities.AuditLog.create({
        entity_type: "ControlPoint",
        entity_id: point.id,
        changed_by: currentUser.email,
        change_description: `Vytvořen kontrolní bod: ${data.name}`,
        user_type: currentUser.user_type || "user",
        company_id: line?.company_id || undefined,
      });
      return point;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["controlPoints"] });
      setShowPointDialog(false);
      resetForm();
    },
  });

  const updatePointMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const point = await base44.entities.ControlPoint.update(id, data);
      const currentUser = await base44.auth.me();
      await base44.entities.AuditLog.create({
        entity_type: "ControlPoint",
        entity_id: id,
        changed_by: currentUser.email,
        change_description: `Upraven kontrolní bod: ${data.name}`,
        user_type: currentUser.user_type || "user",
        company_id: line?.company_id || undefined,
      });
      return point;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["controlPoints"] });
      setShowPointDialog(false);
      setEditingPoint(null);
      resetForm();
    },
  });

  const deletePointMutation = useMutation({
    mutationFn: (id) => base44.entities.ControlPoint.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["controlPoints"] });
      setDeletePointId(null);
    },
  });

  const movePointMutation = useMutation({
    mutationFn: ({ id, newIndex }) => base44.entities.ControlPoint.update(id, { order_index: newIndex }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["controlPoints"] });
    },
  });

  const handleMoveUp = async (index) => {
    if (index === 0) return;
    const point1 = sortedControlPoints[index];
    const point2 = sortedControlPoints[index - 1];
    await Promise.all([
      movePointMutation.mutateAsync({ id: point1.id, newIndex: index - 1 }),
      movePointMutation.mutateAsync({ id: point2.id, newIndex: index }),
    ]);
  };

  const handleMoveDown = async (index) => {
    if (index === sortedControlPoints.length - 1) return;
    const point1 = sortedControlPoints[index];
    const point2 = sortedControlPoints[index + 1];
    await Promise.all([
      movePointMutation.mutateAsync({ id: point1.id, newIndex: index + 1 }),
      movePointMutation.mutateAsync({ id: point2.id, newIndex: index }),
    ]);
  };

  const resetForm = () => {
    setFormData({
      type: "lubrication",
      name: "",
      description: "",
      lubricant_type: "",
      lubricant_amount: "",
      interval_hours: "",
      interval_unit: "hours",
      inspection_tasks: "",
      nfc_chip_id: "",
      prevention_confirmation_method: "manual",
      first_confirmation_date: "",
    });
  };

  const detectIntervalUnit = (hours) => {
    if (!hours) return { value: "", unit: "hours" };
    if (hours % 730 === 0) return { value: hours / 730, unit: "months" };
    if (hours % 168 === 0) return { value: hours / 168, unit: "weeks" };
    return { value: hours, unit: "hours" };
  };

  const convertToHours = (value, unit) => {
    if (!value) return null;
    const val = parseFloat(value);
    switch (unit) {
      case "weeks": return val * 168;
      case "months": return val * 730;
      default: return val;
    }
  };

  const handleOpenDialog = (point = null) => {
    if (point) {
      setEditingPoint(point);
      const detected = detectIntervalUnit(point.interval_hours);
      setFormData({
        type: point.type,
        name: point.name,
        description: point.description || "",
        lubricant_type: point.lubricant_type || "",
        lubricant_amount: point.lubricant_amount || "",
        interval_hours: detected.value,
        interval_unit: detected.unit,
        inspection_tasks: point.inspection_tasks || "",
        nfc_chip_id: point.nfc_chip_id || "",
        prevention_confirmation_method: point.prevention_confirmation_method || "manual",
        first_confirmation_date: point.first_confirmation_date ? new Date(point.first_confirmation_date).toISOString().slice(0, 16) : "",
      });
    } else {
      setEditingPoint(null);
      resetForm();
    }
    setShowPointDialog(true);
  };

  const handleScanNfc = async () => {
    if (!('NDEFReader' in window)) {
      alert("NFC není podporováno v tomto prohlížeči. Použijte prosím Chrome na Androidu.");
      return;
    }

    setShowNfcScanDialog(true);
    setIsNfcScanning(true);

    try {
      const ndef = new window.NDEFReader();
      const abortController = new AbortController();
      
      await ndef.scan({ signal: abortController.signal });

      const timeoutId = setTimeout(() => {
        abortController.abort();
        alert("Časový limit čtení NFC vypršel (10s).");
        setIsNfcScanning(false);
        setShowNfcScanDialog(false);
      }, 10000);

      ndef.addEventListener("reading", ({ serialNumber }) => {
        clearTimeout(timeoutId);
        setIsNfcScanning(false);
        setShowNfcScanDialog(false);
        abortController.abort();
        
        setFormData(prev => ({ ...prev, nfc_chip_id: serialNumber }));
      }, { signal: abortController.signal, once: true });

      ndef.addEventListener("readingerror", (event) => {
        clearTimeout(timeoutId);
        console.error("NFC reading error:", event);
        alert("Chyba při čtení NFC čipu.");
        setIsNfcScanning(false);
        setShowNfcScanDialog(false);
        abortController.abort();
      }, { signal: abortController.signal });

    } catch (error) {
      console.error("NFC scan initiation error:", error);
      alert("Chyba při spuštění skenování NFC: " + (error.message || "Neznámá chyba"));
      setIsNfcScanning(false);
      setShowNfcScanDialog(false);
    }
  };

  const handleSavePoint = async () => {
    if (!formData.name.trim()) return;

    const dataToSave = {
      type: formData.type,
      name: formData.name,
      description: formData.description || undefined,
      interval_hours: formData.interval_hours ? convertToHours(formData.interval_hours, formData.interval_unit) : undefined,
      nfc_chip_id: formData.nfc_chip_id.trim() || null,
      first_confirmation_date: formData.first_confirmation_date ? new Date(formData.first_confirmation_date).toISOString() : null,
    };

    if (formData.type === "lubrication") {
      dataToSave.lubricant_type = formData.lubricant_type || undefined;
      dataToSave.lubricant_amount = formData.lubricant_amount
        ? parseFloat(formData.lubricant_amount)
        : undefined;
    } else if (formData.type === "inspection" || formData.type === "prevention") {
      dataToSave.inspection_tasks = formData.inspection_tasks || undefined;
    }

    if (formData.type === "prevention") {
      dataToSave.prevention_confirmation_method = formData.prevention_confirmation_method || "manual";
    }

    if (editingPoint) {
      await updatePointMutation.mutateAsync({
        id: editingPoint.id,
        data: dataToSave,
      });
    } else {
      await createPointMutation.mutateAsync({
        ...dataToSave,
        machine_id: machineId,
        order_index: sortedControlPoints.length,
      });
    }
  };



  if (isLoading) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => navigate(createPageUrl(`AdminMachines?line=${machine?.line_id}`))}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Zpět na stroje
          </Button>

          {/* Breadcrumbs */}
          <div className="flex items-center gap-2 text-sm text-slate-600 mb-4 flex-wrap">
            <Building2 className="w-4 h-4" />
            <button
              onClick={() => navigate(createPageUrl("AdminCompanies"))}
              className="hover:text-slate-900 transition-colors"
            >
              {company?.name || "Podnik"}
            </button>
            <ChevronRight className="w-4 h-4" />
            <button
              onClick={() => navigate(createPageUrl(`AdminLines?company=${line?.company_id}`))}
              className="hover:text-slate-900 transition-colors"
            >
              {line?.name || "Linka"}
            </button>
            <ChevronRight className="w-4 h-4" />
            <button
              onClick={() => navigate(createPageUrl(`AdminMachines?line=${machine?.line_id}`))}
              className="hover:text-slate-900 transition-colors"
            >
              {machine?.maintenance_category === "lubrication" ? (machine?.name || "Část linky") : (machine?.name || "Stroj")}
            </button>
            <ChevronRight className="w-4 h-4" />
            <span className="font-semibold text-slate-900">Kontrolní body</span>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">
                Kontrolní body: {machine?.name}
              </h1>
              <p className="text-slate-600 mt-1">{controlPoints.length} kontrolních bodů</p>
            </div>
            <Button
              onClick={() => handleOpenDialog()}
              className="bg-gradient-to-r from-red-600 to-red-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Přidat bod
            </Button>
          </div>
        </div>

        {controlPoints.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Droplet className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-900 mb-2">
                Zatím nemáte žádné kontrolní body
              </h3>
              <p className="text-slate-500 mb-6">
                Začněte přidáním prvního kontrolního bodu
              </p>
              <Button
                onClick={() => handleOpenDialog()}
                className="bg-gradient-to-r from-red-600 to-red-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                Vytvořit první bod
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {sortedControlPoints.map((point, index) => (
              <Card
                key={point.id}
                className="hover:shadow-lg transition-all border-2 border-slate-200 hover:border-slate-300"
              >
                <CardContent className="p-6">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-1 flex flex-col gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => handleMoveUp(index)}
                        disabled={index === 0}
                      >
                        <ArrowUp className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => handleMoveDown(index)}
                        disabled={index === sortedControlPoints.length - 1}
                      >
                        <ArrowDown className="w-4 h-4" />
                      </Button>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-bold text-slate-900">
                          {point.name}
                        </h3>
                        <Badge
                          className={
                            point.type === "lubrication"
                              ? "bg-blue-100 text-blue-800"
                              : point.type === "inspection"
                              ? "bg-purple-100 text-purple-800"
                              : point.type === "prevention"
                              ? "bg-orange-100 text-orange-800"
                              : "bg-green-100 text-green-800"
                          }
                        >
                          {point.type === "lubrication"
                            ? "Mazání"
                            : point.type === "inspection"
                            ? "Inspekce"
                            : point.type === "prevention"
                            ? "Prevence"
                            : "Maznice"}
                        </Badge>
                      </div>
                      {point.description && (
                        <p className="text-sm text-slate-600 mb-2">
                          {point.description}
                        </p>
                      )}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                        {point.lubricant_type && (
                          <div>
                            <span className="text-slate-500">Mazivo:</span>
                            <p className="font-medium">{point.lubricant_type}</p>
                          </div>
                        )}
                        {point.lubricant_amount && (
                          <div>
                            <span className="text-slate-500">Množství:</span>
                            <p className="font-medium">{point.lubricant_amount} g</p>
                          </div>
                        )}
                        {point.interval_hours && (
                          <div>
                            <span className="text-slate-500">Interval:</span>
                            <p className="font-medium">{formatInterval(point.interval_hours)}</p>
                          </div>
                        )}
                        {point.nfc_chip_id && (
                          <div>
                            <span className="text-slate-500">NFC čip:</span>
                            <p className="font-medium text-xs truncate">
                              {point.nfc_chip_id}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenDialog(point)}
                      >
                        <Pencil className="w-4 h-4 text-slate-600" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeletePointId(point.id)}
                      >
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Dialog open={showPointDialog} onOpenChange={setShowPointDialog}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingPoint ? "Upravit kontrolní bod" : "Nový kontrolní bod"}
              </DialogTitle>
              <DialogDescription>
                {editingPoint
                  ? "Upravte informace o kontrolním bodu"
                  : "Vytvořte nový kontrolní bod"}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="type">Typ bodu *</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value) =>
                    setFormData({ ...formData, type: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lubrication">Mazací bod</SelectItem>
                    <SelectItem value="inspection">Inspekční bod</SelectItem>
                    <SelectItem value="prevention">Prevence</SelectItem>
                    <SelectItem value="auto_lubricator">
                      Automatická maznice
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="name">Název bodu *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="např. Hlavní ložisko"
                />
              </div>

              <div>
                <Label htmlFor="description">Popis</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="Volitelný popis"
                  rows={2}
                />
              </div>

              {formData.type === "lubrication" && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="lubricant_type">Typ maziva</Label>
                      <Input
                        id="lubricant_type"
                        value={formData.lubricant_type}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            lubricant_type: e.target.value,
                          })
                        }
                        placeholder="např. SKF LGWA 2"
                      />
                    </div>
                    <div>
                      <Label htmlFor="lubricant_amount">Množství (g)</Label>
                      <Input
                        id="lubricant_amount"
                        type="number"
                        value={formData.lubricant_amount}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            lubricant_amount: e.target.value,
                          })
                        }
                        placeholder="např. 12"
                      />
                    </div>
                  </div>
                </>
              )}

              {(formData.type === "inspection" || formData.type === "prevention") && (
                <div>
                  <Label htmlFor="inspection_tasks">
                    {formData.type === "prevention" ? "Preventivní úkoly" : "Inspekční úkoly"}
                  </Label>
                  <Textarea
                    id="inspection_tasks"
                    value={formData.inspection_tasks}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        inspection_tasks: e.target.value,
                      })
                    }
                    placeholder={formData.type === "prevention" ? "kontrolní rozvaděče, parametry atd. Fyzická kontrola demontování hadicí." : "Popis činností při inspekci"}
                    rows={4}
                  />
                </div>
              )}

              <div>
                <Label htmlFor="interval_hours">Časový interval</Label>
                <div className="flex gap-2">
                  <Input
                    id="interval_hours"
                    type="number"
                    value={formData.interval_hours}
                    onChange={(e) =>
                      setFormData({ ...formData, interval_hours: e.target.value })
                    }
                    placeholder="např. 5"
                    className="flex-1"
                  />
                  <Select
                    value={formData.interval_unit}
                    onValueChange={(value) =>
                      setFormData({ ...formData, interval_unit: value })
                    }
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hours">Hodiny</SelectItem>
                      <SelectItem value="weeks">Týdny</SelectItem>
                      <SelectItem value="months">Měsíce</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {formData.type === "prevention" && (
                <div>
                  <Label htmlFor="prevention_confirmation">Způsob potvrzení prevence</Label>
                  <Select
                    value={formData.prevention_confirmation_method}
                    onValueChange={(value) =>
                      setFormData({ ...formData, prevention_confirmation_method: value })
                    }
                  >
                    <SelectTrigger id="prevention_confirmation">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manual">Ruční potvrzení tlačítkem</SelectItem>
                      <SelectItem value="nfc">Sken NFC čipu</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div>
                <Label htmlFor="nfc_chip_id">NFC čip ID</Label>
                <div className="flex gap-2">
                  <Input
                    id="nfc_chip_id"
                    value={formData.nfc_chip_id}
                    onChange={(e) =>
                      setFormData({ ...formData, nfc_chip_id: e.target.value })
                    }
                    placeholder="Volitelné ID NFC čipu"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleScanNfc}
                    title="Naskenovat NFC"
                  >
                    <Activity className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div>
                <Label htmlFor="first_confirmation_date">Datum prvního potvrzení</Label>
                <Input
                  id="first_confirmation_date"
                  type="datetime-local"
                  value={formData.first_confirmation_date}
                  onChange={(e) =>
                    setFormData({ ...formData, first_confirmation_date: e.target.value })
                  }
                />
                <p className="text-xs text-slate-500 mt-1">
                  Od tohoto data se počítá interval pro další kontrolu
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowPointDialog(false)}
              >
                Zrušit
              </Button>
              <Button
                onClick={handleSavePoint}
                disabled={!formData.name.trim()}
                className="bg-gradient-to-r from-red-600 to-red-700"
              >
                {editingPoint ? "Uložit změny" : "Vytvořit bod"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog
          open={!!deletePointId}
          onOpenChange={() => setDeletePointId(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Opravdu smazat kontrolní bod?</AlertDialogTitle>
              <AlertDialogDescription>
                Tato akce je nevratná. Budou smazány také všechny záznamy a
                závady spojené s tímto bodem.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Zrušit</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deletePointMutation.mutate(deletePointId)}
                className="bg-red-600 hover:bg-red-700"
              >
                Smazat
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <Dialog open={showNfcScanDialog} onOpenChange={setShowNfcScanDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-blue-700">
                <Activity className="w-6 h-6" />
                Skenování NFC čipu
              </DialogTitle>
              <DialogDescription>
                Přiložte NFC čip k zařízení pro načtení ID.
              </DialogDescription>
            </DialogHeader>
            <div className="py-8 text-center">
              <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Activity className="w-10 h-10 text-blue-600 animate-pulse" />
              </div>
              <p className="text-lg font-semibold text-slate-900 mb-2">
                Přiložte NFC čip k zařízení
              </p>
              <p className="text-sm text-slate-600">
                Skenování bude trvat maximálně 10 sekund
              </p>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowNfcScanDialog(false);
                  setIsNfcScanning(false);
                }}
              >
                Zrušit
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </div>
    </div>
  );
}