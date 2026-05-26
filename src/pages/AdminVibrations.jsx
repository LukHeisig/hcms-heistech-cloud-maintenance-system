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
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Plus, Pencil, Trash2, Activity, FileSpreadsheet, FileText } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function AdminVibrations() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("standards");

  // Standards State
  const [editingStandard, setEditingStandard] = useState(null);
  const [showStandardDialog, setShowStandardDialog] = useState(false);
  const [standardForm, setStandardForm] = useState({
    name: "",
    limit_type: "velocity",
    limit_ab: "",
    limit_bc: "",
    limit_cd: "",
    acc_limit_ab: "",
    acc_limit_bc: "",
    acc_limit_cd: "",
    description: "",
  });

  // Schemas State
  const [editingSchema, setEditingSchema] = useState(null);
  const [showSchemaDialog, setShowSchemaDialog] = useState(false);
  const [schemaForm, setSchemaForm] = useState({
    name: "",
    description: "",
    rows_count: 1,
    rows_config: [{ label: "L1", name: "Ložisko 1", directions: ["H", "V", "A"] }]
  });

  // Templates State
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [templateForm, setTemplateForm] = useState({
    title: "",
    content: "",
    type: "findings"
  });

  // Queries
  const { data: standards = [] } = useQuery({
    queryKey: ["vibrationStandards"],
    queryFn: () => base44.entities.VibrationStandard.list(),
  });

  const { data: schemas = [] } = useQuery({
    queryKey: ["vibrationSchemas"],
    queryFn: () => base44.entities.VibrationSchema.list(),
  });

  const { data: templates = [] } = useQuery({
    queryKey: ["vibrationTextTemplates"],
    queryFn: () => base44.entities.VibrationTextTemplate.list(),
  });

  // Standard Mutations
  const createStandardMutation = useMutation({
    mutationFn: (data) => base44.entities.VibrationStandard.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vibrationStandards"] });
      setShowStandardDialog(false);
    },
  });

  const updateStandardMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.VibrationStandard.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vibrationStandards"] });
      setShowStandardDialog(false);
    },
  });

  const deleteStandardMutation = useMutation({
    mutationFn: (id) => base44.entities.VibrationStandard.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["vibrationStandards"] }),
  });

  // Schema Mutations
  const createSchemaMutation = useMutation({
    mutationFn: (data) => base44.entities.VibrationSchema.create({
        ...data,
        rows_definition: JSON.stringify(data.rows_config)
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vibrationSchemas"] });
      setShowSchemaDialog(false);
    },
  });

  const updateSchemaMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.VibrationSchema.update(id, {
        name: data.name,
        description: data.description,
        rows_definition: JSON.stringify(data.rows_config)
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vibrationSchemas"] });
      setShowSchemaDialog(false);
    },
  });

  const deleteSchemaMutation = useMutation({
    mutationFn: (id) => base44.entities.VibrationSchema.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["vibrationSchemas"] }),
  });

  // Template Mutations
  const createTemplateMutation = useMutation({
    mutationFn: (data) => base44.entities.VibrationTextTemplate.create(data),
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["vibrationTextTemplates"] });
        setShowTemplateDialog(false);
    }
  });

  const updateTemplateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.VibrationTextTemplate.update(id, data),
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["vibrationTextTemplates"] });
        setShowTemplateDialog(false);
    }
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: (id) => base44.entities.VibrationTextTemplate.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["vibrationTextTemplates"] }),
  });

  // Handlers - Standards
  const handleSaveStandard = () => {
    if (!standardForm.name) return;
    const isVelocity = standardForm.limit_type === "velocity";

    const a = parseFloat(isVelocity ? standardForm.limit_ab : standardForm.acc_limit_ab);
    const b = parseFloat(isVelocity ? standardForm.limit_bc : standardForm.acc_limit_bc);
    const c = parseFloat(isVelocity ? standardForm.limit_cd : standardForm.acc_limit_cd);
    if (isNaN(a) || isNaN(b) || isNaN(c)) return;

    const data = {
      name: standardForm.name,
      description: standardForm.description,
      limit_type: standardForm.limit_type,
      limit_ab: isVelocity ? a : null,
      limit_bc: isVelocity ? b : null,
      limit_cd: isVelocity ? c : null,
      acc_limit_ab: !isVelocity ? a : null,
      acc_limit_bc: !isVelocity ? b : null,
      acc_limit_cd: !isVelocity ? c : null,
    };

    if (editingStandard) {
      updateStandardMutation.mutate({ id: editingStandard.id, data });
    } else {
      createStandardMutation.mutate(data);
    }
  };

  const openStandardDialog = (standard = null) => {
    setEditingStandard(standard);
    if (standard) {
      setStandardForm({
        name: standard.name,
        description: standard.description || "",
        limit_type: standard.limit_type || (standard.limit_ab != null ? "velocity" : "acceleration"),
        limit_ab: standard.limit_ab ?? "",
        limit_bc: standard.limit_bc ?? "",
        limit_cd: standard.limit_cd ?? "",
        acc_limit_ab: standard.acc_limit_ab ?? "",
        acc_limit_bc: standard.acc_limit_bc ?? "",
        acc_limit_cd: standard.acc_limit_cd ?? "",
      });
    } else {
      setStandardForm({ name: "", description: "", limit_type: "velocity", limit_ab: "", limit_bc: "", limit_cd: "", acc_limit_ab: "", acc_limit_bc: "", acc_limit_cd: "" });
    }
    setShowStandardDialog(true);
  };

  // Handlers - Schemas
  const handleSaveSchema = () => {
    if (editingSchema) {
      updateSchemaMutation.mutate({ id: editingSchema.id, data: schemaForm });
    } else {
      createSchemaMutation.mutate(schemaForm);
    }
  };

  const openSchemaDialog = (schema = null) => {
    setEditingSchema(schema);
    if (schema) {
      let rows = [];
      try {
        rows = JSON.parse(schema.rows_definition);
      } catch (e) {
        rows = [];
      }
      setSchemaForm({
        name: schema.name,
        description: schema.description || "",
        rows_count: rows.length,
        rows_config: rows
      });
    } else {
      setSchemaForm({
        name: "",
        description: "",
        rows_count: 1,
        rows_config: [{ label: "L1", name: "", directions: ["H", "V", "A"] }]
      });
    }
    setShowSchemaDialog(true);
  };

  const updateRowConfig = (index, field, value) => {
    const newConfig = [...schemaForm.rows_config];
    newConfig[index] = { ...newConfig[index], [field]: value };
    setSchemaForm({ ...schemaForm, rows_config: newConfig });
  };

  const toggleDirection = (index, dir) => {
    const newConfig = [...schemaForm.rows_config];
    const currentDirs = newConfig[index].directions || [];
    if (currentDirs.includes(dir)) {
        newConfig[index].directions = currentDirs.filter(d => d !== dir);
    } else {
        newConfig[index].directions = [...currentDirs, dir];
    }
    setSchemaForm({ ...schemaForm, rows_config: newConfig });
  };

  const handleRowCountChange = (count) => {
    const newCount = parseInt(count) || 0;
    let newConfig = [...schemaForm.rows_config];
    
    if (newCount > newConfig.length) {
        // Add rows
        for (let i = newConfig.length; i < newCount; i++) {
            newConfig.push({ label: `L${i+1}`, name: "", directions: ["H", "V", "A"] });
        }
    } else if (newCount < newConfig.length) {
        // Remove rows
        newConfig = newConfig.slice(0, newCount);
    }
    
    setSchemaForm({ ...schemaForm, rows_count: newCount, rows_config: newConfig });
  };

  // Handlers - Templates
  const handleSaveTemplate = () => {
    if (editingTemplate) {
        updateTemplateMutation.mutate({ id: editingTemplate.id, data: templateForm });
    } else {
        createTemplateMutation.mutate(templateForm);
    }
  };

  const openTemplateDialog = (template = null) => {
    setEditingTemplate(template);
    if (template) {
        setTemplateForm({
            title: template.title,
            content: template.content,
            type: template.type
        });
    } else {
        setTemplateForm({ title: "", content: "", type: "findings" });
    }
    setShowTemplateDialog(true);
  };

  return (
    <div className="p-4 md:p-8 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <Button variant="ghost" onClick={() => navigate(createPageUrl("Admin"))} className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" /> Zpět na administraci
          </Button>
          <h1 className="text-3xl font-bold text-slate-900">Nastavení vibrodiagnostiky</h1>
          <p className="text-slate-600 mt-1">Správa norem a měřících schémat</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList>
            <TabsTrigger value="standards" className="gap-2">
              <Activity className="w-4 h-4" /> Normy a Limity
            </TabsTrigger>
            <TabsTrigger value="schemas" className="gap-2">
              <FileSpreadsheet className="w-4 h-4" /> Schémata měření
            </TabsTrigger>
            <TabsTrigger value="templates" className="gap-2">
              <FileText className="w-4 h-4" /> Šablony textů
            </TabsTrigger>
          </TabsList>

          {/* STANDARDS TAB */}
          <TabsContent value="standards">
            <div className="flex justify-end mb-4">
              <Button onClick={() => openStandardDialog()} className="bg-blue-600 hover:bg-blue-700">
                <Plus className="w-4 h-4 mr-2" /> Nová norma
              </Button>
            </div>
            <div className="grid gap-4">
              {standards.map((std) => (
                <Card key={std.id}>
                  <CardContent className="p-6 flex justify-between items-center">
                    <div>
                      <h3 className="font-bold text-lg">{std.name}</h3>
                      <p className="text-sm text-slate-500 mb-2">{std.description}</p>
                      <div className="flex flex-wrap gap-2 text-sm items-center">
                        <Badge variant="outline" className="text-xs text-slate-500">
                          {std.limit_type === "acceleration" ? "Zrychlení [g]" : "Rychlost [mm/s]"}
                        </Badge>
                        {std.limit_type === "acceleration" ? (<>
                          <Badge className="bg-green-100 text-green-800 hover:bg-green-100">A/B: {std.acc_limit_ab} g</Badge>
                          <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">B/C: {std.acc_limit_bc} g</Badge>
                          <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100">C/D: {std.acc_limit_cd} g</Badge>
                        </>) : (<>
                          <Badge className="bg-green-100 text-green-800 hover:bg-green-100">A/B: {std.limit_ab} mm/s</Badge>
                          <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">B/C: {std.limit_bc} mm/s</Badge>
                          <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100">C/D: {std.limit_cd} mm/s</Badge>
                        </>)}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="icon" onClick={() => openStandardDialog(std)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="text-red-600" onClick={() => deleteStandardMutation.mutate(std.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* SCHEMAS TAB */}
          <TabsContent value="schemas">
            <div className="flex justify-end mb-4">
              <Button onClick={() => openSchemaDialog()} className="bg-blue-600 hover:bg-blue-700">
                <Plus className="w-4 h-4 mr-2" /> Nové schéma
              </Button>
            </div>
            <div className="grid gap-4">
              {schemas.map((sch) => {
                let rowsCount = 0;
                try { rowsCount = JSON.parse(sch.rows_definition).length; } catch(e) {}
                return (
                  <Card key={sch.id}>
                    <CardContent className="p-6 flex justify-between items-center">
                      <div>
                        <h3 className="font-bold text-lg">{sch.name}</h3>
                        <p className="text-sm text-slate-500">{sch.description}</p>
                        <p className="text-xs text-slate-400 mt-1">{rowsCount} měřících bodů</p>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="icon" onClick={() => openSchemaDialog(sch)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="text-red-600" onClick={() => deleteSchemaMutation.mutate(sch.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          {/* TEMPLATES TAB */}
          <TabsContent value="templates">
            <div className="flex justify-end mb-4">
              <Button onClick={() => openTemplateDialog()} className="bg-blue-600 hover:bg-blue-700">
                <Plus className="w-4 h-4 mr-2" /> Nová šablona
              </Button>
            </div>
            <div className="grid gap-4">
              {templates.map((tmpl) => (
                <Card key={tmpl.id}>
                  <CardContent className="p-6 flex justify-between items-center">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-bold text-lg">{tmpl.title}</h3>
                            <Badge variant="outline">
                                {tmpl.type === 'findings' ? 'Nález' : 
                                 tmpl.type === 'recommendation' ? 'Doporučení' : 'Závěr'}
                            </Badge>
                        </div>
                        <p className="text-sm text-slate-500 line-clamp-2">{tmpl.content}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="icon" onClick={() => openTemplateDialog(tmpl)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="text-red-600" onClick={() => deleteTemplateMutation.mutate(tmpl.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>

        {/* STANDARD DIALOG */}
        <Dialog open={showStandardDialog} onOpenChange={setShowStandardDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingStandard ? "Upravit normu" : "Nová norma"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label>Název normy</Label>
                <Input value={standardForm.name} onChange={(e) => setStandardForm({...standardForm, name: e.target.value})} placeholder="např. ČSN 20 816-3" />
              </div>
              <div>
                <Label>Typ limitů</Label>
                <Select value={standardForm.limit_type} onValueChange={(v) => setStandardForm({...standardForm, limit_type: v})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="velocity">Rychlost vibrací [mm/s]</SelectItem>
                    <SelectItem value="acceleration">Zrychlení vibrací [g]</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {standardForm.limit_type === "velocity" && (
                <div>
                  <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Limity rychlosti [mm/s]</Label>
                  <div className="grid grid-cols-3 gap-4 mt-2">
                    <div>
                      <Label className="text-xs">Limit A/B</Label>
                      <Input type="number" step="0.1" placeholder="např. 2.3" value={standardForm.limit_ab} onChange={(e) => setStandardForm({...standardForm, limit_ab: e.target.value})} />
                    </div>
                    <div>
                      <Label className="text-xs">Limit B/C</Label>
                      <Input type="number" step="0.1" placeholder="např. 4.5" value={standardForm.limit_bc} onChange={(e) => setStandardForm({...standardForm, limit_bc: e.target.value})} />
                    </div>
                    <div>
                      <Label className="text-xs">Limit C/D</Label>
                      <Input type="number" step="0.1" placeholder="např. 7.1" value={standardForm.limit_cd} onChange={(e) => setStandardForm({...standardForm, limit_cd: e.target.value})} />
                    </div>
                  </div>
                </div>
              )}

              {standardForm.limit_type === "acceleration" && (
                <div>
                  <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Limity zrychlení [g]</Label>
                  <div className="grid grid-cols-3 gap-4 mt-2">
                    <div>
                      <Label className="text-xs">Limit A/B</Label>
                      <Input type="number" step="0.001" placeholder="např. 0.5" value={standardForm.acc_limit_ab} onChange={(e) => setStandardForm({...standardForm, acc_limit_ab: e.target.value})} />
                    </div>
                    <div>
                      <Label className="text-xs">Limit B/C</Label>
                      <Input type="number" step="0.001" placeholder="např. 1.0" value={standardForm.acc_limit_bc} onChange={(e) => setStandardForm({...standardForm, acc_limit_bc: e.target.value})} />
                    </div>
                    <div>
                      <Label className="text-xs">Limit C/D</Label>
                      <Input type="number" step="0.001" placeholder="např. 2.0" value={standardForm.acc_limit_cd} onChange={(e) => setStandardForm({...standardForm, acc_limit_cd: e.target.value})} />
                    </div>
                  </div>
                </div>
              )}

              <div>
                <Label>Popis</Label>
                <Textarea value={standardForm.description} onChange={(e) => setStandardForm({...standardForm, description: e.target.value})} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowStandardDialog(false)}>Zrušit</Button>
              <Button onClick={handleSaveStandard} disabled={
                !standardForm.name || (
                  standardForm.limit_type === "velocity"
                    ? (standardForm.limit_ab === "" || standardForm.limit_bc === "" || standardForm.limit_cd === "")
                    : (standardForm.acc_limit_ab === "" || standardForm.acc_limit_bc === "" || standardForm.acc_limit_cd === "")
                )
              }>Uložit</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* SCHEMA DIALOG */}
        <Dialog open={showSchemaDialog} onOpenChange={setShowSchemaDialog}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingSchema ? "Upravit schéma" : "Nové schéma"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label>Název schématu</Label>
                <Input value={schemaForm.name} onChange={(e) => setSchemaForm({...schemaForm, name: e.target.value})} placeholder="např. Motor + Převodovka" />
              </div>
              <div>
                <Label>Počet řádků (bodů)</Label>
                <Input type="number" min="1" max="20" value={schemaForm.rows_count} onChange={(e) => handleRowCountChange(e.target.value)} />
              </div>
              
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-20">Místo</TableHead>
                      <TableHead>Název (volitelné)</TableHead>
                      <TableHead>Směry měření</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {schemaForm.rows_config.map((row, idx) => (
                        <TableRow key={idx}>
                            <TableCell>
                                <Input value={row.label} onChange={(e) => updateRowConfig(idx, 'label', e.target.value)} className="h-8" />
                            </TableCell>
                            <TableCell>
                                <Input value={row.name} onChange={(e) => updateRowConfig(idx, 'name', e.target.value)} placeholder="např. Ložisko motoru" className="h-8" />
                            </TableCell>
                            <TableCell>
                                <div className="flex gap-2">
                                    {["H", "V", "A"].map(dir => (
                                        <Button 
                                            key={dir}
                                            size="sm"
                                            variant={row.directions?.includes(dir) ? "default" : "outline"}
                                            onClick={() => toggleDirection(idx, dir)}
                                            className="h-7 w-7 p-0"
                                        >
                                            {dir}
                                        </Button>
                                    ))}
                                </div>
                            </TableCell>
                        </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowSchemaDialog(false)}>Zrušit</Button>
              <Button onClick={handleSaveSchema} disabled={!schemaForm.name}>Uložit</Button>
              </DialogFooter>
              </DialogContent>
              </Dialog>

              {/* TEMPLATE DIALOG */}
              <Dialog open={showTemplateDialog} onOpenChange={setShowTemplateDialog}>
              <DialogContent>
              <DialogHeader>
                  <DialogTitle>{editingTemplate ? "Upravit šablonu" : "Nová šablona"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                  <div>
                      <Label>Název (zkratka)</Label>
                      <Input value={templateForm.title} onChange={(e) => setTemplateForm({...templateForm, title: e.target.value})} placeholder="např. Ložiska OK" />
                  </div>
                  <div>
                      <Label>Typ</Label>
                      <Select value={templateForm.type} onValueChange={(v) => setTemplateForm({...templateForm, type: v})}>
                          <SelectTrigger>
                              <SelectValue placeholder="Vyberte typ šablony" />
                          </SelectTrigger>
                          <SelectContent>
                              <SelectItem value="findings">Nález</SelectItem>
                              <SelectItem value="recommendation">Doporučení</SelectItem>
                              <SelectItem value="conclusion">Závěr</SelectItem>
                          </SelectContent>
                      </Select>
                  </div>
                  <div>
                      <Label>Text šablony</Label>
                      <Textarea value={templateForm.content} onChange={(e) => setTemplateForm({...templateForm, content: e.target.value})} rows={5} />
                  </div>
              </div>
              <DialogFooter>
                  <Button variant="outline" onClick={() => setShowTemplateDialog(false)}>Zrušit</Button>
                  <Button onClick={handleSaveTemplate} disabled={!templateForm.title || !templateForm.content}>Uložit</Button>
              </DialogFooter>
              </DialogContent>
              </Dialog>

              </div>
              </div>
              );
              }