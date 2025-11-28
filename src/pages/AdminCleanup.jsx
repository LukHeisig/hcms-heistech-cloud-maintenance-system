import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, Trash2, ArrowLeft, CheckCircle, AlertTriangle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function AdminCleanup() {
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const navigate = useNavigate();

    const handleCleanup = async () => {
        if (!confirm("Are you sure you want to permanently delete these orphaned records? This cannot be undone.")) return;
        
        setLoading(true);
        try {
            const res = await base44.functions.invoke('cleanupOrphans');
            setResult(res.data);
        } catch (err) {
            setResult({ error: err.message });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 p-8">
            <div className="max-w-3xl mx-auto">
                <Button variant="ghost" onClick={() => navigate(createPageUrl("Admin"))} className="mb-6">
                    <ArrowLeft className="w-4 h-4 mr-2" /> Back to Admin
                </Button>
                
                <Card className="border-red-200 shadow-lg">
                    <CardHeader className="bg-red-50 border-b border-red-100 rounded-t-xl">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-red-100 rounded-lg">
                                <Trash2 className="w-6 h-6 text-red-600" />
                            </div>
                            <div>
                                <CardTitle className="text-red-900">Orphaned Data Cleanup</CardTitle>
                                <CardDescription className="text-red-700">
                                    Force delete data associated with the missing company "68fa6d6924a6ba40081a9bfe"
                                </CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-6 space-y-6">
                        <div className="bg-white border border-slate-200 rounded-lg p-4">
                            <h3 className="font-semibold text-slate-900 mb-2 flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4 text-orange-500" />
                                Target Data
                            </h3>
                            <ul className="list-disc list-inside text-sm text-slate-600 space-y-1">
                                <li>Orphaned Lines linked to deleted company</li>
                                <li>Machines belonging to those lines (e.g. "Angulární dopravník")</li>
                                <li>Planned Maintenance (Work Orders)</li>
                                <li>Maintenance Records</li>
                                <li>Issues and other related data</li>
                            </ul>
                        </div>

                        <Button 
                            onClick={handleCleanup} 
                            disabled={loading} 
                            className="w-full bg-red-600 hover:bg-red-700 text-white h-12 text-lg font-semibold"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="animate-spin mr-2" />
                                    Cleaning up...
                                </>
                            ) : (
                                <>
                                    <Trash2 className="mr-2" />
                                    Run Cleanup Tool
                                </>
                            )}
                        </Button>
                        
                        {result && (
                            <div className={`mt-6 p-4 rounded-lg border ${result.error ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
                                <h4 className={`font-bold mb-2 flex items-center gap-2 ${result.error ? 'text-red-800' : 'text-green-800'}`}>
                                    {result.error ? <AlertTriangle className="w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
                                    {result.error ? 'Cleanup Failed' : 'Cleanup Successful'}
                                </h4>
                                {result.log && (
                                    <div className="bg-white/80 p-3 rounded border border-black/5 max-h-60 overflow-auto font-mono text-xs">
                                        {result.log.map((line, i) => (
                                            <div key={i} className="mb-1 border-b border-dashed border-slate-200 pb-1 last:border-0">
                                                {line}
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {result.error && <p className="text-red-600 text-sm font-mono">{result.error}</p>}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}