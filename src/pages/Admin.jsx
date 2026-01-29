import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Factory, FileText, Users, Wrench, Building2, Settings, Activity, Database, Loader2 } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";

export default function Admin() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const u = await base44.auth.me();
        setUser(u);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    loadUser();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!user) return null;

  const isManager = user.user_type === "manager";

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-slate-900 mb-8">Administrace</h1>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {!isManager && (
            <Link to={createPageUrl("AdminCleanup")}>
            <Card className="hover:shadow-lg transition-all cursor-pointer border-red-200 bg-red-50/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-700">
                  <Wrench className="w-5 h-5" />
                  Čištění dat
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-slate-600">
                  Nástroj pro odstranění osiřelých záznamů (Admin only)
                </p>
              </CardContent>
            </Card>
          </Link>

          <Link to={createPageUrl("AdminExport")}>
            <Card className="hover:shadow-lg transition-all cursor-pointer border-blue-200 bg-blue-50/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-blue-700">
                  <Database className="w-5 h-5" />
                  Export Dat
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-slate-600">
                  Kompletní záloha databáze do CSV
                </p>
              </CardContent>
            </Card>
          </Link>
          )}
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

          {!isManager && (
            <>
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

              <Link to={createPageUrl("AdminVibrations")}>
                <Card className="hover:shadow-lg transition-all cursor-pointer">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Activity className="w-5 h-5 text-purple-600" />
                      Vibrodiagnostika
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-slate-600">
                      Nastavení norem a schémat měření pro vibrační diagnostiku
                    </p>
                  </CardContent>
                </Card>
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}