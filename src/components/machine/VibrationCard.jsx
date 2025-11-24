import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { cs } from "date-fns/locale";
import { 
    Activity, 
    Calendar, 
    User, 
    Info, 
    FileText, 
    AlertTriangle, 
    CheckCircle2,
    Image as ImageIcon,
    AlertCircle,
    ArrowRight,
    TrendingUp
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import VibrationTrendDialog from "./VibrationTrendDialog";

const bandColors = {
    "A": "bg-green-100 text-green-800 border-green-200",
    "B": "bg-green-100 text-green-800 border-green-200",
    "C": "bg-yellow-100 text-yellow-800 border-yellow-200",
    "D": "bg-red-100 text-red-800 border-red-200",
};

export default function VibrationCard({ machine, jobs = [] }) {
    const [selectedJobId, setSelectedJobId] = useState(null);
    const [trendDialogState, setTrendDialogState] = useState({ open: false, pointLabel: null });

    useEffect(() => {
        if (jobs.length > 0 && !selectedJobId) {
            setSelectedJobId(jobs[0].id);
        }
    }, [jobs]);

    const selectedJob = jobs.find(j => j.id === selectedJobId);

    const { data: readings = [] } = useQuery({
        queryKey: ["vibrationReadings", selectedJobId],
        queryFn: () => selectedJobId ? base44.entities.VibrationReading.filter({ job_id: selectedJobId }) : [],
        enabled: !!selectedJobId
    });

    const { data: standard } = useQuery({
        queryKey: ["vibrationStandard", machine?.vibration_standard_id],
        queryFn: async () => {
            if (!machine?.vibration_standard_id) return null;
            const list = await base44.entities.VibrationStandard.list();
            return list.find(s => s.id === machine.vibration_standard_id);
        },
        enabled: !!machine?.vibration_standard_id
    });

    // Group readings by point label and deduplicate
    const readingsByPoint = React.useMemo(() => {
        const groups = {};
        // Sort readings by point label then direction
        const sorted = [...readings].sort((a, b) => {
            if (a.point_label === b.point_label) return a.direction.localeCompare(b.direction);
            return a.point_label.localeCompare(b.point_label);
        });
        
        sorted.forEach(r => {
            if (!groups[r.point_label]) groups[r.point_label] = [];
            
            // Deduplicate: check if a reading with this direction already exists in the group
            const exists = groups[r.point_label].find(ex => ex.direction === r.direction);
            if (!exists) {
                groups[r.point_label].push(r);
            }
        });
        return groups;
    }, [readings]);

    const handleOpenTrend = (pointLabel = null) => {
        setTrendDialogState({ open: true, pointLabel });
    };

    // Group jobs by year
    const jobsByYear = React.useMemo(() => {
        const groups = {};
        jobs.forEach(job => {
            const year = new Date(job.date).getFullYear();
            if (!groups[year]) groups[year] = [];
            groups[year].push(job);
        });
        return Object.entries(groups).sort((a, b) => b[0] - a[0]);
    }, [jobs]);

    // Helper for machine overall status color
    const getMachineStatusColor = () => {
        if (!readings || readings.length === 0) return "bg-slate-200";
        
        let hasD = false;
        let hasC = false;
        
        for (const r of readings) {
            if (r.band === 'D' || r.bearing_status === 'D') hasD = true;
            if (r.band === 'C' || r.bearing_status === 'C') hasC = true;
        }
        
        if (hasD) return "bg-red-500"; // Red if any D
        if (hasC) return "bg-yellow-400"; // Yellow if any C (and no D)
        return "bg-green-500"; // Green otherwise (all A or B)
    };

    return (
        <div className="space-y-6">
            {/* Tabs for Jobs - Grouped by Year */}
            {jobs.length > 0 ? (
                <div className="space-y-4">
                    {jobsByYear.map(([year, yearJobs]) => (
                        <div key={year}>
                            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 ml-1">{year}</h4>
                            <div className="flex overflow-x-auto pb-2 gap-2 no-scrollbar">
                                {yearJobs.map(job => (
                                    <button
                                        key={job.id}
                                        onClick={() => setSelectedJobId(job.id)}
                                        className={`
                                            flex flex-col items-start p-3 rounded-lg border min-w-[140px] transition-all
                                            ${selectedJobId === job.id 
                                                ? "bg-blue-50 border-blue-500 ring-1 ring-blue-500" 
                                                : "bg-white border-slate-200 hover:border-blue-300 hover:bg-slate-50"
                                            }
                                        `}
                                    >
                                        <span className={`text-xs font-bold ${selectedJobId === job.id ? "text-blue-700" : "text-slate-500"}`}>
                                            {format(new Date(job.date), "d. M. yyyy", { locale: cs })}
                                        </span>
                                        <span className={`text-sm font-medium truncate w-full ${selectedJobId === job.id ? "text-blue-900" : "text-slate-700"}`}>
                                            Zakázka {job.order_number}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="p-2 text-slate-500 text-sm italic border rounded bg-slate-50 inline-block">
                    Žádná měření k dispozici
                </div>
            )}

            <Card className="overflow-hidden border-t-4 border-t-blue-600 shadow-lg">
                    <div className="bg-slate-50 border-b p-4 flex flex-wrap justify-between items-center gap-4">
                        <div className="flex items-center gap-4">
                            <div className={`w-12 h-12 rounded-lg border shadow-sm ${getMachineStatusColor()}`}></div>
                            <div>
                                <h2 className="text-xl font-bold text-slate-900">{machine.name}</h2>
                                <div className="flex gap-4 text-sm text-slate-600">
                                    {selectedJob && <span>Číslo zakázky: <strong>{selectedJob.order_number}</strong></span>}
                                    {standard && <span>Norma: <strong>{standard.name}</strong></span>}
                                </div>
                            </div>
                        </div>
                    </div>

                    <CardContent className="p-0">
                        <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x">
                            
                            {/* Left Column: Machine Info & Photo */}
                            <div className="lg:col-span-5 p-6 flex flex-col gap-6">
                                {/* Info Box */}
                                <div className="space-y-2 text-sm">
                                    <div className="grid grid-cols-2 gap-2">
                                        <span className="text-slate-500">Datum měření:</span>
                                        <span className="font-medium">
                                            {selectedJob ? format(new Date(selectedJob.date), "d. M. yyyy", { locale: cs }) : "-"}
                                        </span>
                                        
                                        <span className="text-slate-500">Technik:</span>
                                        <span className="font-medium">{selectedJob?.technician || "-"}</span>
                                        
                                        <span className="text-slate-500">Vstupní podmínky:</span>
                                        <span className="font-medium col-span-2 md:col-span-1">{selectedJob?.description || "-"}</span>
                                    </div>
                                </div>

                                {/* Machine Photo */}
                                <div className="flex-1 min-h-[300px] bg-slate-100 rounded-xl border-2 border-dashed border-slate-300 flex items-center justify-center relative overflow-hidden group">
                                    {machine.photo_url ? (
                                        <img 
                                            src={machine.photo_url} 
                                            alt={machine.name} 
                                            className="w-full h-full object-contain mix-blend-multiply"
                                        />
                                    ) : (
                                        <div className="text-center text-slate-400 p-4">
                                            <ImageIcon className="w-16 h-16 mx-auto mb-2 opacity-50" />
                                            <p>Fotografie stroje není k dispozici</p>
                                            <p className="text-xs mt-1">Lze nahrát v administraci stroje</p>
                                        </div>
                                    )}
                                    
                                    {/* Point labels overlay could be implemented here if we had coordinates */}
                                </div>
                            </div>

                            {/* Right Column: Readings Table */}
                            <div className="lg:col-span-7 p-0">
                                <div className="bg-slate-100 px-4 py-2 border-b font-semibold text-slate-700 flex justify-between items-center">
                                    <span>Naměřené hodnoty</span>
                                    <Badge variant="outline" className="bg-white">RMS [mm/s]</Badge>
                                </div>
                                <div className="overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="bg-slate-50 hover:bg-slate-50">
                                                <TableHead className="w-20 text-center border-r">Místo</TableHead>
                                                <TableHead className="w-16 text-center">Směr</TableHead>
                                                <TableHead className="text-right">Hodnota</TableHead>
                                                <TableHead className="text-center">Pásmo</TableHead>
                                                <TableHead className="text-center">Stav ložisek</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {Object.keys(readingsByPoint).map(pointLabel => {
                                                const pointReadings = readingsByPoint[pointLabel];
                                                return pointReadings.map((r, idx) => (
                                                    <TableRow key={r.id} className="hover:bg-slate-50">
                                                        {idx === 0 && (
                                                            <TableCell 
                                                                rowSpan={pointReadings.length} 
                                                                className="font-bold text-center bg-slate-50/50 border-r align-middle"
                                                            >
                                                                <div className="flex flex-col items-center gap-2">
                                                                    <span className="text-lg">{pointLabel}</span>
                                                                    <Button 
                                                                        variant="ghost" 
                                                                        size="sm" 
                                                                        className="h-6 w-6 p-0 text-blue-600 hover:text-blue-800 hover:bg-blue-100"
                                                                        onClick={() => handleOpenTrend(pointLabel)}
                                                                        title="Zobrazit trend"
                                                                    >
                                                                        <TrendingUp className="w-4 h-4" />
                                                                    </Button>
                                                                </div>
                                                            </TableCell>
                                                        )}
                                                        <TableCell className="text-center font-medium text-slate-600">{r.direction}</TableCell>
                                                        <TableCell className="text-right font-mono font-bold">
                                                            {r.value_rms?.toFixed(2)}
                                                        </TableCell>
                                                        <TableCell className="text-center p-1">
                                                            {r.band && (
                                                                <div className={`inline-block w-8 py-1 rounded text-xs font-bold border ${bandColors[r.band]}`}>
                                                                    {r.band}
                                                                </div>
                                                            )}
                                                        </TableCell>
                                                        <TableCell className="text-center font-bold text-slate-700">
                                                            {r.bearing_status || "-"}
                                                        </TableCell>
                                                    </TableRow>
                                                ));
                                            })}
                                            {readings.length === 0 && (
                                                <TableRow>
                                                    <TableCell colSpan={5} className="text-center py-8 text-slate-500">
                                                        Žádné naměřené hodnoty
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>
                        </div>

                        {/* Bottom Section: Analysis Text */}
                        {selectedJob && (
                            <div className="border-t divide-y">
                                {/* Summary Header */}
                                <div className="bg-slate-50 px-6 py-2 text-center font-bold text-slate-700 uppercase text-sm tracking-wider">
                                    Stručný přehled
                                </div>

                                <div className="p-6 space-y-6">
                                    
                                    {/* Conclusion - Most important */}
                                    <div>
                                        <h3 className="flex items-center gap-2 font-bold text-lg text-slate-900 mb-2 border-b pb-1">
                                            <AlertCircle className="w-5 h-5 text-blue-600" />
                                            Závěry
                                        </h3>
                                        <div className="text-sm text-slate-800 leading-relaxed whitespace-pre-line pl-2">
                                            {selectedJob.conclusion || "Bez závěru"}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        {/* Findings */}
                                        <div>
                                            <h3 className="flex items-center gap-2 font-bold text-slate-900 mb-2 border-b pb-1">
                                                <Info className="w-4 h-4 text-orange-600" />
                                                Nález
                                            </h3>
                                            <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-line pl-2">
                                                {selectedJob.findings || "Bez nálezu"}
                                            </div>
                                        </div>

                                        {/* Recommendations */}
                                        <div>
                                            <h3 className="flex items-center gap-2 font-bold text-slate-900 mb-2 border-b pb-1">
                                                <CheckCircle2 className="w-4 h-4 text-green-600" />
                                                Doporučení
                                            </h3>
                                            <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-line pl-2">
                                                {selectedJob.recommendation || "Bez doporučení"}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            <VibrationTrendDialog 
                open={trendDialogState.open} 
                onOpenChange={(open) => setTrendDialogState(prev => ({ ...prev, open }))}
                jobs={jobs}
                pointLabel={trendDialogState.pointLabel}
                machineName={machine.name}
            />
        </div>
    );
}