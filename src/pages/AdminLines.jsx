import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
  Factory,
  ChevronRight,
  Loader2,
  Copy,
  Building2,
  User,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function AdminLines() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const urlParams = new URLSearchParams(window.location.search);
  const companyId = urlParams.get("company");
  
  const [user, setUser] = useState(null);
  const [editingLine, setEditingLine] = useState(null);
  const [showLineDialog, setShowLineDialog] = useState(false);
  const [deleteLineId, setDeleteLineId] = useState(null);
  const [copyingLine, setCopyingLine] = useState(null);
  const [showCopyDialog, setShowCopyDialog] = useState(false);
  const [copyName, setCopyName] = useState("");
  const [formData, setFormData] = useState({ name: "", description: "", responsible_person_email: "" });

  React.useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    const currentUser = await base44.auth.me();
    setUser(currentUser);
  };

  const { data: company } = useQuery({
    queryKey: ["company", companyId],
    queryFn: async () => {
      if (!companyId) return null;
      const companies = await base44.entities.Company.list();
      return companies.find((c) => c.id === companyId);
    },
    enabled: !!companyId,
  });

  const { data: lines = [], isLoading } = useQuery({
    queryKey: ["lines", companyId],
    queryFn: () =>
      companyId
        ? base44.entities.Line.filter({ company_id: companyId }, "order_index", 1000)
        : [],
    enabled: !!companyId,
  });

  const { data: machines = [] } = useQuery({
    queryKey: ["machines"],
    queryFn: () => base44.entities.Machine.list("order_index", 1000),
  });

  const { data: controlPoints = [] } = useQuery({
    queryKey: ["controlPoints"],
    queryFn: () => base44.entities.ControlPoint.list(null, 1000),
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ["allUsers"],
    queryFn: async () => {
      const { data } = await base44.functions.invoke("getUsers");
      return data;
    },
  });

  const companyUsers = React.useMemo(() => {
    if (!user || !companyId) return [];
    
    // Zobrazit všechny uživatele, kteří patří k podniku nebo k němu mají přístup (assigned_company_ids)
    return allUsers.filter(u => 
      u.company_id === companyId || 
      (Array.isArray(u.assigned_company_ids) && u.assigned_company_ids.includes(companyId))
    );
  }, [allUsers, companyId, user]);

  const getUserDisplayName = (email) => {
    const u = allUsers.find(usr => usr.email === email);
    return u ? (u.custom_display_name || u.full_name || u.email) : email;
  };

  const createLineMutation = useMutation({
    mutationFn: (data) => base44.entities.Line.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lines"] });
      setShowLineDialog(false);
      setFormData({ name: "", description: "", responsible_person_email: "" });
    },
  });

  const updateLineMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Line.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lines"] });
      setShowLineDialog(false);
      setEditingLine(null);
      setFormData({ name: "", description: "", responsible_person_email: "" });
    },
  });

  const deleteLineMutation = useMutation({
    mutationFn: (id) => base44.entities.Line.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lines"] });
      setDeleteLineId(null);
    },
  });

  const moveLineMutation = useMutation({
    mutationFn: ({ id, newIndex }) => base44.entities.Line.update(id, { order_index: newIndex }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lines"] });
    },
  });

  const handleMoveUp = async (index) => {
    if (index === 0) return;
    const line1 = lines[index];
    const line2 = lines[index - 1];
    await Promise.all([
      moveLineMutation.mutateAsync({ id: line1.id, newIndex: index - 1 }),
      moveLineMutation.mutateAsync({ id: line2.id, newIndex: index }),
    ]);
  };

  const handleMoveDown = async (index) => {
    if (index === lines.length - 1) return;
    const line1 = lines[index];
    const line2 = lines[index + 1];
    await Promise.all([
      moveLineMutation.mutateAsync({ id: line1.id, newIndex: index + 1 }),
      moveLineMutation.mutateAsync({ id: line2.id, newIndex: index }),
    ]);
  };

  const handleOpenDialog = (line = null) => {
    if (line) {
      setEditingLine(line);
      setFormData({ 
        name: line.name, 
        description: line.description || "",
        responsible_person_email: line.responsible_person_email || ""
      });
    } else {
      setEditingLine(null);
      setFormData({ name: "", description: "", responsible_person_email: "" });
    }
    setShowLineDialog(true);
  };

  const handleSaveLine = async () => {
    if (!formData.name.trim()) return;

    if (editingLine) {
      await updateLineMutation.mutateAsync({
        id: editingLine.id,
        data: formData,
      });
    } else {
      await createLineMutation.mutateAsync({
        ...formData,
        company_id: companyId,
        order_index: lines.length,
      });
    }
  };

  const handleDeleteLine = async () => {
    if (deleteLineId) {
      await deleteLineMutation.mutateAsync(deleteLineId);
    }
  };

  const handleOpenCopyDialog = (line) => {
    setCopyingLine(line);
    setCopyName(`${line.name} - Kopie`);
    setShowCopyDialog(true);
  };

  const handleCopyLine = async () => {
    if (!copyName.trim() || !copyingLine) return;

    // Check for existing line with same name
    const existingLine = lines.find(l => l.name.toLowerCase() === copyName.trim().toLowerCase());
    if (existingLine) {
        alert("Linka s tímto názvem již existuje.");
        return;
    }

    try {
      // 1. Vytvořit novou linku
      const newLine = await base44.entities.Line.create({
        name: copyName,
        description: copyingLine.description || "",
        company_id: copyingLine.company_id,
        responsible_person_email: copyingLine.responsible_person_email || "",
        order_index: lines.length,
      });

      // 2. Najít všechny stroje původní linky
      const lineMachines = machines.filter((m) => m.line_id === copyingLine.id);

      // 3. Vytvořit kopie strojů a kontrolních bodů
      for (const machine of lineMachines) {
        // Vytvořit nový stroj
        const newMachine = await base44.entities.Machine.create({
          name: machine.name,
          description: machine.description || "",
          line_id: newLine.id,
          order_index: machine.order_index,
          maintenance_category: machine.maintenance_category || "lubrication",
          prevention_confirmation_method: machine.prevention_confirmation_method || "manual",
          inventory_number: machine.inventory_number || null,
          location: machine.location || null,
          machine_type: machine.machine_type || null,
        });

        // Najít všechny kontrolní body tohoto stroje
        const machinePoints = controlPoints.filter(
          (p) => p.machine_id === machine.id
        );

        // Vytvořit kopie kontrolních bodů
        for (const point of machinePoints) {
          await base44.entities.ControlPoint.create({
            machine_id: newMachine.id,
            type: point.type,
            number: point.number || "",
            name: point.name,
            description: point.description || "",
            lubricant_type: point.lubricant_type || "",
            lubricant_amount: point.lubricant_amount || null,
            interval_hours: point.interval_hours || null,
            inspection_tasks: point.inspection_tasks || "",
          });
        }
      }

      // Refresh dat
      queryClient.invalidateQueries({ queryKey: ["lines"] });
      queryClient.invalidateQueries({ queryKey: ["machines"] });
      queryClient.invalidateQueries({ queryKey: ["controlPoints"] });

      setShowCopyDialog(false);
      setCopyingLine(null);
      setCopyName("");
    } catch (error) {
      console.error("Error copying line:", error);
      alert("Chyba při kopírování linky: " + error.message);
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

  if (!companyId) {
    navigate(createPageUrl("AdminCompanies"));
    return null;
  }

  return (
    <div className="p-4 md:p-8 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => navigate(createPageUrl("AdminCompanies"))}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Zpět na podniky
          </Button>

          {/* Breadcrumbs */}
          <div className="flex items-center gap-2 text-sm text-slate-600 mb-4 mt-4">
            <Building2 className="w-4 h-4" />
            <button
              onClick={() => navigate(createPageUrl("AdminCompanies"))}
              className="hover:text-slate-900 transition-colors"
            >
              Správa podniků
            </button>
            <ChevronRight className="w-4 h-4 text-slate-400" />
            <span className="font-semibold text-slate-900">{company?.name}</span>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">
                Správa linek: {company?.name}
              </h1>
              <p className="text-slate-600 mt-1">{lines.length} linek</p>
            </div>
            <Button
              onClick={() => handleOpenDialog()}
              className="bg-gradient-to-r from-red-600 to-red-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Přidat linku
            </Button>
          </div>
        </div>

        {lines.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Factory className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-900 mb-2">
                Zatím nemáte žádné linky
              </h3>
              <p className="text-slate-500 mb-6">
                Začněte vytvořením první výrobní linky
              </p>
              <Button
                onClick={() => handleOpenDialog()}
                className="bg-gradient-to-r from-red-600 to-red-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                Vytvořit první linku
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {lines.map((line, index) => {
              const lineMachines = machines.filter((m) => m.line_id === line.id);
              const lineMachineIds = lineMachines.map(m => m.id);
              const linePoints = controlPoints.filter((p) => 
                lineMachineIds.includes(p.machine_id)
              );

              return (
                <Card
                  key={line.id}
                  className="hover:shadow-lg transition-all border-2 border-slate-200 hover:border-slate-300"
                >
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
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
                          disabled={index === lines.length - 1}
                        >
                          <ArrowDown className="w-4 h-4" />
                        </Button>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h3 className="text-xl font-bold text-slate-900 mb-1">
                              {line.name}
                            </h3>
                            {line.description && (
                              <p className="text-sm text-slate-600 mb-2">{line.description}</p>
                            )}
                            {line.responsible_person_email && (
                              <div className="flex items-center gap-1 text-sm text-slate-600">
                                <User className="w-4 h-4" />
                                <span>{getUserDisplayName(line.responsible_person_email)}</span>
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenCopyDialog(line)}
                              title="Kopírovat linku se stroji"
                            >
                              <Copy className="w-4 h-4 text-blue-600" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenDialog(line)}
                            >
                              <Pencil className="w-4 h-4 text-slate-600" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDeleteLineId(line.id)}
                            >
                              <Trash2 className="w-4 h-4 text-red-600" />
                            </Button>
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4 text-sm text-slate-600">
                            <span>{lineMachines.length} strojů</span>
                            <span>·</span>
                            <span>{linePoints.length} kontrolních bodů</span>
                          </div>
                          <Button
                            variant="outline"
                            onClick={() =>
                              navigate(createPageUrl(`AdminMachines?line=${line.id}`))
                            }
                          >
                            Spravovat stroje
                            <ChevronRight className="w-4 h-4 ml-2" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Dialog pro vytvoření/editaci linky */}
        <Dialog open={showLineDialog} onOpenChange={setShowLineDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingLine ? "Upravit linku" : "Nová linka"}
              </DialogTitle>
              <DialogDescription>
                {editingLine
                  ? "Upravte informace o lince"
                  : "Vytvořte novou výrobní linku"}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="name">Název linky *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="např. Linka 1 - Lisování"
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
                  placeholder="Volitelný popis linky"
                  rows={3}
                />
              </div>
              <div>
                <Label htmlFor="responsible_person">Odpovědná osoba</Label>
                <Select
                  value={formData.responsible_person_email}
                  onValueChange={(value) =>
                    setFormData({ ...formData, responsible_person_email: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Vyberte odpovědnou osobu" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={null}>Bez odpovědné osoby</SelectItem>
                    {companyUsers.map((usr) => (
                      <SelectItem key={usr.email} value={usr.email}>
                        {usr.custom_display_name || usr.full_name || usr.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowLineDialog(false)}
              >
                Zrušit
              </Button>
              <Button
                onClick={handleSaveLine}
                disabled={!formData.name.trim()}
                className="bg-gradient-to-r from-red-600 to-red-700"
              >
                {editingLine ? "Uložit změny" : "Vytvořit linku"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog pro kopírování linky */}
        <Dialog open={showCopyDialog} onOpenChange={setShowCopyDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Kopírovat linku</DialogTitle>
              <DialogDescription>
                Vytvoří se kopie linky "{copyingLine?.name}" včetně všech strojů a kontrolních bodů
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="copyName">Název nové linky *</Label>
                <Input
                  id="copyName"
                  value={copyName}
                  onChange={(e) => setCopyName(e.target.value)}
                  placeholder="např. Linka 2 - Lisování"
                />
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-900">
                  <strong>Co se zkopíruje:</strong>
                </p>
                <ul className="text-sm text-blue-800 mt-2 space-y-1 list-disc list-inside">
                  <li>Všechny stroje linky</li>
                  <li>Všechny kontrolní body strojů</li>
                  <li>Nastavení mazání a intervalů</li>
                </ul>
                <p className="text-xs text-blue-700 mt-2">
                  Poznámka: Historie záznamů a závady se nekopírují
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowCopyDialog(false)}
              >
                Zrušit
              </Button>
              <Button
                onClick={handleCopyLine}
                disabled={!copyName.trim()}
                className="bg-gradient-to-r from-blue-600 to-blue-700"
              >
                <Copy className="w-4 h-4 mr-2" />
                Zkopírovat linku
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog pro potvrzení smazání */}
        <AlertDialog
          open={!!deleteLineId}
          onOpenChange={() => setDeleteLineId(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Opravdu smazat linku?</AlertDialogTitle>
              <AlertDialogDescription>
                Tato akce je nevratná. Budou smazány také všechny stroje a
                kontrolní body patřící k této lince.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Zrušit</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteLine}
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