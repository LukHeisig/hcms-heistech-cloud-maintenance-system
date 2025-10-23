import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  GripVertical,
  Factory,
  ChevronRight,
  Loader2
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function AdminLines() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [editingLine, setEditingLine] = useState(null);
  const [showLineDialog, setShowLineDialog] = useState(false);
  const [deleteLineId, setDeleteLineId] = useState(null);
  const [formData, setFormData] = useState({ name: "", description: "" });

  React.useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    const currentUser = await base44.auth.me();
    setUser(currentUser);
  };

  const { data: lines = [], isLoading } = useQuery({
    queryKey: ["lines", user?.customer_id],
    queryFn: () =>
      user?.customer_id
        ? base44.entities.Line.filter({ customer_id: user.customer_id }, "order_index")
        : [],
    enabled: !!user?.customer_id,
  });

  const { data: machines = [] } = useQuery({
    queryKey: ["machines"],
    queryFn: () => base44.entities.Machine.list(),
  });

  const createLineMutation = useMutation({
    mutationFn: (data) => base44.entities.Line.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lines"] });
      setShowLineDialog(false);
      setFormData({ name: "", description: "" });
    },
  });

  const updateLineMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Line.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lines"] });
      setShowLineDialog(false);
      setEditingLine(null);
      setFormData({ name: "", description: "" });
    },
  });

  const deleteLineMutation = useMutation({
    mutationFn: (id) => base44.entities.Line.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lines"] });
      setDeleteLineId(null);
    },
  });

  const handleOpenDialog = (line = null) => {
    if (line) {
      setEditingLine(line);
      setFormData({ name: line.name, description: line.description || "" });
    } else {
      setEditingLine(null);
      setFormData({ name: "", description: "" });
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
        customer_id: user.customer_id,
        order_index: lines.length,
      });
    }
  };

  const handleDeleteLine = async () => {
    if (deleteLineId) {
      await deleteLineMutation.mutateAsync(deleteLineId);
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
              onClick={() => navigate(createPageUrl("Admin"))}
              className="mb-4"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Zpět na administraci
            </Button>
            <h1 className="text-3xl font-bold text-slate-900">Správa linek</h1>
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
            {lines.map((line) => {
              const lineMachines = machines.filter((m) => m.line_id === line.id);
              return (
                <Card
                  key={line.id}
                  className="hover:shadow-lg transition-all border-2 border-slate-200 hover:border-slate-300"
                >
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0 mt-1">
                        <GripVertical className="w-5 h-5 text-slate-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h3 className="text-xl font-bold text-slate-900 mb-1">
                              {line.name}
                            </h3>
                            {line.description && (
                              <p className="text-sm text-slate-600">{line.description}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
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
                          <p className="text-sm text-slate-600">
                            {lineMachines.length} strojů
                          </p>
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