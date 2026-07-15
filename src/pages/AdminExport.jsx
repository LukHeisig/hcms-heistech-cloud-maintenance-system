import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, Download, ArrowLeft, Database, FileSpreadsheet } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function AdminExport() {
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleExport = async () => {
        setLoading(true);
        try {
            const response = await base44.functions.invoke('exportDatabase');
            
            if (!response.data || !response.data.base64) {
                throw new Error("Invalid response from server");
            }

            // Convert Base64 to Blob
            const byteCharacters = atob(response.data.base64);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: 'application/zip' });

            // Download
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `hcms_export_${new Date().toISOString().split('T')[0]}.zip`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            a.remove();
        } catch (err) {
            console.error("Export error:", err);
            alert("Export failed: " + (err.message || "Unknown error"));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 p-8">
            <div className="max-w-3xl mx-auto">
                <Button variant="ghost" onClick={() => navigate(createPageUrl("Admin"))} className="mb-6">
                    <ArrowLeft className="w-4 h-4 mr-2" /> Zpět do administrace
                </Button>
                
                <Card className="border-blue-200 shadow-lg">
                    <CardHeader className="bg-blue-50 border-b border-blue-100 rounded-t-xl">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-100 rounded-lg">
                                <Database className="w-6 h-6 text-blue-600" />
                            </div>
                            <div>
                                <CardTitle className="text-blue-900">Export Databáze</CardTitle>
                                <CardDescription className="text-blue-700">
                                    Kompletní export všech dat z databáze do formátu CSV
                                </CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-6 space-y-6">
                        <div className="bg-white border border-slate-200 rounded-lg p-4">
                            <h3 className="font-semibold text-slate-900 mb-2 flex items-center gap-2">
                                <FileSpreadsheet className="w-4 h-4 text-green-500" />
                                Co export obsahuje?
                            </h3>
                            <p className="text-sm text-slate-600 mb-3">
                                Vygeneruje se ZIP archiv obsahující samostatné .csv soubory pro každou tabulku v databázi:
                            </p>
                            <ul className="grid grid-cols-2 gap-2 text-sm text-slate-600 list-disc list-inside">
                                <li>Společnosti, Linky, Stroje</li>
                                <li>Kontrolní body a záznamy</li>
                                <li>Plánovaná údržba a historie</li>
                                <li>Závady a Servisní zásahy</li>
                                <li>Uživatelé a Audit logy</li>
                                <li>Vibrodiagnostická data</li>
                                <li>Online vibrace (senzory, trendy, alarmy)</li>
                                <li>Nastavení a číselníky</li>
                            </ul>
                        </div>

                        <Button 
                            onClick={handleExport} 
                            disabled={loading} 
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white h-12 text-lg font-semibold"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="animate-spin mr-2" />
                                    Generuji export...
                                </>
                            ) : (
                                <>
                                    <Download className="mr-2" />
                                    Stáhnout data (.zip)
                                </>
                            )}
                        </Button>
                        
                        <p className="text-xs text-center text-slate-400">
                            Poznámka: Export může trvat několik sekund v závislosti na velikosti databáze.
                        </p>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}