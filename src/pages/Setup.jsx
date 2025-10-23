
import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, CheckCircle, Factory } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function Setup() {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const navigate = useNavigate();

  const createDemoData = async () => {
    setLoading(true);
    try {
      const user = await base44.auth.me();

      // 1. Vytvořit podnik
      let company;
      const existingCompanies = await base44.entities.Company.list();
      if (existingCompanies.length > 0) {
        company = existingCompanies[0];
      } else {
        company = await base44.entities.Company.create({
          name: "Demo podnik",
          contact_person: user.full_name || "Uživatel",
          email: user.email,
          phone: "+420 123 456 789",
          address: "Průmyslová 1, Praha",
          is_active: true,
        });
      }

      // Aktualizovat uživatele s company_id
      await base44.auth.updateMe({
        company_id: company.id,
        user_type: "admin",
      });

      // 2. Vytvořit linky
      const line1 = await base44.entities.Line.create({
        company_id: company.id,
        name: "Linka 1 - Lisovna",
        description: "Hlavní výrobní linka pro lisování",
        order_index: 1,
      });

      const line2 = await base44.entities.Line.create({
        company_id: company.id,
        name: "Linka 2 - Montáž",
        description: "Montážní linka",
        order_index: 2,
      });

      // 3. Vytvořit stroje
      const machine1 = await base44.entities.Machine.create({
        line_id: line1.id,
        name: "Lis LH-500",
        description: "Hydraulický lis 500t",
        order_index: 1,
      });

      const machine2 = await base44.entities.Machine.create({
        line_id: line1.id,
        name: "Dopravník D1",
        description: "Pásový dopravník",
        order_index: 2,
      });

      const machine3 = await base44.entities.Machine.create({
        line_id: line2.id,
        name: "Montážní stůl M1",
        description: "Automatizovaný montážní stůl",
        order_index: 1,
      });

      // 4. Vytvořit kontrolní body
      const point1 = await base44.entities.ControlPoint.create({
        machine_id: machine1.id,
        name: "Hlavní ložisko",
        type: "lubrication",
        description: "Mazání hlavního ložiska lisu",
        lubricant_type: "SKF LGWA 2",
        lubricant_amount: 12,
        interval_hours: 168,
      });

      const point2 = await base44.entities.ControlPoint.create({
        machine_id: machine1.id,
        name: "Vedení válce",
        type: "lubrication",
        description: "Mazání vedení hydraulického válce",
        lubricant_type: "SKF LGWA 2",
        lubricant_amount: 8,
        interval_hours: 336,
      });

      const point3 = await base44.entities.ControlPoint.create({
        machine_id: machine1.id,
        name: "Kontrola úniku oleje",
        type: "inspection",
        description: "Vizuální kontrola těsnosti hydraulického systému",
        inspection_tasks: "Zkontrolovat těsnost, úniky, stav hadic",
        interval_hours: 168,
      });

      await base44.entities.ControlPoint.create({
        machine_id: machine2.id,
        name: "Ložisko motoru",
        type: "lubrication",
        lubricant_type: "Shell Gadus S2",
        lubricant_amount: 6,
        interval_hours: 720,
      });

      await base44.entities.ControlPoint.create({
        machine_id: machine3.id,
        name: "Vedení rotační osy",
        type: "lubrication",
        lubricant_type: "SKF LGWA 2",
        lubricant_amount: 5,
        interval_hours: 336,
      });

      await base44.entities.ControlPoint.create({
        machine_id: machine3.id,
        name: "Kontrola pneumatiky",
        type: "inspection",
        inspection_tasks: "Zkontrolovat tlak vzduchu, těsnost spojů",
        interval_hours: 336,
      });

      // 5. Vytvořit ukázkové záznamy
      await base44.entities.ControlRecord.create({
        control_point_id: point1.id,
        record_type: "lubrication",
        performed_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        note: "Mazání provedeno dle plánu",
      });

      await base44.entities.ControlRecord.create({
        control_point_id: point2.id,
        record_type: "lubrication",
        performed_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      });

      await base44.entities.ControlRecord.create({
        control_point_id: point3.id,
        record_type: "inspection",
        performed_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        note: "Vše v pořádku, žádné úniky",
      });

      // 6. Vytvořit ukázkovou závadu
      await base44.entities.Issue.create({
        control_point_id: point1.id,
        description: "Zjištěn mírný únik maziva z těsnění",
        status: "reported",
      });

      setDone(true);
    } catch (error) {
      console.error("Error creating demo data:", error);
      alert("Chyba při vytváření dat: " + error.message);
    }
    setLoading(false);
  };

  if (done) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <Card className="max-w-lg w-full shadow-2xl">
          <CardContent className="p-12 text-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-12 h-12 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-4">
              Aplikace je připravena!
            </h2>
            <p className="text-slate-600 mb-8">
              Demo data byla úspěšně vytvořena. Nyní můžete začít používat aplikaci.
            </p>
            <Button
              onClick={() => navigate(createPageUrl("Dashboard"))}
              className="w-full bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800"
            >
              Přejít na Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <Card className="max-w-lg w-full shadow-2xl">
        <CardHeader className="text-center pb-8 pt-12">
          <div className="w-20 h-20 bg-gradient-to-br from-red-600 to-red-700 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl">
            <Factory className="w-12 h-12 text-white" />
          </div>
          <CardTitle className="text-3xl font-bold text-slate-900 mb-2">
            Vítejte v DEMIP
          </CardTitle>
          <p className="text-slate-600">
            Digitální Evidence Mazacích a Inspekčních Procesů
          </p>
        </CardHeader>
        <CardContent className="px-12 pb-12">
          <div className="space-y-6">
            <div className="bg-slate-50 rounded-xl p-6 border border-slate-200">
              <h3 className="font-semibold text-slate-900 mb-3">
                Co vytvoříme:
              </h3>
              <ul className="space-y-2 text-sm text-slate-600">
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <span>Jeden demo podnik</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <span>2 výrobní linky s ukázkovými stroji</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <span>6 kontrolních bodů (mazání + inspekce)</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <span>Ukázkové záznamy a závadu</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <span>Vaše uživatelské oprávnění (admin)</span>
                </li>
              </ul>
            </div>

            <Button
              onClick={createDemoData}
              disabled={loading}
              className="w-full bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 h-12 text-base font-semibold"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Vytváření demo dat...
                </>
              ) : (
                "Vytvořit demo data a začít"
              )}
            </Button>

            <p className="text-xs text-center text-slate-500">
              Demo data můžete později upravit nebo smazat
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
