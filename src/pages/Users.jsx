
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Users as UsersIcon, Pencil, Loader2, Shield, User, Crown } from "lucide-react";
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
  const [formData, setFormData] = useState({
    user_type: "technician",
    phone: "",
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
    queryFn: () => base44.entities.User.list("-created_date"),
  });

  const { data: customers = [] } = useQuery({
    queryKey: ["customers"],
    queryFn: () => base44.entities.Customer.list(),
  });

  const updateUserMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.User.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setShowEditDialog(false);
      setEditingUser(null);
    },
  });

  const handleOpenEdit = (user) => {
    setEditingUser(user);
    setFormData({
      user_type: user.user_type || "technician",
      phone: user.phone || "",
    });
    setShowEditDialog(true);
  };

  const handleSaveUser = async () => {
    if (editingUser) {
      await updateUserMutation.mutateAsync({
        id: editingUser.id,
        data: formData,
      });
    }
  };

  const getUserTypeLabel = (type) => {
    switch (type) {
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

  const getCustomerName = (customerId) => {
    const customer = customers.find((c) => c.id === customerId);
    return customer?.name || "-";
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
              <p className="text-slate-600 mt-1">{users.length} uživatelů v systému</p>
            </div>
          </div>
        </div>

        {/* Návod pro přidání uživatelů - pouze pro adminy */}
        {currentUser?.user_type === "admin" && (
          <Card className="mb-6 border-blue-200 bg-blue-50">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center flex-shrink-0">
                  <UsersIcon className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-blue-900 mb-2">
                    Jak přidat nového uživatele?
                  </h3>
                  <p className="text-sm text-blue-800 mb-3">
                    Nové uživatele musíte pozvat přes systémový dashboard:
                  </p>
                  <ol className="text-sm text-blue-800 space-y-2 mb-4">
                    <li className="flex items-start gap-2">
                      <span className="font-bold">1.</span>
                      <span>Klikněte na <strong>"Dashboard"</strong> v horní liště aplikace</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="font-bold">2.</span>
                      <span>Vyberte <strong>"Data"</strong> → <strong>"Users"</strong></span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="font-bold">3.</span>
                      <span>Klikněte na tlačítko <strong>"Invite User"</strong></span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="font-bold">4.</span>
                      <span>Zadejte email nového uživatele a odešlete pozvánku</span>
                    </li>
                  </ol>
                  <p className="text-xs text-blue-700">
                    💡 Po první přihlášení můžete uživateli nastavit roli a telefon zde na této stránce.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
                  <Crown className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-600">Administrátoři</p>
                  <p className="text-2xl font-bold text-slate-900">
                    {users.filter((u) => u.user_type === "admin").length}
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
                    {users.filter((u) => u.user_type === "manager").length}
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
                    {users.filter((u) => u.user_type === "technician").length}
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
                    <TableHead>Telefon</TableHead>
                    <TableHead>Zákazník</TableHead>
                    <TableHead>Registrace</TableHead>
                    <TableHead className="text-right">Akce</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-slate-400 to-slate-500 rounded-full flex items-center justify-center text-white font-semibold">
                            {user.full_name?.[0] || "?"}
                          </div>
                          {user.full_name || "Bez jména"}
                        </div>
                      </TableCell>
                      <TableCell className="text-slate-600">{user.email}</TableCell>
                      <TableCell>{getUserTypeBadge(user.user_type)}</TableCell>
                      <TableCell className="text-slate-600">
                        {user.phone || "-"}
                      </TableCell>
                      <TableCell className="text-slate-600">
                        {getCustomerName(user.customer_id)}
                      </TableCell>
                      <TableCell className="text-slate-600">
                        {format(new Date(user.created_date), "d. M. yyyy", {
                          locale: cs,
                        })}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenEdit(user)}
                          disabled={currentUser?.id === user.id}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {users.length === 0 && (
              <div className="text-center py-12">
                <UsersIcon className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500">Zatím nejsou žádní uživatelé</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Edit Dialog */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Upravit uživatele</DialogTitle>
              <DialogDescription>
                Upravte roli a kontaktní údaje uživatele {editingUser?.full_name}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label>Email</Label>
                <Input value={editingUser?.email || ""} disabled className="bg-slate-50" />
                <p className="text-xs text-slate-500 mt-1">Email nelze měnit</p>
              </div>

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
                        Administrátor (plný přístup)
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

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

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-900">
                  <strong>Poznámka:</strong> Přiřazení k zákazníkovi se provádí
                  automaticky při prvním použití aplikace.
                </p>
              </div>
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
      </div>
    </div>
  );
}
