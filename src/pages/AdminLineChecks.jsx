import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Building2,
  ChevronRight,
  ArrowLeft,
  Plus,
  Trash2,
  Pencil,
  ClipboardCheck,
  Loader2,
  GripVertical,
  Copy,
  ChevronUp,
  ChevronDown,
} from "lucide-react";

export default function AdminLineChecks() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);

  const urlParams = new URLSearchParams(window.location.search);
  const lineId = urlParams.get("id");
  const companyId = urlParams.get("company");

  const [showSectionDialog, setShowSectionDialog] = useState(false);
  const [showPointDialog, setShowPointDialog] = useState(false);
  const [editingSection, setEditingSection] = useState(null);
  const [editingPoint, setEditingPoint] = useState(null);
  const [deleteSectionId, setDeleteSectionId] = useState(null);
  const [deletePointId, setDeletePointId] = useState(null);
  const [selectedSectionId, setSelectedSectionId] = useState(null);
  const [isCopying, setIsCopying] = useState(false);
  const [isMoving, setIsMoving] = useState(false);

  const [sectionForm, setSectionForm] = useState({ name: "" });
  const [pointForm, setPointForm] = useState({ name: "", check_parameters: "" });

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    const currentUser = await base44.auth.me();
    setUser(currentUser);
  };

  const { data: line } = useQuery({
    queryKey: ["line", lineId],
    queryFn: () => base44.entities.Line.filter({ id: lineId }).then(res => res[0]),
    enabled: !!lineId,
  });

  const { data: company } = useQuery({
    queryKey: ["company", line?.company_id],
    queryFn: () => base44.entities.Company.filter({ id: line.company_id }).then(res => res[0]),
    enabled: !!line?.company_id,
  });

  const { data: sections = [] } = useQuery({
    queryKey: ["checkSections", lineId],
    queryFn: () => base44.entities.LineCheckSection.filter({ line_id: lineId }, "order_index"),
    enabled: !!lineId,
  });

  const { data: allPoints = [] } = useQuery({
    queryKey: ["lineCheckPoints"],
    queryFn: () => base44.entities.LineCheckPoint.list("order_index"),
  });

  const createSectionMutation = useMutation({
    mutationFn: (data) => base44.entities.LineCheckSection.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["checkSections"] });
      setShowSectionDialog(false);
      setSectionForm({ name: "" });
      setEditingSection(null);
    },
  });

  const updateSectionMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.LineCheckSection.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["checkSections"] });
      setShowSectionDialog(false);
      setSectionForm({ name: "" });
      setEditingSection(null);
    },
  });

  const deleteSectionMutation = useMutation({
    mutationFn: (id) => base44.entities.LineCheckSection.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["checkSections"] });
      queryClient.invalidateQueries({ queryKey: ["lineCheckPoints"] });
      setDeleteSectionId(null);
    },
  });

  const createPointMutation = useMutation({
    mutationFn: (data) => base44.entities.LineCheckPoint.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lineCheckPoints"] });
      setShowPointDialog(false);
      setPointForm({ name: "", check_parameters: "" });
      setEditingPoint(null);
      setSelectedSectionId(null);
    },
  });

  const updatePointMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.LineCheckPoint.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lineCheckPoints"] });
      setShowPointDialog(false);
      setPointForm({ name: "", check_parameters: "" });
      setEditingPoint(null);
      setSelectedSectionId(null);
    },
  });

  const deletePointMutation = useMutation({
    mutationFn: (id) => base44.entities.LineCheckPoint.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lineCheckPoints"] });
      setDeletePointId(null);
    },
  });

  const handleOpenSectionDialog = (section = null) => {
    if (section) {
      setEditingSection(section);
      setSectionForm({ name: section.name });
    } else {
      setEditingSection(null);
      setSectionForm({ name: "" });
    }
    setShowSectionDialog(true);
  };

  const handleSaveSection = async () => {
    if (!sectionForm.name.trim()) return;

    if (editingSection) {
      await updateSectionMutation.mutateAsync({
        id: editingSection.id,
        data: sectionForm,
      });
    } else {
      const maxOrderIndex = sections.reduce((max, s) => Math.max(max, s.order_index || 0), 0);
      await createSectionMutation.mutateAsync({
        line_id: lineId,
        name: sectionForm.name,
        order_index: maxOrderIndex + 1,
      });
    }
  };

  const handleOpenPointDialog = (sectionId, point = null) => {
    setSelectedSectionId(sectionId);
    if (point) {
      setEditingPoint(point);
      setPointForm({ name: point.name, check_parameters: point.check_parameters || "" });
    } else {
      setEditingPoint(null);
      setPointForm({ name: "", check_parameters: "" });
    }
    setShowPointDialog(true);
  };

  const handleSavePoint = async () => {
    if (!pointForm.name.trim()) return;

    if (editingPoint) {
      await updatePointMutation.mutateAsync({
        id: editingPoint.id,
        data: pointForm,
      });
    } else {
      const sectionPoints = allPoints.filter(p => p.section_id === selectedSectionId);
      const maxOrderIndex = sectionPoints.reduce((max, p) => Math.max(max, p.order_index || 0), 0);
      await createPointMutation.mutateAsync({
        section_id: selectedSectionId,
        name: pointForm.name,
        check_parameters: pointForm.check_parameters,
        order_index: maxOrderIndex + 1,
      });
    }
  };

  const handleCopySection = async (section) => {
    if (!window.confirm(`Opravdu chcete zkopírovat sekci "${section.name}" včetně všech jejích kontrolních bodů?`)) {
      return;
    }

    setIsCopying(true);
    try {
      const maxOrderIndex = sections.reduce((max, s) => Math.max(max, s.order_index || 0), 0);
      const newSection = await base44.entities.LineCheckSection.create({
        line_id: lineId,
        name: `${section.name} (kopie)`,
        order_index: maxOrderIndex + 1,
      });

      const sectionPoints = allPoints.filter(p => p.section_id === section.id);
      
      for (const point of sectionPoints) {
        await base44.entities.LineCheckPoint.create({
          section_id: newSection.id,
          name: point.name,
          check_parameters: point.check_parameters,
          order_index: point.order_index,
        });
      }

      queryClient.invalidateQueries({ queryKey: ["checkSections"] });
      queryClient.invalidateQueries({ queryKey: ["lineCheckPoints"] });
    } catch (error) {
      console.error("Error copying section:", error);
      alert("Chyba při kopírování sekce");
    } finally {
      setIsCopying(false);
    }
  };

  const handleCopyPoint = async (point, sectionId) => {
    setIsCopying(true);
    try {
      const sectionPoints = allPoints.filter(p => p.section_id === sectionId);
      const maxOrderIndex = sectionPoints.reduce((max, p) => Math.max(max, p.order_index || 0), 0);
      
      await base44.entities.LineCheckPoint.create({
        section_id: sectionId,
        name: `${point.name} (kopie)`,
        check_parameters: point.check_parameters,
        order_index: maxOrderIndex + 1,
      });

      queryClient.invalidateQueries({ queryKey: ["lineCheckPoints"] });
    } catch (error) {
      console.error("Error copying point:", error);
      alert("Chyba při kopírování bodu");
    } finally {
      setIsCopying(false);
    }
  };

  const handleMoveSectionUp = async (section, index) => {
    if (index === 0) return;
    
    setIsMoving(true);
    try {
      const prevSection = sections[index - 1];
      
      await base44.entities.LineCheckSection.update(section.id, {
        order_index: prevSection.order_index,
      });
      
      await base44.entities.LineCheckSection.update(prevSection.id, {
        order_index: section.order_index,
      });

      queryClient.invalidateQueries({ queryKey: ["checkSections"] });
    } catch (error) {
      console.error("Error moving section:", error);
      alert("Chyba při přesunu sekce");
    } finally {
      setIsMoving(false);
    }
  };

  const handleMoveSectionDown = async (section, index) => {
    if (index === sections.length - 1) return;
    
    setIsMoving(true);
    try {
      const nextSection = sections[index + 1];
      
      await base44.entities.LineCheckSection.update(section.id, {
        order_index: nextSection.order_index,
      });
      
      await base44.entities.LineCheckSection.update(nextSection.id, {
        order_index: section.order_index,
      });

      queryClient.invalidateQueries({ queryKey: ["checkSections"] });
    } catch (error) {
      console.error("Error moving section:", error);
      alert("Chyba při přesunu sekce");
    } finally {
      setIsMoving(false);
    }
  };

  const handleMovePointUp = async (point, sectionPoints, index) => {
    if (index === 0) return;
    
    setIsMoving(true);
    try {
      const prevPoint = sectionPoints[index - 1];
      
      await base44.entities.LineCheckPoint.update(point.id, {
        order_index: prevPoint.order_index,
      });
      
      await base44.entities.LineCheckPoint.update(prevPoint.id, {
        order_index: point.order_index,
      });

      queryClient.invalidateQueries({ queryKey: ["lineCheckPoints"] });
    } catch (error) {
      console.error("Error moving point:", error);
      alert("Chyba při přesunu bodu");
    } finally {
      setIsMoving(false);
    }
  };

  const handleMovePointDown = async (point, sectionPoints, index) => {
    if (index === sectionPoints.length - 1) return;
    
    setIsMoving(true);
    try {
      const nextPoint = sectionPoints[index + 1];
      
      await base44.entities.LineCheckPoint.update(point.id, {
        order_index: nextPoint.order_index,
      });
      
      await base44.entities.LineCheckPoint.update(nextPoint.id, {
        order_index: point.order_index,
      });

      queryClient.invalidateQueries({ queryKey: ["lineCheckPoints"] });
    } catch (error) {
      console.error("Error moving point:", error);
      alert("Chyba při přesunu bodu");
    } finally {
      setIsMoving(false);
    }
  };

  if (!line) {
    return (
      <div className="p-8 flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
      <div className="max-w-5xl mx-auto">
        <Button
          variant="ghost"
          onClick={() => navigate(createPageUrl(`LineDetail?id=${lineId}${companyId ? `&company=${companyId}` : ''}`))}
          className="mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Zpět na kartu linky
        </Button>

        <div className="flex items-center gap-2 text-sm text-slate-600 mb-4">
          <Building2 className="w-4 h-4" />
          <span>{company?.name || "Podnik"}</span>
          <ChevronRight className="w-4 h-4" />
          <span>{line.name}</span>
          <ChevronRight className="w-4 h-4" />
          <span className="font-semibold text-slate-900">Správa kontrolních bodů</span>
        </div>

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2">Kontrolní body linky</h1>
            <p className="text-slate-600">{line.name}</p>
          </div>
          <Button onClick={() => handleOpenSectionDialog()} className="gap-2 bg-gradient-to-r from-blue-600 to-blue-700">
            <Plus className="w-4 h-4" />
            Přidat sekci
          </Button>
        </div>

        {sections.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <ClipboardCheck className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500 mb-4">Zatím nejsou vytvořené žádné sekce</p>
              <Button onClick={() => handleOpenSectionDialog()} className="gap-2">
                <Plus className="w-4 h-4" />
                Vytvořit první sekci
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {sections.map((section, sectionIndex) => {
              const sectionPoints = allPoints.filter(p => p.section_id === section.id);

              return (
                <Card key={section.id} className="border-l-4 border-l-blue-600">
                  <CardHeader className="bg-slate-50">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <div className="flex flex-col gap-0.5">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleMoveSectionUp(section, sectionIndex)}
                            disabled={sectionIndex === 0 || isMoving}
                            className="h-5 w-5 p-0 hover:bg-slate-200"
                          >
                            <ChevronUp className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleMoveSectionDown(section, sectionIndex)}
                            disabled={sectionIndex === sections.length - 1 || isMoving}
                            className="h-5 w-5 p-0 hover:bg-slate-200"
                          >
                            <ChevronDown className="w-4 h-4" />
                          </Button>
                        </div>
                        <GripVertical className="w-5 h-5 text-slate-400" />
                        {section.name}
                      </CardTitle>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenPointDialog(section.id)}
                          className="gap-2"
                        >
                          <Plus className="w-4 h-4" />
                          Přidat bod
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleCopySection(section)}
                          disabled={isCopying}
                          className="gap-2"
                        >
                          <Copy className="w-4 h-4" />
                          Kopírovat
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleOpenSectionDialog(section)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setDeleteSectionId(section.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4">
                    {sectionPoints.length === 0 ? (
                      <p className="text-center text-slate-500 py-6 text-sm">
                        Žádné kontrolní body - klikněte na "Přidat bod"
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {sectionPoints.map((point, pointIndex) => (
                          <div
                            key={point.id}
                            className="flex items-start justify-between p-3 bg-white border border-slate-200 rounded-lg hover:border-slate-300 transition-colors"
                          >
                            <div className="flex items-start gap-2 flex-1">
                              <div className="flex flex-col gap-0.5 mt-1">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleMovePointUp(point, sectionPoints, pointIndex)}
                                  disabled={pointIndex === 0 || isMoving}
                                  className="h-4 w-4 p-0 hover:bg-slate-200"
                                >
                                  <ChevronUp className="w-3 h-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleMovePointDown(point, sectionPoints, pointIndex)}
                                  disabled={pointIndex === sectionPoints.length - 1 || isMoving}
                                  className="h-4 w-4 p-0 hover:bg-slate-200"
                                >
                                  <ChevronDown className="w-3 h-3" />
                                </Button>
                              </div>
                              <GripVertical className="w-4 h-4 text-slate-400 mt-1" />
                              <div className="flex-1">
                                <p className="font-medium text-slate-900">{point.name}</p>
                                {point.check_parameters && (
                                  <p className="text-sm text-slate-600">{point.check_parameters}</p>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-1 ml-4">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleCopyPoint(point, section.id)}
                                disabled={isCopying}
                                title="Kopírovat bod"
                              >
                                <Copy className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleOpenPointDialog(section.id, point)}
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setDeletePointId(point.id)}
                                className="text-red-600 hover:text-red-700"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        <Dialog open={showSectionDialog} onOpenChange={setShowSectionDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingSection ? "Upravit sekci" : "Přidat novou sekci"}
              </DialogTitle>
              <DialogDescription>
                Sekce slouží k organizaci kontrolních bodů linky
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="section_name">Název sekce *</Label>
                <Input
                  id="section_name"
                  value={sectionForm.name}
                  onChange={(e) => setSectionForm({ ...sectionForm, name: e.target.value })}
                  placeholder="Např. Tlak vedlejší, Množství, Teplota vzduchu..."
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowSectionDialog(false)}>
                Zrušit
              </Button>
              <Button
                onClick={handleSaveSection}
                disabled={!sectionForm.name.trim() || createSectionMutation.isLoading || updateSectionMutation.isLoading}
                className="bg-gradient-to-r from-blue-600 to-blue-700"
              >
                {(createSectionMutation.isLoading || updateSectionMutation.isLoading) ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : null}
                {editingSection ? "Uložit" : "Přidat sekci"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showPointDialog} onOpenChange={setShowPointDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingPoint ? "Upravit kontrolní bod" : "Přidat kontrolní bod"}
              </DialogTitle>
              <DialogDescription>
                Přidejte kontrolní bod do sekce
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="point_name">Název kontrolního bodu *</Label>
                <Input
                  id="point_name"
                  value={pointForm.name}
                  onChange={(e) => setPointForm({ ...pointForm, name: e.target.value })}
                  placeholder="Např. Tlak vzduch, Množství, Vteřiny..."
                />
              </div>
              <div>
                <Label htmlFor="check_parameters">Parametry kontroly</Label>
                <Textarea
                  id="check_parameters"
                  value={pointForm.check_parameters}
                  onChange={(e) => setPointForm({ ...pointForm, check_parameters: e.target.value })}
                  placeholder="Např. 'kontrolní ukazovky:viz pracovní běžná' nebo 'min: 5.5bar, max: 6.5bar'"
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowPointDialog(false)}>
                Zrušit
              </Button>
              <Button
                onClick={handleSavePoint}
                disabled={!pointForm.name.trim() || createPointMutation.isLoading || updatePointMutation.isLoading}
                className="bg-gradient-to-r from-blue-600 to-blue-700"
              >
                {(createPointMutation.isLoading || updatePointMutation.isLoading) ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : null}
                {editingPoint ? "Uložit" : "Přidat bod"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog open={!!deleteSectionId} onOpenChange={() => setDeleteSectionId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Opravdu smazat sekci?</AlertDialogTitle>
              <AlertDialogDescription>
                Smazáním sekce se smažou i všechny její kontrolní body. Tato akce je nevratná.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Zrušit</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteSectionMutation.mutate(deleteSectionId)}
                className="bg-red-600 hover:bg-red-700"
              >
                Smazat
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={!!deletePointId} onOpenChange={() => setDeletePointId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Opravdu smazat kontrolní bod?</AlertDialogTitle>
              <AlertDialogDescription>
                Tato akce je nevratná.
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