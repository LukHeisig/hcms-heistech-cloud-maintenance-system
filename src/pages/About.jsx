
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  CheckCircle,
  Droplet,
  ClipboardCheck,
  TrendingUp,
  Shield,
  Clock,
  Zap,
  LineChart,
  Users,
  Cloud,
  Smartphone,
  Bell,
  FileText,
  Settings,
  ArrowRight
} from "lucide-react";

export default function About() {
  return (
    <div className="p-4 md:p-8 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
      <div className="max-w-6xl mx-auto">
        {/* Hero sekce */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl shadow-2xl mb-6">
            <span className="text-white font-bold text-4xl">H</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">
            HCMS
          </h1>
          <p className="text-xl text-slate-600 mb-2">
            Heistech Cloud Maintenance System
          </p>
          <p className="text-slate-500 max-w-2xl mx-auto">
            Moderní cloudový systém pro komplexní správu údržby průmyslových zařízení
          </p>
        </div>

        {/* Proč HCMS */}
        <Card className="mb-8 border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-white">
          <CardHeader>
            <CardTitle className="text-2xl text-blue-900">
              Proč implementovat HCMS ve vaší firmě?
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="flex gap-4">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                    <TrendingUp className="w-6 h-6 text-blue-600" />
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 mb-2">
                    Zvýšení produktivity o 30-40%
                  </h3>
                  <p className="text-sm text-slate-600">
                    Systematická údržba a včasné odhalení problémů minimalizuje neplánované prostoje a zvyšuje celkovou efektivitu výroby.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                    <CheckCircle className="w-6 h-6 text-green-600" />
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 mb-2">
                    Dodržování údržbových plánů
                  </h3>
                  <p className="text-sm text-slate-600">
                    Automatické připomínky a notifikace zajišťují, že žádný údržbový úkon nebude zapomenut nebo opomenut.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                    <Clock className="w-6 h-6 text-orange-600" />
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 mb-2">
                    Úspora času a nákladů
                  </h3>
                  <p className="text-sm text-slate-600">
                    Digitalizace údržbových procesů eliminuje papírování, snižuje administrativní zátěž a optimalizuje využití zdrojů.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                    <Shield className="w-6 h-6 text-purple-600" />
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 mb-2">
                    Plná kontrola a přehled
                  </h3>
                  <p className="text-sm text-slate-600">
                    Centralizovaná evidence všech údržbových činností, historie závad a detailní reporty pro management.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Klíčové funkcionality */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-2xl">Klíčové funkcionality</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="text-center p-4">
                <div className="w-16 h-16 bg-blue-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <Droplet className="w-8 h-8 text-blue-600" />
                </div>
                <h3 className="font-semibold text-slate-900 mb-2">
                  Mazací plány
                </h3>
                <p className="text-sm text-slate-600">
                  Systematická správa mazacích bodů s definovanými intervaly, typy maziv a množstvím.
                </p>
              </div>

              <div className="text-center p-4">
                <div className="w-16 h-16 bg-purple-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <ClipboardCheck className="w-8 h-8 text-purple-600" />
                </div>
                <h3 className="font-semibold text-slate-900 mb-2">
                  Inspekční kontroly
                </h3>
                <p className="text-sm text-slate-600">
                  Pravidelné inspekce strojů a zařízení s možností fotodokumentace a poznámek.
                </p>
              </div>

              <div className="text-center p-4">
                <div className="w-16 h-16 bg-green-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <Settings className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="font-semibold text-slate-900 mb-2">
                  Plánovaná údržba
                </h3>
                <p className="text-sm text-slate-600">
                  Vytváření a správa preventivních, reaktivních i prediktivních údržbových úkolů.
                </p>
              </div>

              <div className="text-center p-4">
                <div className="w-16 h-16 bg-red-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <Bell className="w-8 h-8 text-red-600" />
                </div>
                <h3 className="font-semibold text-slate-900 mb-2">
                  Správa závad
                </h3>
                <p className="text-sm text-slate-600">
                  Rychlé nahlášení závad, workflow pro schvalování a řešení problémů.
                </p>
              </div>

              <div className="text-center p-4">
                <div className="w-16 h-16 bg-orange-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <LineChart className="w-8 h-8 text-orange-600" />
                </div>
                <h3 className="font-semibold text-slate-900 mb-2">
                  Statistiky a reporty
                </h3>
                <p className="text-sm text-slate-600">
                  Detailní analýzy výkonnosti, nákladů na údržbu a historie všech událostí.
                </p>
              </div>

              <div className="text-center p-4">
                <div className="w-16 h-16 bg-indigo-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <FileText className="w-8 h-8 text-indigo-600" />
                </div>
                <h3 className="font-semibold text-slate-900 mb-2">
                  Dokumentace
                </h3>
                <p className="text-sm text-slate-600">
                  Centrální úložiště technické dokumentace, výkresů a provozních manuálů.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Technologické výhody */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-2xl">Technologické výhody</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="flex items-start gap-4">
                <Cloud className="w-6 h-6 text-blue-600 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-semibold text-slate-900 mb-1">
                    Cloudové řešení
                  </h3>
                  <p className="text-sm text-slate-600">
                    Přístup odkudkoli, kdykoli. Žádná instalace, automatické aktualizace, zálohování dat v reálném čase.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <Smartphone className="w-6 h-6 text-green-600 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-semibold text-slate-900 mb-1">
                    Mobilní optimalizace
                  </h3>
                  <p className="text-sm text-slate-600">
                    Plně responzivní design umožňuje práci přímo na výrobní hale z mobilního telefonu nebo tabletu.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <Users className="w-6 h-6 text-purple-600 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-semibold text-slate-900 mb-1">
                    Multi-podnikové prostředí
                  </h3>
                  <p className="text-sm text-slate-600">
                    Jeden systém pro správu více podniků nebo provozoven s oddělenými daty a oprávněními.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <Zap className="w-6 h-6 text-orange-600 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-semibold text-slate-900 mb-1">
                    Rychlé nasazení
                  </h3>
                  <p className="text-sm text-slate-600">
                    Během několika hodin můžete mít systém plně nakonfigurovaný a připravený k použití.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Komu je HCMS určen */}
        <Card className="mb-8 bg-gradient-to-br from-slate-50 to-white">
          <CardHeader>
            <CardTitle className="text-2xl">Pro koho je HCMS určen?</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <ArrowRight className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <p className="text-slate-700">
                  <strong>Výrobní podniky</strong> s potřebou systematické údržby výrobních linek a strojů
                </p>
              </div>
              <div className="flex items-start gap-3">
                <ArrowRight className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <p className="text-slate-700">
                  <strong>Údržbářské týmy</strong> hledající efektivní nástroj pro plánování a evidenci práce
                </p>
              </div>
              <div className="flex items-start gap-3">
                <ArrowRight className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <p className="text-slate-700">
                  <strong>Vedoucí údržby a management</strong> potřebující přehled o stavu strojů a nákladech
                </p>
              </div>
              <div className="flex items-start gap-3">
                <ArrowRight className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <p className="text-slate-700">
                  <strong>Společnosti s více provozovnami</strong> vyžadující centralizovanou správu údržby
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Footer s kontaktem */}
        <Card className="bg-gradient-to-br from-blue-600 to-blue-700 text-white border-none">
          <CardContent className="p-8 text-center">
            <h2 className="text-2xl font-bold mb-3">
              Připraveni modernizovat vaši údržbu?
            </h2>
            <p className="text-blue-100 mb-6">
              Kontaktujte nás pro demo prezentaci nebo více informací o HCMS
            </p>
            <div className="flex flex-col items-center gap-2 text-sm">
              <p className="text-blue-100">
                <strong className="text-white">Email:</strong> info@heistech.cz
              </p>
              <p className="text-blue-100">
                <strong className="text-white">Web:</strong> www.heistech.cz
              </p>
            </div>
            <div className="mt-6 pt-6 border-t border-blue-500">
              <p className="text-xs text-blue-200">
                HCMS v1.0 | © 2024 Heistech s.r.o. | Vyvinuto na platformě Base44
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
