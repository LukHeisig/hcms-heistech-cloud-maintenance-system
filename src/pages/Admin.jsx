
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Factory, FileText, Users, Wrench, Building2, Settings } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function Admin() {
  return (
    <div className="p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-slate-900 mb-8">Administrace</h1>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Link to={createPageUrl("AdminCompanies")}>
            <Card className="hover:shadow-lg transition-all cursor-pointer">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-red-600" />
                  Správa podniků
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-slate-600">
                  Spravovat podniky, linky, stroje a kontrolní body
                </p>
              </CardContent>
            </Card>
          </Link>

          <Link to={createPageUrl("Users")}>
            <Card className="hover:shadow-lg transition-all cursor-pointer">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-red-600" />
                  Uživatelé
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-slate-600">
                  Správa uživatelských účtů a oprávnění
                </p>
              </CardContent>
            </Card>
          </Link>

          <Card className="opacity-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-slate-400" />
                Nastavení
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-600">
                Obecná nastavení aplikace
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
