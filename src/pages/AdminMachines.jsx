import React, { useState } from "react";
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
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  Settings,
  Factory,
  Loader2
} from "lucide-react";
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
  const [formData, setFormData] = useState({ name: "", description: "" });

  const { data: line } = useQuery({
    queryKey: ["line", lineId],
    queryFn: async () => {
      const lines = await base44.entities.Line.list();
      return lines.find((l) => l.id === lineId);
    },
    enabled: !!lineId,
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["machines"] });
      setShowMachineDialog(false);
      setFormData({ name: "", description: "" });
    },
  });

  const updateMachineMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Machine.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["machines"] });
      setShowMachineDialog(false);
      setEditingMachine(null);
      setFormData({ name: "", description: "" });
    },
  });

  const deleteMachineMutation = useMutation({
    mutationFn: (id) => base44.entities.Machine.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["machines"] });
      setDeleteMachineId(null);
    },
  });

  const handleOpenDialog = (machine = null) => {
    if (machine) {
      setEditingMachine(machine);
      setFormData({ name: machine.name, description: machine.description || "" });
    } else {
      setEditingMachine(null);
      setFormData({ name: "", description: "" });
    }
    setShowMachineDialog(true);
  };

  const handleSaveMachine = async () => {
    if (!formData.name.trim()) return;

    if (editingMachine) {
      await updateMachineMutation.mutateAsync({
        id: editingMachine.id,
        data: formData,
      });
    } else {
      await createMachineMutation.mutateAsync({
        ...formData,
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
        <div className="flex items-center justify-between mb-8">
          <div>
            <Button
              variant="ghost"
              onClick={() => navigate(createPageUrl("AdminLines"))}
              className="mb-4"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Zpět na linky
            </Button>
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
            {machines.map((machine) => {
              const machinePoints = controlPoints.filter(
                (p) => p.machine_id === machine.id
              );
              return (
                <Card
                  key={machine.id}
                  className="hover:shadow-lg transition-all border-2 border-slate-200 hover:border-slate-300"
                >
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="text-xl font-bold text-slate-900 mb-1">
                          {machine.name}
                        </h3>
                        {machine.description && (
                          <p className="text-sm text-slate-600 mb-3">
                            {machine.description}
                          </p>
                        )}
                        <p className="text-sm text-slate-600">
                          {machinePoints.length} kontrolních bodů
                        </p>
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
            })}
          </div>
        )}

        <Dialog open={showMachineDialog} onOpenChange={setShowMachineDialog}>
          <DialogContent>
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