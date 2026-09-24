import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { ShieldCheck } from "lucide-react";

export default function Revisions() {
  return (
    <div className="p-4 md:p-8 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-slate-900">Revize</h1>
        <p className="text-slate-600 mt-1 mb-8">Přehled revizí zařízení podniku</p>
        <Card>
          <CardContent className="p-12 text-center">
            <ShieldCheck className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Zatím žádné revize</h3>
            <p className="text-slate-500">Modul Revize je pro váš podnik aktivní.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}