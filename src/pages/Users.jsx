import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Users as UsersIcon, Pencil, Trash2, Loader2, Shield, User, Crown, Filter, Building2, Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { format } from "date-fns";
import { cs } from "date-fns/locale";

export default function Users() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [currentUser, setCurrentUser] = useState(null);
  const [editingUser, setEditingUser] = useState(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedCompanyFilter, setSelectedCompanyFilter] = useState("all");
  const [deletingUser, setDeletingUser] = useState(null);
  const [formData, setFormData] = useState({
    user_type: "technician",
    phone: "",
    company_id: null,
    custom_display_name: "",
    auto_logout_enabled: false,
    auto_logout_minutes: 30,
    access_until: "",
  });

  useEffect(() => {
    loadCurrentUser();
  }, []);

  const loadCurrentUser = async () => {
    const user = await base44.auth.me();
    setCurrentUser(user);
  };

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const response = await base44.functions.invoke("getUsers");
      return response.data;
    },
  });

  // Customer entity removed as it is not used/defined
  const customers = [];

  const { data: allCompanies = [] } = useQuery({
    queryKey: ["companies"],
    queryFn: () => base44.entities.Company.list(),
  });

  const { data: auditLogs = [] } = useQuery({
    queryKey: ["auditLogs"],
    queryFn: () => base44.entities.AuditLog.list("-created_date", 1000),
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
    return [];
  }, [allCompanies, currentUser]);

  // Filtrovat uživatele podle vybraného podniku
  const filteredUsers = React.useMemo(() => {
    // Manager vidí pouze uživatele ze svého podniku
    if (currentUser?.user_type === "manager" && currentUser?.company_id) {
      return users.filter(u => u.company_id === currentUser.company_id);
    }
    
    // Pro adminy a superAdminy - filtr podle výběru
    if (selectedCompanyFilter === "all") return users;
    if (selectedCompanyFilter === "no_company") {
      return users.filter(u => !u.company_id && (!u.assigned_company_ids || u.assigned_company_ids.length === 0));
    }
    return users.filter(u => {
      // Direct assignment
      if (u.company_id === selectedCompanyFilter) return true;
      
      // Admin assigned companies
      const assigned = u.assigned_company_ids;
      if (Array.isArray(assigned)) {
        // Use loose comparison to handle potential string/number mismatches
        return assigned.some(id => String(id) === String(selectedCompanyFilter));
      }
      
      return false;
    });
  }, [users, selectedCompanyFilter, currentUser]);

  const updateUserMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.User.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setShowEditDialog(false);
      setEditingUser(null);
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId) => {
      const response = await base44.functions.invoke("deleteUser", { userId });
      if (response.data?.error) throw new Error(response.data.error);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setDeletingUser(null);
    },
    onError: (error) => {
      alert("Chyba při mazání uživatele: " + error.message);
      setDeletingUser(null);
    },
  });

  const canDeleteUser = (user) => {
    if (!currentUser) return false;
    if (user.id === currentUser.id) return false;
    if (currentUser.user_type === "superAdmin") return true;
    if (currentUser.user_type === "admin") {
      return (roleLevels[user.user_type] || 0) < (roleLevels[currentUser.user_type] || 0);
    }
    return false;
  };

  const handleOpenEdit = (user) => {
    setEditingUser(user);
    setFormData({
      user_type: user.user_type || "technician",
      phone: user.phone || "",
      company_id: user.company_id || null,
      assigned_company_ids: user.assigned_company_ids || [],
      custom_display_name: user.custom_display_name || user.full_name || "",
      auto_logout_enabled: user.auto_logout_enabled || false,
      auto_logout_minutes: user.auto_logout_minutes || 30,
      access_until: user.access_until ? user.access_until.slice(0, 10) : "",
    });
    setShowEditDialog(true);
  };

  const handleSaveUser = async () => {
    if (editingUser) {
      const dataToSave = {
        ...formData,
        access_until: formData.access_until ? new Date(formData.access_until).toISOString() : null,
      };
      await updateUserMutation.mutateAsync({
        id: editingUser.id,
        data: dataToSave,
      });
    }
  };

  const getUserTypeLabel = (type) => {
    switch (type) {
      case "superAdmin":
        return "Super Administrátor";
      case "admin":
        return "Administrátor";
      case "manager":
        return "Vedoucí";
      case "technician":
        return "Technik";
      default:
        return "Neurčeno";
    }
  };

  const getUserTypeBadge = (type) => {
    switch (type) {
      case "superAdmin":
        return (
          <Badge className="bg-purple-100 text-purple-800 gap-1">
            <Crown className="w-3 h-3" />
            Super Admin
          </Badge>
        );
      case "admin":
        return (
          <Badge className="bg-red-100 text-red-800 gap-1">
            <Crown className="w-3 h-3" />
            Administrátor
          </Badge>
        );
      case "manager":
        return (
          <Badge className="bg-blue-100 text-blue-800 gap-1">
            <Shield className="w-3 h-3" />
            Vedoucí
          </Badge>
        );
      case "technician":
        return (
          <Badge className="bg-slate-100 text-slate-800 gap-1">
            <User className="w-3 h-3" />
            Technik
          </Badge>
        );
      default:
        return <Badge variant="outline">Neurčeno</Badge>;
    }
  };

  // getCustomerName removed

  const getCompanyName = (companyId) => {
    if (!companyId) return "Není přiřazen";
    const company = allCompanies.find((c) => c.id === companyId);
    return company ? company.name : "Neznámý podnik";
  };

  const roleLevels = {
    superAdmin: 4,
    admin: 3,
    manager: 2,
    technician: 1
  };

  // Získat poslední aktivitu pro každého uživatele
  const getUserLastActivity = (userEmail) => {
    const userLogs = auditLogs.filter(log => log.changed_by === userEmail);
    if (userLogs.length === 0) return null;
    return userLogs[0]; // První = nejnovější (seřazeno DESC)
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
            onClick={() => navigate(createPageUrl("Admin"))}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Zpět na administraci
          </Button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Správa uživatelů</h1>
              <p className="text-slate-600 mt-1">
                {filteredUsers.length} {selectedCompanyFilter !== "all" ? "filtrovaných" : ""} uživatelů
                {selectedCompanyFilter !== "all" && ` z ${users.length} celkem`}
              </p>
            </div>
          </div>
        </div>

        {/* Filtrace podle podniku */}
        {(currentUser?.user_type === "superAdmin" || currentUser?.user_type === "admin") && companies.length > 0 && (
          <Card className="mb-6">
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <Filter className="w-5 h-5 text-slate-600" />
                <div className="flex-1">
                  <Label htmlFor="companyFilter" className="text-sm font-medium text-slate-700 mb-2 block">
                    Filtrovat podle podniku
                  </Label>
                  <Select value={selectedCompanyFilter} onValueChange={setSelectedCompanyFilter}>
                    <SelectTrigger id="companyFilter" className="w-full md:w-80">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4" />
                          Všechny podniky ({users.length})
                        </div>
                      </SelectItem>
                      <SelectItem value="no_company">
                        <div className="flex items-center gap-2 text-slate-500">
                          <User className="w-4 h-4" />
                          Bez podniku ({users.filter(u => !u.company_id).length})
                        </div>
                      </SelectItem>
                      {companies.map((company) => (
                        <SelectItem key={company.id} value={company.id}>
                          <div className="flex items-center gap-2">
                            <Building2 className="w-4 h-4" />
                            {company.name} ({users.filter(u => u.company_id === company.id).length})
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Noví uživatelé bez podniku — pouze superAdmin */}
        {currentUser?.user_type === "superAdmin" && (() => {
          const usersWithoutCompany = users.filter(u => !u.company_id && (!u.assigned_company_ids || u.assigned_company_ids.length === 0));
          return (
            <Card className="mb-6 border-l-4 border-l-amber-500 shadow-md">
              <CardHeader className="border-b border-amber-100 bg-amber-50/50 py-3">
                <CardTitle className="flex items-center gap-2 text-amber-800">
                  <User className="w-5 h-5" />
                  Noví uživatelé bez přiděleného podniku
                  <Badge className="bg-amber-200 text-amber-800 ml-2">{usersWithoutCompany.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-amber-50/30">
                        <TableHead>Jméno</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Registrace</TableHead>
                        <TableHead>Poslední aktivita</TableHead>
                        <TableHead className="text-right">Akce</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {usersWithoutCompany.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8">
                            <User className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                            <p className="text-slate-500 text-sm">Všichni uživatelé mají přidělený podnik</p>
                          </TableCell>
                        </TableRow>
                      ) : (
                        usersWithoutCompany.map((user) => {
                        const lastActivity = getUserLastActivity(user.email);
                        return (
                          <TableRow key={user.id} className="hover:bg-amber-50/30">
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 bg-gradient-to-br from-amber-400 to-amber-500 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                                  {(user.custom_display_name || user.full_name)?.[0] || "?"}
                                </div>
                                {user.custom_display_name || user.full_name || "Bez jména"}
                              </div>
                            </TableCell>
                            <TableCell className="text-slate-600">{user.email}</TableCell>
                            <TableCell>{getUserTypeBadge(user.user_type)}</TableCell>
                            <TableCell className="text-slate-600 text-sm">
                              {format(new Date(user.created_date), "d. M. yyyy", { locale: cs })}
                            </TableCell>
                            <TableCell className="text-slate-600 text-xs">
                              {lastActivity ? (
                                format(new Date(lastActivity.created_date), "d. M. yyyy HH:mm", { locale: cs })
                              ) : (
                                <span className="text-slate-400 italic">Žádná aktivita</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="outline"
                                size="sm"
                                className="border-amber-300 text-amber-700 hover:bg-amber-50"
                                onClick={() => handleOpenEdit(user)}
                              >
                                <Pencil className="w-3.5 h-3.5 mr-1" />
                                Přiřadit podnik
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          );
        })()}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                  <Crown className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-600">Super Admini</p>
                  <p className="text-2xl font-bold text-slate-900">
                    {filteredUsers.filter((u) => u.user_type === "superAdmin").length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
                  <Crown className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-600">Administrátoři</p>
                  <p className="text-2xl font-bold text-slate-900">
                    {filteredUsers.filter((u) => u.user_type === "admin").length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                  <Shield className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-600">Vedoucí</p>
                  <p className="text-2xl font-bold text-slate-900">
                    {filteredUsers.filter((u) => u.user_type === "manager").length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center">
                  <User className="w-6 h-6 text-slate-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-600">Technici</p>
                  <p className="text-2xl font-bold text-slate-900">
                    {filteredUsers.filter((u) => u.user_type === "technician").length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Users Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UsersIcon className="w-5 h-5" />
              Seznam uživatelů
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Jméno</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Auto-logout</TableHead>
                    <TableHead>Podnik</TableHead>
                    <TableHead>Telefon</TableHead>
                    <TableHead>Přístup do</TableHead>
                    <TableHead>Registrace</TableHead>
                    <TableHead>Poslední aktivita</TableHead>
                    <TableHead className="text-right">Akce</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user) => {
                    const lastActivity = getUserLastActivity(user.email);
                    return (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-slate-400 to-slate-500 rounded-full flex items-center justify-center text-white font-semibold">
                              {(user.custom_display_name || user.full_name)?.[0] || "?"}
                            </div>
                            {user.custom_display_name || user.full_name || "Bez jména"}
                          </div>
                        </TableCell>
                        <TableCell className="text-slate-600">{user.email}</TableCell>
                        <TableCell>{getUserTypeBadge(user.user_type)}</TableCell>
                        <TableCell>
                          {user.auto_logout_enabled ? (
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 gap-1 font-normal">
                              <Clock className="w-3 h-3" />
                              {user.auto_logout_minutes} min
                            </Badge>
                          ) : (
                            <span className="text-slate-400 text-xs pl-2">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-slate-600">
                          {user.user_type === "superAdmin"
                            ? <span className="text-slate-400 italic">Všechny podniky</span>
                            : user.user_type === "admin"
                            ? (
                                <span className="text-xs" title={user.assigned_company_ids?.map(id => getCompanyName(id)).join(", ")}>
                                  {user.assigned_company_ids?.length > 0 
                                    ? `${user.assigned_company_ids.length} podniků: ` + user.assigned_company_ids.map(id => getCompanyName(id)).slice(0, 2).join(", ") + (user.assigned_company_ids.length > 2 ? "..." : "")
                                    : <span className="text-slate-400 italic">Žádné podniky</span>}
                                </span>
                              )
                            : getCompanyName(user.company_id)
                          }
                        </TableCell>
                        <TableCell className="text-slate-600">
                          {user.phone || "-"}
                        </TableCell>
                        <TableCell>
                          {user.access_until ? (
                            new Date(user.access_until) < new Date() ? (
                              <Badge className="bg-red-100 text-red-700 border-red-200 font-normal text-xs">
                                Vypršel {format(new Date(user.access_until), "d. M. yyyy", { locale: cs })}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 font-normal text-xs">
                                {format(new Date(user.access_until), "d. M. yyyy", { locale: cs })}
                              </Badge>
                            )
                          ) : (
                            <span className="text-slate-400 text-xs pl-2">Neomezeno</span>
                          )}
                        </TableCell>
                        <TableCell className="text-slate-600">
                          {format(new Date(user.created_date), "d. M. yyyy", {
                            locale: cs,
                          })}
                        </TableCell>
                        <TableCell className="text-slate-600">
                          {lastActivity ? (
                            <div className="text-xs">
                              <div className="font-medium">
                                {format(new Date(lastActivity.created_date), "d. M. yyyy HH:mm", { locale: cs })}
                              </div>
                              <div className="text-slate-500 truncate max-w-xs" title={lastActivity.change_description}>
                                {lastActivity.change_description.length > 40 ? lastActivity.change_description.slice(0, 40) + "..." : lastActivity.change_description}
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-400 italic text-xs">Žádná aktivita</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenEdit(user)}
                            disabled={
                              currentUser?.id !== user.id && 
                              (currentUser?.user_type !== 'superAdmin' && (roleLevels[user.user_type] || 0) >= (roleLevels[currentUser?.user_type] || 0))
                            }
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          {canDeleteUser(user) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeletingUser(user)}
                            >
                              <Trash2 className="w-4 h-4 text-red-600" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {filteredUsers.length === 0 && (
              <div className="text-center py-12">
                <UsersIcon className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500">
                  {selectedCompanyFilter !== "all"
                    ? "Žádní uživatelé pro vybraný filtr"
                    : "Zatím nejsou žádní uživatelé"
                  }
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Edit Dialog */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent className="max-h-[90vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>Upravit uživatele</DialogTitle>
              <DialogDescription>
                Upravte roli a kontaktní údaje uživatele {editingUser?.full_name}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4 overflow-y-auto flex-1 -mr-2 pr-2">
              <div>
                <Label>Email</Label>
                <Input value={editingUser?.email || ""} disabled className="bg-slate-50" />
                <p className="text-xs text-slate-500 mt-1">Email nelze měnit</p>
              </div>

              <div>
                <Label htmlFor="custom_display_name">Zobrazované jméno</Label>
                <Input
                  id="custom_display_name"
                  value={formData.custom_display_name}
                  onChange={(e) =>
                    setFormData({ ...formData, custom_display_name: e.target.value })
                  }
                  placeholder="Např. Jan Novák (pro zobrazení v aplikaci)"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Pokud je pole prázdné, použije se výchozí jméno ({editingUser?.full_name || "nenastaveno"}).
                </p>
              </div>

              {currentUser?.user_type === "superAdmin" || (currentUser?.user_type === "admin" && editingUser?.id !== currentUser?.id) ? (
              <div>
                <Label htmlFor="user_type">Role v systému *</Label>
                <Select
                  value={formData.user_type}
                  onValueChange={(value) =>
                    setFormData({ ...formData, user_type: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="technician">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4" />
                        Technik (základní přístup)
                      </div>
                    </SelectItem>
                    <SelectItem value="manager">
                      <div className="flex items-center gap-2">
                        <Shield className="w-4 h-4" />
                        Vedoucí (schvalování závad)
                      </div>
                    </SelectItem>
                    <SelectItem value="admin">
                      <div className="flex items-center gap-2">
                        <Crown className="w-4 h-4" />
                        Administrátor (přístup k přiřazeným podnikům)
                      </div>
                    </SelectItem>
                    {currentUser?.user_type === "superAdmin" && (
                      <SelectItem value="superAdmin">
                        <div className="flex items-center gap-2">
                          <Crown className="w-4 h-4" />
                          Super Administrátor (plný přístup ke všem podnikům)
                        </div>
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
              ) : null}

              {formData.user_type === "admin" && currentUser?.user_type === "superAdmin" && (
                <div>
                  <Label htmlFor="assigned_companies">Přiřazené podniky *</Label>
                  <div className="border rounded-lg p-4 bg-slate-50 space-y-2 max-h-48 overflow-y-auto">
                    {companies.map((company) => (
                      <label key={company.id} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.assigned_company_ids?.includes(company.id) || false}
                          onChange={(e) => {
                            const currentIds = formData.assigned_company_ids || [];
                            if (e.target.checked) {
                              setFormData({
                                ...formData,
                                assigned_company_ids: [...currentIds, company.id],
                              });
                            } else {
                              setFormData({
                                ...formData,
                                assigned_company_ids: currentIds.filter(id => id !== company.id),
                              });
                            }
                          }}
                          className="rounded"
                        />
                        <span className="text-sm text-slate-700">{company.name}</span>
                      </label>
                    ))}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Vyberte podniky, ke kterým bude mít administrátor přístup
                  </p>
                </div>
              )}

              {(formData.user_type === "technician" || formData.user_type === "manager") && (currentUser?.user_type === "superAdmin" || (currentUser?.user_type === "admin" && editingUser?.id !== currentUser?.id)) && (
                <div>
                  <Label htmlFor="company_id">Podnik *</Label>
                  <Select
                    value={formData.company_id || ""}
                    onValueChange={(value) =>
                      setFormData({ ...formData, company_id: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Vyberte podnik" />
                    </SelectTrigger>
                    <SelectContent>
                      {companies.map((company) => (
                        <SelectItem key={company.id} value={company.id}>
                          {company.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-slate-500 mt-1">
                    Uživatel uvidí pouze linky a stroje tohoto podniku
                  </p>
                </div>
              )}

              <div>
                <Label htmlFor="phone">Telefonní číslo</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: e.target.value })
                  }
                  placeholder="+420 123 456 789"
                />
              </div>

              {(currentUser?.user_type === "superAdmin" || currentUser?.user_type === "admin") && editingUser?.id !== currentUser?.id && (
                <div className="pt-2 border-t border-slate-200">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="w-4 h-4 text-slate-500" />
                    <Label>Přístup platný do</Label>
                  </div>
                  <Input
                    type="date"
                    value={formData.access_until}
                    onChange={(e) => setFormData({ ...formData, access_until: e.target.value })}
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Prázdné pole = neomezený přístup. Uživatel bude po vypršení automaticky odhlášen.
                  </p>
                  {formData.access_until && (
                    <button
                      type="button"
                      className="text-xs text-red-500 hover:underline mt-1"
                      onClick={() => setFormData({ ...formData, access_until: "" })}
                    >
                      Odstranit omezení přístupu
                    </button>
                  )}
                </div>
              )}

              {(currentUser?.user_type === "superAdmin" || editingUser?.id === currentUser?.id) && (
                <div className="space-y-4 pt-2 border-t border-slate-200">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-base">Automatické odhlášení</Label>
                      <p className="text-sm text-slate-500">
                        Odhlásit uživatele při nečinnosti
                      </p>
                    </div>
                    <Switch
                      checked={formData.auto_logout_enabled}
                      onCheckedChange={(checked) =>
                        setFormData({ ...formData, auto_logout_enabled: checked })
                      }
                    />
                  </div>

                  {formData.auto_logout_enabled && (
                    <div>
                      <Label htmlFor="auto_logout_minutes">Minuty do odhlášení</Label>
                      <div className="flex items-center gap-2 mt-2">
                        <Clock className="w-4 h-4 text-slate-500" />
                        <Input
                          id="auto_logout_minutes"
                          type="number"
                          min="1"
                          value={formData.auto_logout_minutes}
                          onChange={(e) =>
                            setFormData({ ...formData, auto_logout_minutes: parseInt(e.target.value) || 1 })
                          }
                          className="w-24"
                        />
                        <span className="text-sm text-slate-500">minut</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {currentUser?.user_type === "superAdmin" || (currentUser?.user_type === "admin" && editingUser?.id !== currentUser?.id) ? (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-900">
                  <strong>Poznámka:</strong> {
                    formData.user_type === "superAdmin"
                      ? "Super Administrátor má přístup ke všem podnikům a může spravovat vše."
                      : formData.user_type === "admin"
                      ? "Administrátor má přístup pouze k přiřazeným podnikům."
                      : "Vedoucí a Technici mají přístup pouze k jednomu podniku."
                  }
                </p>
              </div>
              ) : null}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEditDialog(false)}>
                Zrušit
              </Button>
              <Button
                onClick={handleSaveUser}
                className="bg-gradient-to-r from-red-600 to-red-700"
              >
                Uložit změny
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <AlertDialog open={!!deletingUser} onOpenChange={(open) => !open && setDeletingUser(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Opravdu smazat uživatele?</AlertDialogTitle>
              <AlertDialogDescription>
                Uživatel {deletingUser?.custom_display_name || deletingUser?.full_name || deletingUser?.email} ({deletingUser?.email}) ztratí přístup do aplikace. Tato akce je nevratná.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Zrušit</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteUserMutation.mutate(deletingUser.id)}
                disabled={deleteUserMutation.isPending}
                className="bg-red-600 hover:bg-red-700"
              >
                {deleteUserMutation.isPending ? "Mažu..." : "Smazat"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}