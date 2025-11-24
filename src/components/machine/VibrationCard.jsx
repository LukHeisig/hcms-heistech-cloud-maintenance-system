import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    TrendingUp,
    Trash2,
    Download,
    Loader2,
    Check,
    X
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
    const queryClient = useQueryClient();
    const [selectedJobId, setSelectedJobId] = useState(null);
    const [selectedYear, setSelectedYear] = useState(null);
    const [trendDialogState, setTrendDialogState] = useState({ open: false, pointLabel: null });
    const [jobToDelete, setJobToDelete] = useState(null);
    const [generatingPdf, setGeneratingPdf] = useState(false);
    const [toast, setToast] = useState(null); // { type: 'info' | 'success' | 'error', message: '' }

    // Auto-dismiss toast
    useEffect(() => {
        if (toast) {
            const timer = setTimeout(() => setToast(null), 3000);
            return () => clearTimeout(timer);
        }
    }, [toast]);

    const { data: user } = useQuery({
        queryKey: ["currentUser"],
        queryFn: () => base44.auth.me(),
    });

    const deleteJobMutation = useMutation({
        mutationFn: (id) => base44.entities.VibrationJob.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["vibrationJobs"] });
            queryClient.invalidateQueries({ queryKey: ["vibrationReadings"] });
            setJobToDelete(null);
            setSelectedJobId(null);
        }
    });

    const loadScript = (src) => {
        return new Promise((resolve, reject) => {
            if (document.querySelector(`script[src="${src}"]`)) {
                resolve();
                return;
            }
            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    };

    const handleDownloadPdf = async (jobId) => {
        if (!jobId) return;
        const job = jobs.find(j => j.id === jobId);
        if (!job) return;

        setGeneratingPdf(true);
        setToast({ type: 'info', message: 'Generuji protokol...' });

        try {
            // 1. Load libraries
            await Promise.all([
                loadScript("https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"),
                loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js")
            ]);

            // 2. Create temp container
            const container = document.createElement('div');
            container.style.position = 'absolute';
            container.style.left = '-9999px';
            container.style.top = '0';
            container.style.width = '210mm'; // A4 width
            container.style.minHeight = '297mm'; // A4 height
            container.style.backgroundColor = 'white';
            container.style.padding = '20mm';
            container.style.fontFamily = 'Arial, sans-serif';
            container.style.color = '#1e293b';
            
            // Prepare data
            const jobReadings = readings.filter(r => r.job_id === jobId);
            // Sort readings
            jobReadings.sort((a, b) => {
                if (a.point_label === b.point_label) return a.direction.localeCompare(b.direction);
                return a.point_label.localeCompare(b.point_label);
            });

            // Calculate Status for Conclusion Color
            let overallStatus = 'A';
            for (const r of jobReadings) {
                if (r.band === 'D' || r.bearing_status === 'D') overallStatus = 'D';
                else if ((r.band === 'C' || r.bearing_status === 'C') && overallStatus !== 'D') overallStatus = 'C';
                else if ((r.band === 'B' || r.bearing_status === 'B') && overallStatus !== 'D' && overallStatus !== 'C') overallStatus = 'B';
            }

            const conclusionStyles = {
                D: { bg: '#fef2f2', border: '#ef4444', title: '#b91c1c' }, // Red
                C: { bg: '#fefce8', border: '#eab308', title: '#854d0e' }, // Yellow
                B: { bg: '#f0fdf4', border: '#22c55e', title: '#15803d' }, // Green
                A: { bg: '#f0fdf4', border: '#22c55e', title: '#15803d' }, // Green
            }[overallStatus] || { bg: '#f8fafc', border: '#cbd5e1', title: '#334155' };


            // Build HTML content
            container.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5mm; border-bottom: 2px solid #e2e8f0; padding-bottom: 3mm;">
                    <div>
                        <h1 style="color: #2563eb; font-size: 20px; margin: 0; font-weight: bold;">Protokol o měření vibrací</h1>
                        <p style="color: #64748b; font-size: 10px; margin: 2px 0 0 0;">HCMS - Heistech Cloud Maintenance System</p>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-size: 10px; color: #64748b;">${new Date().toLocaleDateString('cs-CZ')}</div>
                    </div>
                </div>

                <div style="display: flex; gap: 8mm; margin-bottom: 5mm;">
                    <div style="flex: 1;">
                        <h2 style="font-size: 18px; margin: 0 0 3mm 0; color: #0f172a; border-bottom: 1px solid #e2e8f0; padding-bottom: 2px;">${machine.name}</h2>
                        <div style="display: grid; grid-template-columns: 1fr 1.5fr; gap: 6px; font-size: 12px;">
                            <div style="color: #64748b;">Zakázka:</div>
                            <div style="font-weight: bold;">${job.order_number}</div>
                            
                            <div style="color: #64748b;">Datum:</div>
                            <div style="font-weight: bold;">${new Date(job.date).toLocaleDateString('cs-CZ')}</div>
                            
                            <div style="color: #64748b;">Technik:</div>
                            <div style="font-weight: bold;">${job.technician || '-'}</div>
                            
                            <div style="color: #64748b;">Umístění:</div>
                            <div style="font-weight: bold;">${machine.location || '-'}</div>
                            
                            ${standard ? `
                            <div style="color: #64748b;">Norma:</div>
                            <div style="font-weight: bold;">${standard.name}</div>
                            <div style="color: #64748b;">Limity:</div>
                            <div style="font-size: 10px;">${standard.limit_ab}/${standard.limit_bc}/${standard.limit_cd} mm/s</div>
                            ` : ''}
                        </div>
                        ${job.description ? `
                        <div style="margin-top: 3mm; font-size: 11px; background: #f8fafc; padding: 2mm; border-radius: 4px;">
                            <div style="color: #64748b; font-size: 10px; margin-bottom: 1px;">Vstupní podmínky:</div>
                            <div>${job.description}</div>
                        </div>` : ''}
                    </div>

                    ${machine.photo_url ? `
                    <div style="width: 80mm; display: flex; align-items: flex-start; justify-content: center;">
                        <img src="${machine.photo_url}" style="max-height: 60mm; max-width: 100%; object-fit: contain; border: 1px solid #e2e8f0; border-radius: 6px;" crossorigin="anonymous" />
                    </div>` : ''}
                </div>

                <div style="margin-bottom: 5mm;">
                    <h3 style="font-size: 14px; font-weight: bold; background: #f1f5f9; padding: 2mm 4mm; margin: 0 0 2mm 0; color: #334155;">Naměřené hodnoty</h3>
                    <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
                        <thead>
                            <tr style="color: #64748b; border-bottom: 1px solid #cbd5e1;">
                                <th style="text-align: left; padding: 4px;">Místo</th>
                                <th style="text-align: center; padding: 4px;">Směr</th>
                                <th style="text-align: right; padding: 4px;">RMS [mm/s]</th>
                                <th style="text-align: center; padding: 4px;">Pásmo</th>
                                <th style="text-align: center; padding: 4px;">Ložisko</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${jobReadings.map((r, i) => {
                                const bandColor = r.band === 'D' ? '#fee2e2' : r.band === 'C' ? '#fef9c3' : r.band === 'B' || r.band === 'A' ? '#dcfce7' : 'white';
                                const bandTextColor = r.band === 'D' ? '#991b1b' : r.band === 'C' ? '#854d0e' : r.band === 'B' || r.band === 'A' ? '#166534' : '#475569';
                                return `
                                <tr style="border-bottom: 1px solid #f1f5f9;">
                                    <td style="padding: 3px 4px; font-weight: bold;">${r.point_label}</td>
                                    <td style="padding: 3px 4px; text-align: center;">${r.direction}</td>
                                    <td style="padding: 3px 4px; text-align: right; font-family: monospace;">${r.value_rms?.toFixed(2) || '-'}</td>
                                    <td style="padding: 3px 4px; text-align: center;">
                                        <span style="background: ${bandColor}; color: ${bandTextColor}; padding: 1px 6px; border-radius: 3px; font-weight: bold; font-size: 10px;">${r.band || '-'}</span>
                                    </td>
                                    <td style="padding: 3px 4px; text-align: center;">${r.bearing_status || '-'}</td>
                                </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>

                <div style="display: flex; flex-direction: column; gap: 4mm;">
                    <div>
                        <h3 style="font-size: 14px; color: #000000; margin: 0 0 1mm 0; font-weight: bold;">1. Závěr</h3>
                        <div style="font-size: 11px; line-height: 1.4; white-space: pre-line; background: ${conclusionStyles.bg}; padding: 3mm; border-radius: 4px; border-left: 4px solid ${conclusionStyles.border}; min-height: 10mm;">
                            ${job.conclusion || "Bez závěru"}
                        </div>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4mm;">
                        <div>
                            <h3 style="font-size: 14px; color: #000000; margin: 0 0 1mm 0; font-weight: bold;">2. Nález</h3>
                            <div style="font-size: 11px; line-height: 1.4; white-space: pre-line; border: 1px solid #e2e8f0; padding: 3mm; border-radius: 4px; border-left: 4px solid #000000;">
                                ${job.findings || "Bez nálezu"}
                            </div>
                        </div>
                        
                        <div>
                            <h3 style="font-size: 14px; color: #000000; margin: 0 0 1mm 0; font-weight: bold;">3. Doporučení</h3>
                            <div style="font-size: 11px; line-height: 1.4; white-space: pre-line; border: 1px solid #e2e8f0; padding: 3mm; border-radius: 4px; border-left: 4px solid #000000;">
                                ${job.recommendation || "Bez doporučení"}
                            </div>
                        </div>
                    </div>
                </div>
            `;

            document.body.appendChild(container);

            // Wait for images to load
            const images = container.querySelectorAll('img');
            await Promise.all(Array.from(images).map(img => {
                if (img.complete) return Promise.resolve();
                return new Promise(resolve => { img.onload = resolve; img.onerror = resolve; });
            }));

            // Generate
            const canvas = await window.html2canvas(container, {
                scale: 1.5, // Reduced from 2 to 1.5 for smaller file size while maintaining readability
                useCORS: true,
                logging: false,
                backgroundColor: '#ffffff'
            });

            // Cleanup
            document.body.removeChild(container);

            // Create PDF
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF('p', 'mm', 'a4');
            // Use JPEG with 0.6 quality instead of PNG to significantly reduce file size
            const imgData = canvas.toDataURL('image/jpeg', 0.6);
            const imgProps = doc.getImageProperties(imgData);
            const pdfWidth = doc.internal.pageSize.getWidth();
            const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
            
            doc.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
            doc.save(`Protokol_${job.order_number}_${new Date().toISOString().slice(0,10)}.pdf`);

            setToast({ type: 'success', message: 'Protokol byl úspěšně stažen.' });

        } catch (error) {
            console.error("Client PDF Generation Error:", error);
            setToast({ type: 'error', message: 'Chyba při generování protokolu.' });
        } finally {
            setGeneratingPdf(false);
        }
    };

    useEffect(() => {
        if (jobs.length > 0) {
            if (!selectedJobId) {
                setSelectedJobId(jobs[0].id);
            }
            
            // Initialize selected year based on current job
            const currentJob = selectedJobId ? jobs.find(j => j.id === selectedJobId) : jobs[0];
            if (currentJob && !selectedYear) {
                setSelectedYear(new Date(currentJob.date).getFullYear());
            }
        }
    }, [jobs, selectedJobId, selectedYear]);

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
            {/* Tabs for Jobs - Filtered by Year */}
            {jobs.length > 0 ? (
                <div className="space-y-4">
                    {/* Year Selection */}
                    <div className="flex gap-2 overflow-x-auto pb-1">
                        {jobsByYear.map(([year]) => (
                            <button
                                key={year}
                                onClick={() => setSelectedYear(Number(year))}
                                className={`
                                    px-4 py-2 rounded-full text-sm font-bold transition-all whitespace-nowrap shadow-sm
                                    ${selectedYear === Number(year)
                                        ? "bg-slate-900 text-white"
                                        : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
                                    }
                                `}
                            >
                                {year}
                            </button>
                        ))}
                    </div>

                    {/* Jobs List for Selected Year */}
                    <div className="flex overflow-x-auto pb-2 gap-2 no-scrollbar min-h-[80px]">
                        {jobsByYear.find(([y]) => Number(y) === selectedYear)?.[1].map(job => (
                            <button
                                key={job.id}
                                onClick={() => setSelectedJobId(job.id)}
                                className={`
                                    flex flex-col items-start p-3 rounded-lg border min-w-[140px] transition-all
                                    ${selectedJobId === job.id 
                                        ? "bg-blue-50 border-blue-500 ring-1 ring-blue-500 shadow-sm" 
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
                                    <div className="flex items-center gap-2">
                                    {selectedJob && (
                                    <Button
                                    variant="outline"
                                    size="sm"
                                    className="gap-2"
                                    onClick={() => handleDownloadPdf(selectedJob.id)}
                                    disabled={generatingPdf}
                                    >
                                    {generatingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                                    <span className="hidden sm:inline">Protokol</span>
                                    </Button>
                                    )}
                                    {selectedJob && user?.user_type === "superAdmin" && (
                                    <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                    onClick={() => setJobToDelete(selectedJob)}
                                    title="Smazat měření"
                                    >
                                    <Trash2 className="w-5 h-5" />
                                    </Button>
                                    )}
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

            {/* Custom Toast */}
            {toast && (
                <div className={`fixed bottom-4 right-4 px-4 py-3 rounded-lg shadow-lg border flex items-center gap-3 animate-in slide-in-from-bottom-5 z-50 ${
                    toast.type === 'success' ? 'bg-green-50 text-green-800 border-green-200' :
                    toast.type === 'error' ? 'bg-red-50 text-red-800 border-red-200' :
                    'bg-blue-50 text-blue-800 border-blue-200'
                }`}>
                    {toast.type === 'success' && <Check className="w-5 h-5 text-green-600" />}
                    {toast.type === 'error' && <X className="w-5 h-5 text-red-600" />}
                    {toast.type === 'info' && <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />}
                    <span className="font-medium text-sm">{toast.message}</span>
                </div>
            )}

            <VibrationTrendDialog 
                open={trendDialogState.open} 
                onOpenChange={(open) => setTrendDialogState(prev => ({ ...prev, open }))}
                jobs={jobs}
                pointLabel={trendDialogState.pointLabel}
                machineName={machine.name}
            />

            <AlertDialog open={!!jobToDelete} onOpenChange={() => setJobToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Opravdu smazat měření?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Chystáte se smazat měření č. {jobToDelete?.order_number} ze dne {jobToDelete && format(new Date(jobToDelete.date), "d. M. yyyy", { locale: cs })}.
                            Tato akce je nevratná a smaže všechny naměřené hodnoty k tomuto měření.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Zrušit</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => deleteJobMutation.mutate(jobToDelete.id)}
                            className="bg-red-600 hover:bg-red-700"
                        >
                            Smazat
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}