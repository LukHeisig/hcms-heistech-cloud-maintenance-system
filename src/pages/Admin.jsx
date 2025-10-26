import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Building2, Palette } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function Admin() {
  return (
    <div className="p-4 md:p-8 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-8">Administrace</h1>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Link to={createPageUrl("AdminCompanies")}>
            <Card className="hover:shadow-lg transition-all cursor-pointer border-slate-200 dark:bg-slate-800 dark:border-slate-700">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
                  <Building2 className="w-5 h-5 text-red-600 dark:text-red-400" />
                  Správa podniků
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Spravovat podniky, linky, stroje a kontrolní body
                </p>
              </CardContent>
            </Card>
          </Link>

          <Link to={createPageUrl("Users")}>
            <Card className="hover:shadow-lg transition-all cursor-pointer border-slate-200 dark:bg-slate-800 dark:border-slate-700">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
                  <Users className="w-5 h-5 text-red-600 dark:text-red-400" />
                  Uživatelé
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Správa uživatelských účtů a oprávnění
                </p>
              </CardContent>
            </Card>
          </Link>

          <Link to={createPageUrl("AppSettings")}>
            <Card className="hover:shadow-lg transition-all cursor-pointer border-slate-200 dark:bg-slate-800 dark:border-slate-700">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
                  <Palette className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  Nastavení vzhledu
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Nastavení světlého/tmavého režimu aplikace
                </p>
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>
    </div>
  );
}