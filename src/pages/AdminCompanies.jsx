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
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  Building2,
  ChevronRight,
  Loader2,
  CheckSquare
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function AdminCompanies() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editingCompany, setEditingCompany] = useState(null);
  const [showDialog, setShowDialog] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    address: "",
    contact_person: "",
    email: "",
    phone: "",
    enable_demip: true,
    enable_maintenance: true,
    enable_parts: true,
    enable_vibration: true,
    enable_thermo: true,
    enable_tribo: true,
    allow_manual_confirmation: true,
    force_technician_demip_mobile: false,
    overdue_visualization_type: "two_colors",
    overdue_tolerance_percent: 4,
  });

  const { data: allCompanies = [], isLoading } = useQuery({
    queryKey: ["companies"],
    queryFn: () => base44.entities.Company.list("name"),
  });

  const { data: currentUser } = useQuery({
    queryKey: ["currentUser"],
    queryFn: () => base44.auth.me(),
  });

  // Filtrovat podniky podle přístupových práv
  const companies = React.useMemo(() => {
    if (!currentUser) return [];
    if (currentUser.user_type === "superAdmin") return allCompanies;
    if (currentUser.user_type === "admin") {
      return allCompanies.filter(c => 
        currentUser.assigned_company_ids?.includes(c.id)
      );
    }
    if (currentUser.user_type === "manager") {
      return allCompanies.filter(c => c.id === currentUser.company_id);
    }
    return [];
  }, [allCompanies, currentUser]);

  const { data: lines = [] } = useQuery({
    queryKey: ["allLines"],
    queryFn: () => base44.entities.Line.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Company.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companies"] });
      setShowDialog(false);
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Company.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companies"] });
      setShowDialog(false);
      setEditingCompany(null);
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Company.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companies"] });
      setDeleteId(null);
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      address: "",
      contact_person: "",
      email: "",
      phone: "",
      enable_demip: true,
      enable_maintenance: true,
      enable_parts: true,
      enable_vibration: true,
      enable_thermo: true,
      enable_tribo: true,
      allow_manual_confirmation: true,
      force_technician_demip_mobile: false,
      overdue_visualization_type: "two_colors",
      overdue_tolerance_percent: 4,
    });
  };

  const handleOpenDialog = (company = null) => {
    if (company) {
      setEditingCompany(company);
      setFormData({
        name: company.name,
        address: company.address || "",
        contact_person: company.contact_person || "",
        email: company.email || "",
        phone: company.phone || "",
        enable_demip: company.enable_demip !== false,
        enable_maintenance: company.enable_maintenance !== false,
        enable_parts: company.enable_parts !== false,
        enable_vibration: company.enable_vibration !== false,
        enable_thermo: company.enable_thermo !== false,
        enable_tribo: company.enable_tribo !== false,
        allow_manual_confirmation: company.allow_manual_confirmation !== false,
        force_technician_demip_mobile: company.force_technician_demip_mobile === true,
        overdue_visualization_type: company.overdue_visualization_type || "two_colors",
        overdue_tolerance_percent: company.overdue_tolerance_percent || 4,
      });
    } else {
      setEditingCompany(null);
      resetForm();
    }
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) return;

    if (editingCompany) {
      await updateMutation.mutateAsync({
        id: editingCompany.id,
        data: formData,
      });
    } else {
      await createMutation.mutateAsync(formData);
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
            <h1 className="text-3xl font-bold text-slate-900">Správa podniků</h1>
            <p className="text-slate-600 mt-1">
              {companies.length} {currentUser?.user_type === "superAdmin" ? "podniků" : "přiřazených podniků"}
            </p>
          </div>
          {currentUser?.user_type === "superAdmin" && (
            <Button
              onClick={() => handleOpenDialog()}
              className="bg-gradient-to-r from-red-600 to-red-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Přidat podnik
            </Button>
          )}
        </div>

        {companies.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Building2 className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-900 mb-2">
                Zatím nemáte žádné podniky
              </h3>
              <p className="text-slate-500 mb-6">
                Začněte vytvořením prvního podniku
              </p>
              {currentUser?.user_type === "superAdmin" && (
                <Button
                  onClick={() => handleOpenDialog()}
                  className="bg-gradient-to-r from-red-600 to-red-700"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Vytvořit první podnik
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {companies.map((company) => {
              const companyLines = lines.filter((l) => l.company_id === company.id);
              return (
                <Card
                  key={company.id}
                  className="hover:shadow-lg transition-all border-2 border-slate-200 hover:border-slate-300"
                >
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-4 flex-1">
                        <div className="w-12 h-12 bg-gradient-to-br from-red-600 to-red-700 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
                          <Building2 className="w-7 h-7 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-xl font-bold text-slate-900 mb-1">
                            {company.name}
                          </h3>
                          {company.address && (
                            <p className="text-sm text-slate-600 mb-1">{company.address}</p>
                          )}
                          <div className="flex items-center gap-4 text-sm text-slate-600">
                            <span>{companyLines.length} linek</span>
                            {company.contact_person && <span>· {company.contact_person}</span>}
                            {company.phone && <span>· {company.phone}</span>}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            navigate(createPageUrl(`AdminLines?company=${company.id}`))
                          }
                        >
                          Linky
                          <ChevronRight className="w-4 h-4 ml-1" />
                        </Button>
                        {(currentUser?.user_type === "superAdmin" || currentUser?.user_type === "admin" || currentUser?.user_type === "manager") && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenDialog(company)}
                            >
                              <Pencil className="w-4 h-4 text-slate-600" />
                            </Button>
                            {(currentUser?.user_type === "superAdmin" || currentUser?.user_type === "admin") && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setDeleteId(company.id)}
                              >
                                <Trash2 className="w-4 h-4 text-red-600" />
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingCompany ? "Upravit podnik" : "Nový podnik"}
              </DialogTitle>
              <DialogDescription>
                {editingCompany
                  ? "Upravte informace o podniku"
                  : "Vytvořte nový podnik"}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto px-1">
              <div>
                <Label htmlFor="name">Název podniku *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="např. Továrna Praha"
                />
              </div>
              <div>
                <Label htmlFor="address">Adresa</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) =>
                    setFormData({ ...formData, address: e.target.value })
                  }
                  placeholder="Ulice, město"
                />
              </div>
              <div>
                <Label htmlFor="contact_person">Kontaktní osoba</Label>
                <Input
                  id="contact_person"
                  value={formData.contact_person}
                  onChange={(e) =>
                    setFormData({ ...formData, contact_person: e.target.value })
                  }
                  placeholder="Jméno odpovědné osoby"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    placeholder="email@firma.cz"
                  />
                </div>
                <div>
                  <Label htmlFor="phone">Telefon</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) =>
                      setFormData({ ...formData, phone: e.target.value })
                    }
                    placeholder="+420 123 456 789"
                  />
                </div>
              </div>

              <div className="border p-4 rounded-lg bg-slate-50 space-y-4">
                <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                    <CheckSquare className="w-4 h-4" />
                    Aktivní moduly
                </h3>
                <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center space-x-2">
                        <Checkbox 
                            id="enable_demip" 
                            checked={!!formData.enable_demip}
                            onCheckedChange={(checked) => setFormData({...formData, enable_demip: checked})}
                        />
                        <Label htmlFor="enable_demip" className="cursor-pointer">DEMIP (Kontrolní body)</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                        <Checkbox 
                            id="enable_maintenance" 
                            checked={!!formData.enable_maintenance}
                            onCheckedChange={(checked) => setFormData({...formData, enable_maintenance: checked})}
                        />
                        <Label htmlFor="enable_maintenance" className="cursor-pointer">Údržba</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                        <Checkbox 
                            id="enable_parts" 
                            checked={!!formData.enable_parts}
                            onCheckedChange={(checked) => setFormData({...formData, enable_parts: checked})}
                        />
                        <Label htmlFor="enable_parts" className="cursor-pointer">Náhradní díly</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                        <Checkbox 
                            id="enable_vibration" 
                            checked={!!formData.enable_vibration}
                            onCheckedChange={(checked) => setFormData({...formData, enable_vibration: checked})}
                        />
                        <Label htmlFor="enable_vibration" className="cursor-pointer">Vibrodiagnostika</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                        <Checkbox 
                            id="enable_thermo" 
                            checked={!!formData.enable_thermo}
                            onCheckedChange={(checked) => setFormData({...formData, enable_thermo: checked})}
                        />
                        <Label htmlFor="enable_thermo" className="cursor-pointer">Termodiagnostika</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                        <Checkbox 
                            id="enable_tribo" 
                            checked={!!formData.enable_tribo}
                            onCheckedChange={(checked) => setFormData({...formData, enable_tribo: checked})}
                        />
                        <Label htmlFor="enable_tribo" className="cursor-pointer">Tribodiagnostika</Label>
                    </div>
                </div>
              </div>

              <div className="border p-4 rounded-lg bg-slate-50 space-y-4">
                <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                    <CheckSquare className="w-4 h-4" />
                    Nastavení potvrzování
                </h3>
                <div className="flex items-center space-x-2">
                    <Checkbox 
                        id="allow_manual_confirmation" 
                        checked={!!formData.allow_manual_confirmation}
                        onCheckedChange={(checked) => setFormData({...formData, allow_manual_confirmation: checked})}
                    />
                    <div className="grid gap-1.5 leading-none">
                        <Label htmlFor="allow_manual_confirmation" className="cursor-pointer">
                            Povolit manuální potvrzení kontroly
                        </Label>
                        <p className="text-sm text-slate-500">
                            Pokud je vypnuto, kontrolu lze potvrdit pouze naskenováním NFC štítku.
                        </p>
                    </div>
                </div>

                <div className="flex items-center space-x-2 pt-2 border-t border-slate-200 mt-2">
                    <Checkbox 
                        id="force_technician_demip_mobile" 
                        checked={!!formData.force_technician_demip_mobile}
                        onCheckedChange={(checked) => setFormData({...formData, force_technician_demip_mobile: checked})}
                    />
                    <div className="grid gap-1.5 leading-none">
                        <Label htmlFor="force_technician_demip_mobile" className="cursor-pointer">
                            Vynutit DEMIP režim pro techniky na mobilu
                        </Label>
                        <p className="text-sm text-slate-500">
                            Technici na mobilních zařízeních uvidí pouze DEMIP a nebudou moci přepnout na Údržbu.
                        </p>
                    </div>
                </div>
              </div>

              <div className="border p-4 rounded-lg bg-slate-50 space-y-4">
                <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                    <CheckSquare className="w-4 h-4" />
                    Vizualizace intervalů
                </h3>
                <div className="space-y-4">
                    <div>
                        <Label htmlFor="viz_type">Způsob zobrazení překročení</Label>
                        <select 
                            id="viz_type"
                            className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            value={formData.overdue_visualization_type}
                            onChange={(e) => setFormData({...formData, overdue_visualization_type: e.target.value})}
                        >
                            <option value="two_colors">Dvě barvy (Zelená / Žlutá)</option>
                            <option value="traffic_light">Semafor (Zelená / Žlutá / Červená)</option>
                        </select>
                        <p className="text-xs text-slate-500 mt-1">
                            {formData.overdue_visualization_type === "two_colors" 
                                ? "Po překročení intervalu se zobrazí žlutá." 
                                : "V toleranci se zobrazí žlutá, po překročení tolerance červená."}
                        </p>
                    </div>
                    
                    {formData.overdue_visualization_type === "traffic_light" && (
                        <div>
                            <Label htmlFor="tolerance">Tolerance (%) pro žlutou barvu</Label>
                            <Input
                                id="tolerance"
                                type="number"
                                min="0"
                                value={formData.overdue_tolerance_percent}
                                onChange={(e) => setFormData({...formData, overdue_tolerance_percent: parseInt(e.target.value) || 0})}
                            />
                            <p className="text-xs text-slate-500 mt-1">
                                Např. 4% znamená, že do 104% intervalu bude barva žlutá, poté červená.
                            </p>
                        </div>
                    )}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDialog(false)}>
                Zrušit
              </Button>
              <Button
                onClick={handleSave}
                disabled={!formData.name.trim()}
                className="bg-gradient-to-r from-red-600 to-red-700"
              >
                {editingCompany ? "Uložit změny" : "Vytvořit podnik"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Opravdu smazat podnik?</AlertDialogTitle>
              <AlertDialogDescription>
                Tato akce je nevratná. Budou smazány také všechny linky, stroje a
                kontrolní body patřící k tomuto podniku.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Zrušit</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteMutation.mutate(deleteId)}
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