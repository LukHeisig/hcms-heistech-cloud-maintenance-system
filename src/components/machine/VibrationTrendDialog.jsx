import React, { useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { format } from "date-fns";
import { cs } from "date-fns/locale";
import { Loader2 } from "lucide-react";

export default function VibrationTrendDialog({ open, onOpenChange, jobs, pointLabel, machineName }) {
    // Get job IDs to fetch readings for
    const jobIds = useMemo(() => jobs.map(j => j.id), [jobs]);

    const { data: readings = [], isLoading } = useQuery({
        queryKey: ["vibrationReadingsHistory", jobIds.join(',')],
        queryFn: async () => {
            if (jobIds.length === 0) return [];
            
            // Limit to last 20 jobs for performance if needed, but user might want full history.
            // Let's try to fetch all. If performance is bad, we can paginate or limit.
            // We will fetch readings for each job in parallel.
            const promises = jobIds.map(id => base44.entities.VibrationReading.filter({ job_id: id }));
            const results = await Promise.all(promises);
            return results.flat();
        },
        enabled: open && jobIds.length > 0,
        staleTime: 5 * 60 * 1000 // Cache for 5 minutes
    });

    const chartData = useMemo(() => {
        if (!readings.length) return [];
        
        // Map readings to data points
        // Structure: { date: "...", L1_A: 5.2, L1_H: 3.1, ... }
        const dataMap = {};

        // Process jobs in reverse chronological order (oldest first) for the chart
        const sortedJobs = [...jobs].sort((a, b) => new Date(a.date) - new Date(b.date));

        sortedJobs.forEach(job => {
            const jobReadings = readings.filter(r => r.job_id === job.id);
            if (jobReadings.length === 0) return;

            const dateStr = format(new Date(job.date), "d.M.yyyy", { locale: cs });
            // Use order_number to distinguish same-day measurements if any
            const keyStr = `${dateStr}`; 
            
            if (!dataMap[keyStr]) {
                dataMap[keyStr] = { 
                    date: dateStr, 
                    fullDate: new Date(job.date),
                    orderNumber: job.order_number 
                };
            }

            jobReadings.forEach(r => {
                if (pointLabel && r.point_label !== pointLabel) return;
                
                const seriesKey = `${r.point_label} ${r.direction}`;
                dataMap[keyStr][seriesKey] = r.value_rms;
            });
        });

        return Object.values(dataMap);
    }, [readings, jobs, pointLabel]);

    const series = useMemo(() => {
        const keys = new Set();
        chartData.forEach(d => Object.keys(d).forEach(k => {
            if (k !== 'date' && k !== 'fullDate' && k !== 'orderNumber') keys.add(k);
        }));
        // Sort keys to make legend consistent
        return Array.from(keys).sort();
    }, [chartData]);

    const colors = [
        "#2563eb", // blue-600
        "#dc2626", // red-600
        "#16a34a", // green-600
        "#d97706", // amber-600
        "#9333ea", // purple-600
        "#0891b2", // cyan-600
        "#db2777", // pink-600
        "#4f46e5", // violet-600
        "#ca8a04", // yellow-600
        "#059669", // emerald-600
    ];

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-5xl h-[80vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>
                        Trend vibrací - {pointLabel ? `Bod ${pointLabel}` : "Všechny body"} ({machineName})
                    </DialogTitle>
                </DialogHeader>
                
                {isLoading ? (
                    <div className="flex-1 flex items-center justify-center">
                        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
                    </div>
                ) : chartData.length > 0 ? (
                    <div className="flex-1 min-h-0">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 50 }}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis 
                                    dataKey="date" 
                                    angle={-45} 
                                    textAnchor="end" 
                                    height={60} 
                                    interval={0}
                                    tick={{fontSize: 12}}
                                />
                                <YAxis label={{ value: 'RMS [mm/s]', angle: -90, position: 'insideLeft' }} />
                                <Tooltip 
                                    labelFormatter={(label, payload) => {
                                        if (payload && payload.length > 0) {
                                            const data = payload[0].payload;
                                            return `${label} (Zakázka: ${data.orderNumber})`;
                                        }
                                        return label;
                                    }}
                                />
                                <Legend verticalAlign="top" height={36}/>
                                {series.map((key, idx) => (
                                    <Line 
                                        key={key} 
                                        type="monotone" 
                                        dataKey={key} 
                                        stroke={colors[idx % colors.length]} 
                                        strokeWidth={2}
                                        dot={{ r: 4 }}
                                        activeDot={{ r: 6 }}
                                    />
                                ))}
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                ) : (
                    <div className="flex-1 flex items-center justify-center text-slate-500">
                        Žádná data k zobrazení
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}