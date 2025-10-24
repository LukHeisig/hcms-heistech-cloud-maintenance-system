
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
  Settings
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Badge } from "@/components/ui/badge";

export default function AdminControlPoints() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const urlParams = new URLSearchParams(window.location.search);
  const machineId = urlParams.get("machine");

  const [editingPoint, setEditingPoint] = useState(null);
  const [showPointDialog, setShowPointDialog] = useState(false);
  const [deletePointId, setDeletePointId] = useState(null);
  const [formData, setFormData] = useState({
    type: "lubrication",
    name: "",
    description: "",
    lubricant_type: "",
    lubricant_amount: "",
    interval_hours: "",
    inspection_tasks: "",
    nfc_chip_id: "",
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
    queryFn: () => base44.entities.ControlPoint.filter({ machine_id: machineId }),
    enabled: !!machineId,
  });

  const createPointMutation = useMutation({
    mutationFn: (data) => base44.entities.ControlPoint.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["controlPoints"] });
      setShowPointDialog(false);
      resetForm();
    },
  });

  const updatePointMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.ControlPoint.update(id, data),
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

  const resetForm = () => {
    setFormData({
      type: "lubrication",
      name: "",
      description: "",
      lubricant_type: "",
      lubricant_amount: "",
      interval_hours: "",
      inspection_tasks: "",
      nfc_chip_id: "",
    });
  };

  const handleOpenDialog = (point = null) => {
    if (point) {
      setEditingPoint(point);
      setFormData({
        type: point.type,
        name: point.name,
        description: point.description || "",
        lubricant_type: point.lubricant_type || "",
        lubricant_amount: point.lubricant_amount || "",
        interval_hours: point.interval_hours || "",
        inspection_tasks: point.inspection_tasks || "",
        nfc_chip_id: point.nfc_chip_id || "",
      });
    } else {
      setEditingPoint(null);
      resetForm();
    }
    setShowPointDialog(true);
  };

  const handleSavePoint = async () => {
    if (!formData.name.trim()) return;

    const dataToSave = {
      type: formData.type,
      name: formData.name,
      description: formData.description || undefined,
      interval_hours: formData.interval_hours ? parseInt(formData.interval_hours) : undefined,
      nfc_chip_id: formData.nfc_chip_id || undefined,
    };

    if (formData.type === "lubrication") {
      dataToSave.lubricant_type = formData.lubricant_type || undefined;
      dataToSave.lubricant_amount = formData.lubricant_amount
        ? parseFloat(formData.lubricant_amount)
        : undefined;
    } else if (formData.type === "inspection") {
      dataToSave.inspection_tasks = formData.inspection_tasks || undefined;
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
      });
    }
  };

  const lubricationPoints = controlPoints.filter((p) => p.type === "lubrication");
  const inspectionPoints = controlPoints.filter((p) => p.type === "inspection");
  const lubricatorPoints = controlPoints.filter((p) => p.type === "auto_lubricator");

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
              {machine?.name || "Stroj"}
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
            {controlPoints.map((point) => (
              <Card
                key={point.id}
                className="hover:shadow-lg transition-all border-2 border-slate-200 hover:border-slate-300"
              >
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
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
                              : "bg-green-100 text-green-800"
                          }
                        >
                          {point.type === "lubrication"
                            ? "Mazání"
                            : point.type === "inspection"
                            ? "Inspekce"
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
                            <p className="font-medium">{point.interval_hours} h</p>
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

              {formData.type === "inspection" && (
                <div>
                  <Label htmlFor="inspection_tasks">Inspekční úkoly</Label>
                  <Textarea
                    id="inspection_tasks"
                    value={formData.inspection_tasks}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        inspection_tasks: e.target.value,
                      })
                    }
                    placeholder="Popis činností při inspekci"
                    rows={3}
                  />
                </div>
              )}

              <div>
                <Label htmlFor="interval_hours">Interval (hodiny)</Label>
                <Input
                  id="interval_hours"
                  type="number"
                  value={formData.interval_hours}
                  onChange={(e) =>
                    setFormData({ ...formData, interval_hours: e.target.value })
                  }
                  placeholder="např. 168 (1 týden)"
                />
              </div>

              <div>
                <Label htmlFor="nfc_chip_id">NFC čip ID</Label>
                <Input
                  id="nfc_chip_id"
                  value={formData.nfc_chip_id}
                  onChange={(e) =>
                    setFormData({ ...formData, nfc_chip_id: e.target.value })
                  }
                  placeholder="Volitelné ID NFC čipu"
                />
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
      </div>
    </div>
  );
}
