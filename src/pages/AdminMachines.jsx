import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  Settings,
  Factory,
  Loader2,
  Copy,
  ChevronRight,
  Building2,
  Droplet,
  ClipboardCheck,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function AdminMachines() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const urlParams = new URLSearchParams(window.location.search);
  const lineId = urlParams.get("line");

  const [editingMachine, setEditingMachine] = useState(null);
  const [showMachineDialog, setShowMachineDialog] = useState(false);
  const [deleteMachineId, setDeleteMachineId] = useState(null);
  const [copyingMachine, setCopyingMachine] = useState(null);
  const [showCopyDialog, setShowCopyDialog] = useState(false);
  const [copyName, setCopyName] = useState("");
  const [user, setUser] = useState(null);
  const [maintenanceFilter, setMaintenanceFilter] = useState("all");
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    inventory_number: "",
    location: "",
    machine_type: null,
    maintenance_category: "lubrication",
    prevention_confirmation_method: "manual"
  });

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    const currentUser = await base44.auth.me();
    setUser(currentUser);
  };

  // Helper funkce pro vytvoření audit logu
  const createAuditLog = async (entityType, entityId, description) => {
    if (!user) {
      console.warn("Audit log cannot be created: user not loaded.");
      return;
    }
    try {
      await base44.entities.AuditLog.create({
        entity_type: entityType,
        entity_id: entityId,
        changed_by: user.email,
        change_description: description,
        user_type: user.user_type,
        company_id: user.company_id || null,
      });
    } catch (error) {
      console.error("Error creating audit log:", error);
    }
  };

  const { data: line } = useQuery({
    queryKey: ["line", lineId],
    queryFn: async () => {
      const lines = await base44.entities.Line.list();
      return lines.find((l) => l.id === lineId);
    },
    enabled: !!lineId,
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

  const { data: machines = [], isLoading } = useQuery({
    queryKey: ["machines", lineId],
    queryFn: () =>
      base44.entities.Machine.filter({ line_id: lineId }, "order_index"),
    enabled: !!lineId,
  });

  const { data: controlPoints = [] } = useQuery({
    queryKey: ["controlPoints"],
    queryFn: () => base44.entities.ControlPoint.list(),
  });

  const createMachineMutation = useMutation({
    mutationFn: (data) => base44.entities.Machine.create(data),
    onSuccess: async (newMachine) => {
      await createAuditLog(
        "Machine",
        newMachine.id,
        `Vytvořil nový stroj "${newMachine.name}"`
      );
      queryClient.invalidateQueries({ queryKey: ["machines"] });
      queryClient.invalidateQueries({ queryKey: ["auditLogs"] });
      setShowMachineDialog(false);
      setFormData({ name: "", description: "", inventory_number: "", location: "", machine_type: null, maintenance_category: "lubrication", prevention_confirmation_method: "manual" });
    },
  });

  const updateMachineMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Machine.update(id, data),
    onSuccess: async (updatedMachine, variables) => {
      const oldMachine = machines.find(m => m.id === variables.id);
      const changes = [];
      if (oldMachine && oldMachine.name !== updatedMachine.name) changes.push(`název na "${updatedMachine.name}"`);
      if (oldMachine && oldMachine.inventory_number !== updatedMachine.inventory_number) changes.push(`inventární číslo na "${updatedMachine.inventory_number || "null"}"`);
      if (oldMachine && oldMachine.location !== updatedMachine.location) changes.push(`umístění na "${updatedMachine.location || "null"}"`);
      if (oldMachine && oldMachine.machine_type !== updatedMachine.machine_type) changes.push(`typ stroje na "${updatedMachine.machine_type || "null"}"`);
      if (oldMachine && oldMachine.description !== updatedMachine.description) changes.push(`popis`);
      
      await createAuditLog(
        "Machine",
        updatedMachine.id,
        `Aktualizoval stroj "${updatedMachine.name}"${changes.length > 0 ? `: změnil ${changes.join(", ")}` : ""}`
      );
      queryClient.invalidateQueries({ queryKey: ["machines"] });
      queryClient.invalidateQueries({ queryKey: ["auditLogs"] });
      setShowMachineDialog(false);
      setEditingMachine(null);
      setFormData({ name: "", description: "", inventory_number: "", location: "", machine_type: null, maintenance_category: "lubrication", prevention_confirmation_method: "manual" });
    },
  });

  const deleteMachineMutation = useMutation({
    mutationFn: (id) => base44.entities.Machine.delete(id),
    onSuccess: async (_, deletedId) => {
      const deletedMachine = machines.find(m => m.id === deletedId);
      await createAuditLog(
        "Machine",
        deletedId,
        `Smazal stroj "${deletedMachine?.name || "Neznámý stroj"}"`
      );
      queryClient.invalidateQueries({ queryKey: ["machines"] });
      queryClient.invalidateQueries({ queryKey: ["auditLogs"] });
      setDeleteMachineId(null);
    },
  });

  const moveMachineMutation = useMutation({
    mutationFn: ({ id, newIndex }) => base44.entities.Machine.update(id, { order_index: newIndex }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["machines"] });
    },
  });

  const handleMoveUp = async (index, filteredMachines) => {
    if (index === 0) return;
    const machine1 = filteredMachines[index];
    const machine2 = filteredMachines[index - 1];
    await Promise.all([
      moveMachineMutation.mutateAsync({ id: machine1.id, newIndex: machine2.order_index }),
      moveMachineMutation.mutateAsync({ id: machine2.id, newIndex: machine1.order_index }),
    ]);
  };

  const handleMoveDown = async (index, filteredMachines) => {
    if (index === filteredMachines.length - 1) return;
    const machine1 = filteredMachines[index];
    const machine2 = filteredMachines[index + 1];
    await Promise.all([
      moveMachineMutation.mutateAsync({ id: machine1.id, newIndex: machine2.order_index }),
      moveMachineMutation.mutateAsync({ id: machine2.id, newIndex: machine1.order_index }),
    ]);
  };

  const handleOpenDialog = (machine = null) => {
    if (machine) {
      setEditingMachine(machine);
      setFormData({
        name: machine.name,
        description: machine.description || "",
        inventory_number: machine.inventory_number || "",
        location: machine.location || "",
        machine_type: machine.machine_type || null,
        maintenance_category: machine.maintenance_category || "lubrication",
        prevention_confirmation_method: machine.prevention_confirmation_method || "manual"
      });
    } else {
      setEditingMachine(null);
      setFormData({
        name: "",
        description: "",
        inventory_number: "",
        location: "",
        machine_type: null,
        maintenance_category: "lubrication",
        prevention_confirmation_method: "manual"
      });
    }
    setShowMachineDialog(true);
  };

  const handleSaveMachine = async () => {
    if (!formData.name.trim()) return;

    const dataToSave = {
      name: formData.name.trim(),
      description: formData.description.trim() || null,
      inventory_number: formData.inventory_number.trim() || null,
      location: formData.location.trim() || null,
      machine_type: formData.machine_type || null,
      maintenance_category: formData.maintenance_category || "lubrication",
      prevention_confirmation_method: formData.prevention_confirmation_method || "manual",
    };

    if (editingMachine) {
      await updateMachineMutation.mutateAsync({
        id: editingMachine.id,
        data: dataToSave,
      });
    } else {
      await createMachineMutation.mutateAsync({
        ...dataToSave,
        line_id: lineId,
        order_index: machines.length,
      });
    }
  };

  const handleDeleteMachine = async () => {
    if (deleteMachineId) {
      await deleteMachineMutation.mutateAsync(deleteMachineId);
    }
  };

  const handleOpenCopyDialog = (machine) => {
    setCopyingMachine(machine);
    setCopyName(`${machine.name} - Kopie`);
    setShowCopyDialog(true);
  };

  const handleCopyMachine = async () => {
    if (!copyName.trim() || !copyingMachine) return;

    try {
      // 1. Vytvořit nový stroj
      const newMachine = await base44.entities.Machine.create({
        name: copyName.trim(),
        description: copyingMachine.description || null,
        line_id: copyingMachine.line_id,
        order_index: machines.length,
        inventory_number: null, // Do not copy inventory number by default
        location: copyingMachine.location || null,
        machine_type: copyingMachine.machine_type || null,
        maintenance_category: copyingMachine.maintenance_category || "lubrication"
      });

      // 2. Najít všechny kontrolní body původního stroje
      const machinePoints = controlPoints.filter(
        (p) => p.machine_id === copyingMachine.id
      );

      // 3. Vytvořit kopie kontrolních bodů
      for (const point of machinePoints) {
        await base44.entities.ControlPoint.create({
          machine_id: newMachine.id,
          type: point.type,
          number: point.number || null,
          name: point.name,
          description: point.description || null,
          lubricant_type: point.lubricant_type || null,
          lubricant_amount: point.lubricant_amount || null,
          interval_hours: point.interval_hours || null,
          inspection_tasks: point.inspection_tasks || null,
        });
      }

      await createAuditLog(
        "Machine",
        newMachine.id,
        `Zkopíroval stroj "${copyingMachine.name}" jako "${copyName}" (včetně ${machinePoints.length} kontrolních bodů)`
      );

      // Refresh dat
      queryClient.invalidateQueries({ queryKey: ["machines"] });
      queryClient.invalidateQueries({ queryKey: ["controlPoints"] });
      queryClient.invalidateQueries({ queryKey: ["auditLogs"] });

      setShowCopyDialog(false);
      setCopyingMachine(null);
      setCopyName("");
    } catch (error) {
      console.error("Error copying machine:", error);
      alert("Chyba při kopírování stroje: " + error.message);
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
            onClick={() => navigate(createPageUrl(`AdminLines?company=${line?.company_id}`))}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Zpět na linky
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
            <span className="font-semibold text-slate-900">Stroje</span>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">
                Stroje linky: {line?.name}
              </h1>
              <p className="text-slate-600 mt-1">{machines.length} strojů</p>
            </div>
            <Button
              onClick={() => handleOpenDialog()}
              className="bg-gradient-to-r from-red-600 to-red-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Přidat stroj
            </Button>
          </div>
        </div>

        <Tabs value={maintenanceFilter} onValueChange={setMaintenanceFilter} className="mb-6">
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="all">Vše ({machines.length})</TabsTrigger>
            <TabsTrigger value="lubrication" className="gap-2">
              <Droplet className="w-4 h-4" />
              Mazání ({machines.filter(m => m.maintenance_category === "lubrication").length})
            </TabsTrigger>
            <TabsTrigger value="prevention" className="gap-2">
              <ClipboardCheck className="w-4 h-4" />
              Prevence ({machines.filter(m => m.maintenance_category === "prevention").length})
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {machines.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Factory className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-900 mb-2">
                Zatím nemáte žádné stroje
              </h3>
              <p className="text-slate-500 mb-6">
                Začněte přidáním prvního stroje
              </p>
              <Button
                onClick={() => handleOpenDialog()}
                className="bg-gradient-to-r from-red-600 to-red-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                Vytvořit první stroj
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {(() => {
              const filteredMachines = machines.filter(m => maintenanceFilter === "all" || m.maintenance_category === maintenanceFilter);
              return filteredMachines.map((machine, index) => {
              const machinePoints = controlPoints.filter(
                (p) => p.machine_id === machine.id
              );
              return (
                <Card
                  key={machine.id}
                  className="hover:shadow-lg transition-all border-2 border-slate-200 hover:border-slate-300"
                >
                  <CardContent className="p-6">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 mt-1 flex flex-col gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => handleMoveUp(index, filteredMachines)}
                          disabled={index === 0}
                        >
                          <ArrowUp className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => handleMoveDown(index, filteredMachines)}
                          disabled={index === filteredMachines.length - 1}
                        >
                          <ArrowDown className="w-4 h-4" />
                        </Button>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-xl font-bold text-slate-900">
                            {machine.name}
                          </h3>
                          <Badge className={
                            machine.maintenance_category === "lubrication"
                              ? "bg-blue-100 text-blue-700"
                              : "bg-orange-100 text-orange-700"
                          }>
                            {machine.maintenance_category === "lubrication" ? "Mazání" : "Prevence"}
                          </Badge>
                        </div>
                        {machine.inventory_number && (
                          <p className="text-sm text-slate-600">
                            Inventární číslo: {machine.inventory_number}
                          </p>
                        )}
                        {machine.location && (
                          <p className="text-sm text-slate-600">
                            Umístění: {machine.location}
                          </p>
                        )}
                        {machine.description && (
                          <p className="text-sm text-slate-600 mb-3">
                            {machine.description}
                          </p>
                        )}
                        <p className="text-sm text-slate-600">
                          {machinePoints.length} kontrolních bodů
                        </p>
                      </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            navigate(
                              createPageUrl(
                                `AdminControlPoints?machine=${machine.id}`
                              )
                            )
                          }
                        >
                          <Settings className="w-4 h-4 mr-2" />
                          Kontrolní body
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenCopyDialog(machine)}
                          title="Kopírovat stroj"
                        >
                          <Copy className="w-4 h-4 text-blue-600" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenDialog(machine)}
                        >
                          <Pencil className="w-4 h-4 text-slate-600" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteMachineId(machine.id)}
                        >
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
              });
              })()}
              </div>
              )}

        <Dialog open={showMachineDialog} onOpenChange={setShowMachineDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingMachine ? "Upravit stroj" : "Nový stroj"}
              </DialogTitle>
              <DialogDescription>
                {editingMachine
                  ? "Upravte informace o stroji"
                  : "Vytvořte nový stroj"}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Název stroje *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    placeholder="např. Lis LH-500"
                  />
                </div>
                <div>
                  <Label htmlFor="inventory_number">Inventární číslo</Label>
                  <Input
                    id="inventory_number"
                    value={formData.inventory_number}
                    onChange={(e) =>
                      setFormData({ ...formData, inventory_number: e.target.value })
                    }
                    placeholder="např. ST-001"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="machine_type">Typ zařízení</Label>
                  <Select
                    value={formData.machine_type || ""}
                    onValueChange={(value) =>
                      setFormData({ ...formData, machine_type: value || null })
                    }
                  >
                    <SelectTrigger id="machine_type">
                      <SelectValue placeholder="Vyberte typ" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="press">Lis</SelectItem>
                      <SelectItem value="conveyor">Dopravník</SelectItem>
                      <SelectItem value="pump">Čerpadlo</SelectItem>
                      <SelectItem value="fan">Ventilátor</SelectItem>
                      <SelectItem value="compressor">Kompresor</SelectItem>
                      <SelectItem value="motor">Motor</SelectItem>
                      <SelectItem value="gearbox">Převodovka</SelectItem>
                      <SelectItem value="crane">Jeřáb</SelectItem>
                      <SelectItem value="robot">Robot</SelectItem>
                      <SelectItem value="cnc_machine">CNC stroj</SelectItem>
                      <SelectItem value="welding_machine">Svářečka</SelectItem>
                      <SelectItem value="other">Jiné</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="location">Umístění</Label>
                  <Input
                    id="location"
                    value={formData.location}
                    onChange={(e) =>
                      setFormData({ ...formData, location: e.target.value })
                    }
                    placeholder="např. Hala A, sekce 2"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="maintenance_category">Kategorie údržby</Label>
                <Select
                  value={formData.maintenance_category}
                  onValueChange={(value) =>
                    setFormData({ ...formData, maintenance_category: value })
                  }
                >
                  <SelectTrigger id="maintenance_category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lubrication">Mazání</SelectItem>
                    <SelectItem value="prevention">Prevence</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formData.maintenance_category === "prevention" && (
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
                <Label htmlFor="description">Popis</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="Volitelný popis stroje"
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowMachineDialog(false)}
              >
                Zrušit
              </Button>
              <Button
                onClick={handleSaveMachine}
                disabled={!formData.name.trim()}
                className="bg-gradient-to-r from-red-600 to-red-700"
              >
                {editingMachine ? "Uložit změny" : "Vytvořit stroj"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog pro kopírování stroje */}
        <Dialog open={showCopyDialog} onOpenChange={setShowCopyDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Kopírovat stroj</DialogTitle>
              <DialogDescription>
                Vytvoří se kopie stroje "{copyingMachine?.name}" včetně všech kontrolních bodů
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="copyName">Název nového stroje *</Label>
                <Input
                  id="copyName"
                  value={copyName}
                  onChange={(e) => setCopyName(e.target.value)}
                  placeholder="např. Lis LH-501"
                />
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-900">
                  <strong>Co se zkopíruje:</strong>
                </p>
                <ul className="text-sm text-blue-800 mt-2 space-y-1 list-disc list-inside">
                  <li>Všechny kontrolní body stroje</li>
                  <li>Nastavení mazání a intervalů</li>
                  <li>Inspekční úkoly</li>
                </ul>
                <p className="text-xs text-blue-700 mt-2">
                  Poznámka: Historie záznamů, závady a dokumentace se nekopírují
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
                onClick={handleCopyMachine}
                disabled={!copyName.trim()}
                className="bg-gradient-to-r from-blue-600 to-blue-700"
              >
                <Copy className="w-4 h-4 mr-2" />
                Zkopírovat stroj
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog
          open={!!deleteMachineId}
          onOpenChange={() => setDeleteMachineId(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Opravdu smazat stroj?</AlertDialogTitle>
              <AlertDialogDescription>
                Tato akce je nevratná. Budou smazány také všechny kontrolní body
                patřící k tomuto stroji.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Zrušit</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteMachine}
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