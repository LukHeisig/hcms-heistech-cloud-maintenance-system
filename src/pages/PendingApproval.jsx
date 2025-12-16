import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Clock, Mail, CheckCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function PendingApproval() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
    } catch (error) {
      console.error("Error loading user:", error);
    }
  };

  const handleLogout = async () => {
    await base44.auth.logout();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <Card className="max-w-2xl w-full shadow-2xl">
        <CardContent className="p-12 text-center">
          <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl">
            <Clock className="w-10 h-10 text-white animate-pulse" />
          </div>

          <h1 className="text-3xl font-bold text-slate-900 mb-4">
            Čeká se na schválení
          </h1>

          <p className="text-lg text-slate-600 mb-6">
            Váš účet byl úspěšně vytvořen, ale zatím čeká na schválení administrátorem.
          </p>

          <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-6 mb-6">
            <div className="flex items-start gap-4 text-left">
              <Mail className="w-6 h-6 text-blue-600 flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-semibold text-blue-900 mb-2">Co se stane dál?</h3>
                <ul className="space-y-2 text-sm text-blue-800">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span>Administrátor vás přiřadí k podniku a nastaví vaši roli</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span>Obdržíte emailové upozornění, až bude váš účet aktivován</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span>Po aktivaci získáte přístup k systému HCMS</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {user && (
            <div className="mb-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
              <p className="text-sm text-slate-600">
                <span className="font-semibold text-slate-900">Přihlášen jako:</span> {user.email}
              </p>
            </div>
          )}

          <p className="text-sm text-slate-500 mb-6">
            Pokud máte dotazy, kontaktujte prosím administrátora systému.
          </p>

          <Button
            onClick={handleLogout}
            variant="outline"
            className="gap-2"
          >
            Odhlásit se
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}