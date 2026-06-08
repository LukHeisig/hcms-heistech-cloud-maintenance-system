import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertTriangle,
  Bell,
  Plus,
  Trash2,
  ChevronLeft,
  User,
  Building2,
  Layers,
  Cpu,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

const SCOPE_LABELS = {
  company: { label: "Celý podnik", icon: Building2, color: "bg-blue-100 text-blue-700" },
  line: { label: "Linka", icon: Layers, color: "bg-green-100 text-green-700" },
  machine: { label: "Stroj", icon: Cpu, color: "bg-orange-100 text-orange-700" },
  all: { label: "Vše", icon: Building2, color: "bg-slate-100 text-slate-600" },
};

export default function AlertRecipients() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showDialog, setShowDialog] = useState(false);
  const [form, setForm] = useState({
    user_id: "",
    company_id: "",
    line_id: "",
    machine_id: "",
    notify_severity_c: false,
    notify_severity_d: true,
  });

  const { data: recipients = [] } = useQuery({
    queryKey: ["vibrationAlertRecipients"],
    queryFn: () => base44.entities.VibrationAlertRecipient.list(null, 500),
  });

  const { data: users = [] } = useQuery({
    queryKey: ["allUsersForAlerts"],
    queryFn: () => base44.entities.User.list(null, 500),
  });

  const { data: companies = [] } = useQuery({
    queryKey: ["allCompanies"],
    queryFn: () => base44.entities.Company.list(null, 500),
  });

  const { data: lines = [] } = useQuery({
    queryKey: ["allLines"],
    queryFn: () => base44.entities.Line.list(null, 1000),
  });

  const { data: machines = [] } = useQuery({
    queryKey: ["allMachines"],
    queryFn: () => base44.entities.Machine.list(null, 1000),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.VibrationAlertRecipient.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vibrationAlertRecipients"] });
      setShowDialog(false);
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.VibrationAlertRecipient.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["vibrationAlertRecipients"] }),
  });

  const resetForm = () => {
    setForm({ user_id: "", company_id: "", line_id: "", machine_id: "", notify_severity_c: false, notify_severity_d: true });
  };

  const filteredLines = form.company_id ? lines.filter(l => l.company_id === form.company_id) : lines;
  const filteredMachines = form.line_id ? machines.filter(m => m.line_id === form.line_id) : (form.company_id ? machines.filter(m => {
    const line = lines.find(l => l.id === m.line_id);
    return line?.company_id === form.company_id;
  }) : machines);

  const handleSave = () => {
    const user = users.find(u => u.id === form.user_id);
    if (!user) return;
    createMutation.mutate({
      user_id: form.user_id,
      user_email: user.email,
      user_name: user.custom_display_name || user.full_name || user.email,
      company_id: form.company_id || null,
      line_id: form.line_id || null,
      machine_id: form.machine_id || null,
      notify_severity_c: form.notify_severity_c,
      notify_severity_d: form.notify_severity_d,
    });
  };

  const getScopeType = (r) => {
    if (r.machine_id) return "machine";
    if (r.line_id) return "line";
    if (r.company_id) return "company";
    return "all";
  };

  const getLabel = (id, list, field = "name") => list.find(i => i.id === id)?.[field] || id;

  return (
    <div className="p-4 md:p-8 bg-slate-50 min-h-screen">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate(createPageUrl("Settings"))}>
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Notifikace alarmů vibrací</h1>
            <p className="text-sm text-slate-500">Správa příjemců e-mailových upozornění při překročení limitů</p>
          </div>
          <Button className="ml-auto gap-2" onClick={() => setShowDialog(true)}>
            <Plus className="w-4 h-4" /> Přidat příjemce
          </Button>
        </div>

        {/* Legend */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <Card className="border-yellow-300 bg-yellow-50">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-yellow-100 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <p className="font-semibold text-yellow-800">Pásmo C — Upozornění</p>
                <p className="text-xs text-yellow-700">Hodnota překročila limit B/C — doporučena zvýšená kontrola</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-red-300 bg-red-50">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="font-semibold text-red-800">Pásmo D — Výstraha</p>
                <p className="text-xs text-red-700">Hodnota překročila limit C/D — nutný okamžitý zásah</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recipients list */}
        {recipients.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Bell className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 font-medium">Žádní příjemci notifikací</p>
              <p className="text-sm text-slate-400 mt-1">Přidejte příjemce pro zasílání e-mailů při alarmu</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {recipients.map((r) => {
              const scopeType = getScopeType(r);
              const scope = SCOPE_LABELS[scopeType];
              const ScopeIcon = scope.icon;
              return (
                <Card key={r.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      {/* User */}
                      <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                        <User className="w-5 h-5 text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-900">{r.user_name || r.user_email}</p>
                        <p className="text-xs text-slate-500 truncate">{r.user_email}</p>
                      </div>

                      {/* Scope */}
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${scope.color}`}>
                          <ScopeIcon className="w-3 h-3" />
                          {scopeType === "all" && "Celý systém"}
                          {scopeType === "company" && getLabel(r.company_id, companies)}
                          {scopeType === "line" && getLabel(r.line_id, lines)}
                          {scopeType === "machine" && getLabel(r.machine_id, machines)}
                        </span>
                      </div>

                      {/* Severities */}
                      <div className="flex gap-2">
                        {r.notify_severity_c && (
                          <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">
                            Pásmo C
                          </Badge>
                        )}
                        {r.notify_severity_d && (
                          <Badge className="bg-red-100 text-red-800 border-red-300">
                            Pásmo D
                          </Badge>
                        )}
                        {!r.notify_severity_c && !r.notify_severity_d && (
                          <Badge variant="outline" className="text-slate-400">Žádné</Badge>
                        )}
                      </div>

                      {/* Delete */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-slate-400 hover:text-red-600 flex-shrink-0"
                        onClick={() => deleteMutation.mutate(r.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Dialog */}
      <Dialog open={showDialog} onOpenChange={(open) => { setShowDialog(open); if (!open) resetForm(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-blue-600" />
              Přidat příjemce notifikací
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* User select */}
            <div className="space-y-2">
              <Label className="font-semibold">Uživatel *</Label>
              <Select value={form.user_id} onValueChange={(v) => setForm(f => ({ ...f, user_id: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Vyberte uživatele..." />
                </SelectTrigger>
                <SelectContent>
                  {users.map(u => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.custom_display_name || u.full_name || u.email} ({u.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Scope */}
            <div className="space-y-3">
              <Label className="font-semibold">Rozsah notifikací</Label>
              <p className="text-xs text-slate-500">Nechte prázdné = notifikace pro celý systém. Upřesněte dle potřeby.</p>

              <div className="space-y-2">
                <Label className="text-sm text-slate-600 flex items-center gap-2"><Building2 className="w-3.5 h-3.5" /> Podnik</Label>
                <Select value={form.company_id || "all"} onValueChange={(v) => setForm(f => ({ ...f, company_id: v === "all" ? "" : v, line_id: "", machine_id: "" }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Všechny podniky" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">— Všechny podniky —</SelectItem>
                    {companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-sm text-slate-600 flex items-center gap-2"><Layers className="w-3.5 h-3.5" /> Linka</Label>
                <Select value={form.line_id || "all"} onValueChange={(v) => setForm(f => ({ ...f, line_id: v === "all" ? "" : v, machine_id: "" }))} disabled={!form.company_id}>
                  <SelectTrigger>
                    <SelectValue placeholder={form.company_id ? "Všechny linky" : "Nejdříve vyberte podnik"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">— Všechny linky —</SelectItem>
                    {filteredLines.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-sm text-slate-600 flex items-center gap-2"><Cpu className="w-3.5 h-3.5" /> Stroj</Label>
                <Select value={form.machine_id || "all"} onValueChange={(v) => setForm(f => ({ ...f, machine_id: v === "all" ? "" : v }))} disabled={!form.line_id}>
                  <SelectTrigger>
                    <SelectValue placeholder={form.line_id ? "Všechny stroje" : "Nejdříve vyberte linku"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">— Všechny stroje —</SelectItem>
                    {filteredMachines.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Severities */}
            <div className="space-y-3">
              <Label className="font-semibold">Zasílat pro pásma</Label>
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 rounded-lg border border-yellow-200 bg-yellow-50">
                  <Checkbox
                    id="sev_c"
                    checked={form.notify_severity_c}
                    onCheckedChange={(v) => setForm(f => ({ ...f, notify_severity_c: !!v }))}
                  />
                  <div>
                    <Label htmlFor="sev_c" className="font-medium text-yellow-800 cursor-pointer">Pásmo C — Upozornění</Label>
                    <p className="text-xs text-yellow-700 mt-0.5">Email při překročení limitu B/C</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg border border-red-200 bg-red-50">
                  <Checkbox
                    id="sev_d"
                    checked={form.notify_severity_d}
                    onCheckedChange={(v) => setForm(f => ({ ...f, notify_severity_d: !!v }))}
                  />
                  <div>
                    <Label htmlFor="sev_d" className="font-medium text-red-800 cursor-pointer">Pásmo D — Výstraha</Label>
                    <p className="text-xs text-red-700 mt-0.5">Email při překročení limitu C/D</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowDialog(false); resetForm(); }}>Zrušit</Button>
            <Button
              onClick={handleSave}
              disabled={!form.user_id || (!form.notify_severity_c && !form.notify_severity_d) || createMutation.isPending}
            >
              Uložit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}