import React from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { ShieldOff, Mail } from "lucide-react";

export default function AccessExpired() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-10 max-w-md w-full text-center">
        <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <ShieldOff className="w-10 h-10 text-red-500" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mb-3">Přístup vypršel</h1>
        <p className="text-slate-600 mb-6">
          Platnost vašeho přístupu do aplikace HCMS vypršela. Pro prodloužení přístupu kontaktujte správce systému.
        </p>
        <div className="flex items-center justify-center gap-2 text-sm text-slate-500 mb-8">
          <Mail className="w-4 h-4" />
          <span>Obraťte se na administrátora</span>
        </div>
        <Button
          variant="outline"
          onClick={() => base44.auth.logout()}
          className="w-full"
        >
          Odhlásit se
        </Button>
      </div>
    </div>
  );
}