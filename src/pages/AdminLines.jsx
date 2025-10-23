import React from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function AdminLines() {
  const navigate = useNavigate();

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <Button
          variant="ghost"
          onClick={() => navigate(createPageUrl("Admin"))}
          className="mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Zpět na administraci
        </Button>

        <h1 className="text-3xl font-bold text-slate-900 mb-8">
          Správa struktur
        </h1>

        <p className="text-slate-600">
          Funkce správy linek, strojů a kontrolních bodů bude brzy k dispozici.
        </p>
      </div>
    </div>
  );
}