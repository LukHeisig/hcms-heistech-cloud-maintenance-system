import React, { useState, useEffect, useMemo, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, AlertTriangle, CheckCircle2, Info, Copy, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Helper to get band based on value and limits
const getBand = (val, limits) => {
    if (val === "" || val === null || isNaN(val)) return null;
    const v = parseFloat(val);
    if (v <= limits.limit_ab) return "A";
    if (v <= limits.limit_bc) return "B";
    if (v <= limits.limit_cd) return "C";
    return "D";
};

const bandColors = {
    "A": "bg-green-100 text-green-800 border-green-200",
    "B": "bg-yellow-100 text-yellow-800 border-yellow-200",
    "C": "bg-orange-100 text-orange-800 border-orange-200",
    "D": "bg-red-100 text-red-800 border-red-200",
};

const bandLabels = {
    "A": "Nový stroj",
    "B": "Neomezený provoz",
    "C": "Omezený provoz",
    "D": "Nepřípustné"
};

export default function VibrationJobDialog({ machine, open, onOpenChange, job = null }) {
  const queryClient = useQueryClient();
  
  // Fetch Standards and Schemas
  const { data: standard } = useQuery({
    queryKey: ["vibrationStandard", machine?.vibration_standard_id],
    queryFn: async () => {
        if (!machine?.vibration_standard_id) return null;
        const list = await base44.entities.VibrationStandard.list();
        return list.find(s => s.id === machine.vibration_standard_id);
    },
    enabled: !!machine?.vibration_standard_id
  });

  const { data: schema } = useQuery({
    queryKey: ["vibrationSchema", machine?.vibration_schema_id],
    queryFn: async () => {
        if (!machine?.vibration_schema_id) return null;
        const list = await base44.entities.VibrationSchema.list();
        return list.find(s => s.id === machine.vibration_schema_id);
    },
    enabled: !!machine?.vibration_schema_id
  });

  // If editing, fetch readings
  const { data: existingReadings = [] } = useQuery({
    queryKey: ["vibrationReadings", job?.id],
    queryFn: () => job ? base44.entities.VibrationReading.filter({ job_id: job.id }) : [],
    enabled: !!job
  });

  // If creating new, fetch last job and its readings to pre-fill
  const { data: lastJob } = useQuery({
    queryKey: ["lastVibrationJob", machine?.id],
    queryFn: async () => {
        if (!machine?.id) return null;
        const jobs = await base44.entities.VibrationJob.filter({ machine_id: machine.id }, "-date", 1);
        return jobs[0] || null;
    },
    enabled: !!machine?.id && !job && open
  });

  const { data: lastReadings = [] } = useQuery({
    queryKey: ["lastVibrationReadings", lastJob?.id],
    queryFn: () => lastJob ? base44.entities.VibrationReading.filter({ job_id: lastJob.id }) : [],
    enabled: !!lastJob
  });

  const [formData, setFormData] = useState({
    order_number: "",
    date: new Date().toISOString().split('T')[0],
    technician: "",
    description: "",
    findings: "",
    recommendation: "",
    conclusion: ""
  });

  // Stores readings as { "L1_H": { value: 1.2, band: "A", bearing: "A" } }
  const [readings, setReadings] = useState({});
  const [visibleDirections, setVisibleDirections] = useState({ H: true, V: true, A: true });
  const [rowVisibility, setRowVisibility] = useState({});
  const [copyLastTexts, setCopyLastTexts] = useState(false);
  
  const hasPopulatedRef = useRef(false);

  // Fetch templates
  const { data: templates = [] } = useQuery({
    queryKey: ["vibrationTextTemplates"],
    queryFn: () => base44.entities.VibrationTextTemplate.list(),
    enabled: open
  });

  useEffect(() => {
    if (job) {
        setFormData({
            order_number: job.order_number,
            date: job.date.split('T')[0],
            technician: job.technician || "",
            description: job.description || "",
            findings: job.findings || "",
            recommendation: job.recommendation || "",
            conclusion: job.conclusion || ""
        });
    } else {
        // Reset first
        setFormData({
            order_number: "",
            date: new Date().toISOString().split('T')[0],
            technician: "",
            description: "",
            findings: "",
            recommendation: "",
            conclusion: ""
        });
        setReadings({});
        setRowVisibility({}); // Reset visibility
        setCopyLastTexts(false);
        hasPopulatedRef.current = false;
    }

    // IMPORTANT: When closing, reset populated ref so it can re-populate next open
    if (!open) {
        hasPopulatedRef.current = false;
    }
  }, [job, open]);

  // Handle pre-filling from last job
  useEffect(() => {
    if (!job && open && lastJob) {
        setFormData(prev => ({
            ...prev,
            technician: lastJob.technician || "",
            description: lastJob.description || "",
            // Only copy texts if specifically requested
            findings: copyLastTexts ? (lastJob.findings || "") : prev.findings,
            recommendation: copyLastTexts ? (lastJob.recommendation || "") : prev.recommendation,
            conclusion: copyLastTexts ? (lastJob.conclusion || "") : prev.conclusion
        }));
    }
  }, [job, open, lastJob, copyLastTexts]);

  const insertTemplate = (field, content) => {
    setFormData(prev => ({
        ...prev,
        [field]: prev[field] ? `${prev[field]}\n${content}` : content
    }));
  };

  const renderTemplateSelector = (type, field) => {
    const availableTemplates = templates.filter(t => t.type === type);
    if (availableTemplates.length === 0) return null;

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-6 px-2 text-xs gap-1 text-slate-500 hover:text-blue-600">
                    <FileText className="w-3 h-3" />
                    Šablona
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
                {availableTemplates.map(t => (
                    <DropdownMenuItem key={t.id} onClick={() => insertTemplate(field, t.content)}>
                        <div className="flex flex-col gap-1">
                            <span className="font-medium text-xs">{t.title}</span>
                            <span className="text-[10px] text-slate-400 line-clamp-2">{t.content}</span>
                        </div>
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
  };

  // Handle readings population (either from existing job or last job)
  useEffect(() => {
    const sourceReadings = job ? existingReadings : (open ? lastReadings : []);
    
    if (sourceReadings.length > 0 && !hasPopulatedRef.current) {
        const map = {};
        const visibility = {};
        
        sourceReadings.forEach(r => {
            map[`${r.point_label}_${r.direction}`] = {
                value: r.value_rms,
                band: r.band,
                bearing: r.bearing_status
            };
            
            // If we are copying from last job (not editing), we might want to infer visibility
            if (!job) {
                if (!visibility[r.point_label]) visibility[r.point_label] = {};
                visibility[r.point_label][r.direction] = true;
            }
        });
        
        setReadings(map);
        hasPopulatedRef.current = true;
        
        // If copying from last job, set row visibility to match what was recorded
        if (!job && Object.keys(visibility).length > 0) {
             setRowVisibility(visibility);
        }
    }
  }, [existingReadings, lastReadings, job, open]);


  const handleReadingChange = (pointLabel, direction, field, value) => {
    const key = `${pointLabel}_${direction}`;
    const current = readings[key] || {};
    
    let newValue = value;
    let newBand = current.band;

    if (field === 'value') {
        // Keep raw string to allow typing decimals
        newValue = value;
        if (standard) {
            newBand = getBand(newValue, standard);
        }
    }

    setReadings(prev => ({
        ...prev,
        [key]: {
            ...prev[key],
            [field]: newValue,
            ...(field === 'value' ? { band: newBand } : {})
        }
    }));
  };

  const createMutation = useMutation({
    mutationFn: async () => {
        // 1. Create Job
        const jobData = {
            ...formData,
            machine_id: machine.id
        };
        const newJob = await base44.entities.VibrationJob.create(jobData);

        // 2. Create Readings
        const readingsToCreate = [];
        Object.keys(readings).forEach(key => {
            const [point, dir] = key.split('_');
            const r = readings[key];
            if (r.value !== "" && r.value !== undefined) {
                readingsToCreate.push({
                    job_id: newJob.id,
                    point_label: point,
                    direction: dir,
                    value_rms: parseFloat(r.value),
                    band: r.band,
                    bearing_status: r.bearing
                });
            }
        });

        if (readingsToCreate.length > 0) {
            await base44.entities.VibrationReading.bulkCreate(readingsToCreate);
        }
        return newJob;
    },
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["vibrationJobs"] });
        onOpenChange(false);
    }
  });

  // Simplified update (delete all readings + recreate) for prototype speed
  const updateMutation = useMutation({
    mutationFn: async () => {
        // 1. Update Job
        await base44.entities.VibrationJob.update(job.id, formData);

        // 2. Delete old readings
        // Note: In a real app, you might want to diff update, but bulk delete/create is safer for consistency here
        const oldReadings = await base44.entities.VibrationReading.filter({ job_id: job.id });
        for (const r of oldReadings) {
            await base44.entities.VibrationReading.delete(r.id);
        }

        // 3. Create new readings
        const readingsToCreate = [];
        Object.keys(readings).forEach(key => {
            const [point, dir] = key.split('_');
            const r = readings[key];
            if (r.value !== "" && r.value !== undefined) {
                readingsToCreate.push({
                    job_id: job.id,
                    point_label: point,
                    direction: dir,
                    value_rms: parseFloat(r.value),
                    band: r.band,
                    bearing_status: r.bearing
                });
            }
        });

        if (readingsToCreate.length > 0) {
            await base44.entities.VibrationReading.bulkCreate(readingsToCreate);
        }
    },
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["vibrationJobs"] });
        queryClient.invalidateQueries({ queryKey: ["vibrationReadings"] });
        onOpenChange(false);
    }
  });

  const handleSave = () => {
    if (job) {
        updateMutation.mutate();
    } else {
        createMutation.mutate();
    }
  };

  const schemaRows = useMemo(() => {
    if (!schema) return [];
    try {
        return JSON.parse(schema.rows_definition);
    } catch (e) {
        return [];
    }
  }, [schema]);

  if (!machine) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{job ? "Upravit měření" : "Nové měření vibrací"}</DialogTitle>
        </DialogHeader>
        
        {/* Header Info */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 p-4 bg-slate-50 rounded-lg border">
            <div>
                <Label>Číslo zakázky</Label>
                <Input value={formData.order_number} onChange={e => setFormData({...formData, order_number: e.target.value})} placeholder="2025/001" />
            </div>
            <div>
                <Label>Datum měření</Label>
                <Input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
            </div>
            <div>
                <Label>Technik</Label>
                <Input value={formData.technician} onChange={e => setFormData({...formData, technician: e.target.value})} />
            </div>
            <div className="md:col-span-3">
                <Label>Vstupní podmínky / Popis stroje</Label>
                <Input value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} placeholder="např. 1490 rpm, 80% výkon" />
            </div>

            {!job && lastJob && (
              <div className="md:col-span-3 flex items-center gap-2 pt-2 border-t border-slate-200">
                  <Checkbox 
                      id="copyTexts" 
                      checked={copyLastTexts} 
                      onCheckedChange={setCopyLastTexts} 
                  />
                  <Label htmlFor="copyTexts" className="cursor-pointer text-sm text-slate-700 flex items-center gap-2">
                      <Copy className="w-3 h-3" />
                      Kopírovat nálezy, doporučení a závěry z minulého měření ({lastJob.order_number})
                  </Label>
              </div>
            )}
        </div>

        {/* Measurement Table */}
        {!schema || !standard ? (
            <div className="text-center py-8 text-slate-500">
                <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-orange-500" />
                <p>Pro tento stroj není nastavena norma nebo schéma měření.</p>
                <p className="text-sm">Kontaktujte administrátora pro nastavení.</p>
            </div>
        ) : (
            <div className="mb-6 overflow-x-auto">
                <div className="flex flex-wrap items-center justify-between mb-4 gap-4">
                    <h3 className="font-semibold flex items-center gap-2">
                        Naměřené hodnoty
                        <Badge variant="outline" className="font-normal text-xs">Norma: {standard.name}</Badge>
                    </h3>
                    <div className="flex items-center gap-4 text-sm">
                        <span className="text-slate-500 font-medium">Zobrazit směry:</span>
                        <div className="flex gap-4">
                            {['H', 'V', 'A'].map(dir => (
                                <label key={dir} className="flex items-center gap-2 cursor-pointer hover:text-slate-900">
                                    <input 
                                        type="checkbox" 
                                        checked={visibleDirections[dir]} 
                                        onChange={e => setVisibleDirections(prev => ({ ...prev, [dir]: e.target.checked }))}
                                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                    />
                                    <span className={visibleDirections[dir] ? "font-bold text-slate-900" : "text-slate-500"}>{dir}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                </div>
                <Table className="border">
                    <TableHeader>
                        <TableRow className="bg-slate-100">
                            <TableHead className="w-16">Místo</TableHead>
                            <TableHead className="w-16">Směr</TableHead>
                            <TableHead className="w-32">RMS [mm/s]</TableHead>
                            <TableHead className="w-32">Pásmo</TableHead>
                            <TableHead className="w-32">Stav ložisek</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {schemaRows.map(row => {
                            // Get local visibility settings for this row (default to all directions present in schema)
                            const localVisibility = rowVisibility[row.label] || row.directions.reduce((acc, d) => ({...acc, [d]: true}), {});
                            
                            // Filter directions based on BOTH global visibility and local per-row visibility
                            const visibleRowDirections = row.directions.filter(d => 
                                visibleDirections[d] !== false && localVisibility[d] !== false
                            );
                            
                            // Render rows for visible directions
                            if (visibleRowDirections.length > 0) {
                                return visibleRowDirections.map((dir, dirIdx) => {
                                    const key = `${row.label}_${dir}`;
                                    const data = readings[key] || {};
                                    return (
                                        <TableRow key={key} className={dirIdx === 0 ? "border-t-2" : ""}>
                                            {dirIdx === 0 && (
                                                <TableCell rowSpan={visibleRowDirections.length} className="font-bold bg-slate-50 align-top border-r p-2">
                                                    <div>{row.label}</div>
                                                    {row.name && <div className="text-xs text-slate-500 font-normal mb-2">{row.name}</div>}
                                                    
                                                    {/* Per-row direction toggles */}
                                                    <div className="flex flex-wrap gap-1 mt-1">
                                                        {row.directions.map(d => (
                                                            <button
                                                                key={d}
                                                                onClick={() => setRowVisibility(prev => ({
                                                                    ...prev,
                                                                    [row.label]: {
                                                                        ...(prev[row.label] || row.directions.reduce((acc, dir) => ({...acc, [dir]: true}), {})),
                                                                        [d]: !localVisibility[d]
                                                                    }
                                                                }))}
                                                                className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
                                                                    localVisibility[d] !== false 
                                                                        ? "bg-blue-100 text-blue-700 border-blue-300 font-bold" 
                                                                        : "bg-slate-100 text-slate-400 border-slate-200 line-through"
                                                                }`}
                                                                title={`Přepnout směr ${d}`}
                                                            >
                                                                {d}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </TableCell>
                                            )}
                                            <TableCell className="text-center font-medium">{dir}</TableCell>
                                            <TableCell>
                                                <Input 
                                                    type="number" 
                                                    step="0.01" 
                                                    className="h-8" 
                                                    value={data.value || ""} 
                                                    onChange={e => handleReadingChange(row.label, dir, 'value', e.target.value)}
                                                />
                                            </TableCell>
                                            <TableCell>
                                                {data.band && (
                                                    <div className={`px-2 py-1 rounded text-center text-xs font-bold border ${bandColors[data.band]}`}>
                                                        {data.band}
                                                    </div>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <Select 
                                                    value={data.bearing || ""} 
                                                    onValueChange={v => handleReadingChange(row.label, dir, 'bearing', v)}
                                                >
                                                    <SelectTrigger className="h-8">
                                                        <SelectValue placeholder="-" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="A">A - Bezvadný</SelectItem>
                                                        <SelectItem value="B">B - Opotřebení</SelectItem>
                                                        <SelectItem value="C">C - Viditelné</SelectItem>
                                                        <SelectItem value="D">D - Havarijní</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </TableCell>
                                        </TableRow>
                                    );
                                });
                            } else {
                                // Special case: All directions hidden for this row, but we still show the label cell to allow toggling back
                                return (
                                    <TableRow key={`${row.label}_hidden`} className="border-t-2">
                                        <TableCell className="font-bold bg-slate-50 align-top border-r p-2">
                                            <div>{row.label}</div>
                                            {row.name && <div className="text-xs text-slate-500 font-normal mb-2">{row.name}</div>}
                                            
                                            <div className="flex flex-wrap gap-1 mt-1">
                                                {row.directions.map(d => (
                                                    <button
                                                        key={d}
                                                        onClick={() => setRowVisibility(prev => ({
                                                            ...prev,
                                                            [row.label]: {
                                                                ...(prev[row.label] || row.directions.reduce((acc, dir) => ({...acc, [dir]: true}), {})),
                                                                [d]: !localVisibility[d]
                                                            }
                                                        }))}
                                                        className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
                                                            localVisibility[d] !== false 
                                                                ? "bg-blue-100 text-blue-700 border-blue-300 font-bold" 
                                                                : "bg-slate-100 text-slate-400 border-slate-200 line-through"
                                                        }`}
                                                        title={`Přepnout směr ${d}`}
                                                    >
                                                        {d}
                                                    </button>
                                                ))}
                                            </div>
                                        </TableCell>
                                        <TableCell colSpan={4} className="text-center text-slate-400 text-sm italic bg-slate-50/50">
                                            Žádné vybrané směry
                                        </TableCell>
                                    </TableRow>
                                );
                            }
                        })}
                    </TableBody>
                </Table>
            </div>
        )}

        {/* Text Areas */}
        <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <div className="flex justify-between items-center mb-1">
                      <Label>Nález</Label>
                      {renderTemplateSelector('findings', 'findings')}
                    </div>
                    <Textarea value={formData.findings} onChange={e => setFormData({...formData, findings: e.target.value})} rows={4} />
                </div>
                <div>
                    <div className="flex justify-between items-center mb-1">
                      <Label>Závěry</Label>
                      {renderTemplateSelector('conclusion', 'conclusion')}
                    </div>
                    <Textarea value={formData.conclusion} onChange={e => setFormData({...formData, conclusion: e.target.value})} rows={4} />
                </div>
            </div>
            <div>
                <div className="flex justify-between items-center mb-1">
                  <Label>Doporučení</Label>
                  {renderTemplateSelector('recommendation', 'recommendation')}
                </div>
                <Textarea value={formData.recommendation} onChange={e => setFormData({...formData, recommendation: e.target.value})} rows={3} />
            </div>
        </div>

        <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Zrušit</Button>
            <Button onClick={handleSave} disabled={!formData.order_number || !schema}>Uložit měření</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}