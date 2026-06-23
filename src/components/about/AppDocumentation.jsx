import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ShieldAlert,
  LayoutDashboard,
  ClipboardList,
  Radio,
  AlertTriangle,
  Activity,
  Building2,
  Users,
  Settings,
  Sparkles,
  Info,
  Code,
  Terminal,
  Droplet,
  Wrench,
  Database,
  Bell,
  Smartphone,
  Cpu,
  GitBranch,
  Download,
} from "lucide-react";
import { APP_DOCUMENTATION_PROMPT } from "@/components/about/appDocumentationPrompt";

const roleColors = {
  SuperAdmin: "bg-red-100 text-red-700 border-red-200",
  Admin: "bg-purple-100 text-purple-700 border-purple-200",
  Manager: "bg-blue-100 text-blue-700 border-blue-200",
  Technik: "bg-green-100 text-green-700 border-green-200",
  Všichni: "bg-slate-100 text-slate-700 border-slate-200",
};

function RoleBadge({ role }) {
  return (
    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${roleColors[role] || roleColors["Všichni"]}`}>
      {role}
    </span>
  );
}

function PageBlock({ icon: Icon, title, route, roles, children }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 hover:shadow-sm transition-shadow">
      <div className="flex items-start gap-3 mb-3">
        <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
          <Icon className="w-5 h-5 text-slate-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-bold text-slate-900">{title}</h4>
            {route && <code className="text-[11px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">{route}</code>}
          </div>
          {roles && (
            <div className="flex items-center gap-1 mt-1.5 flex-wrap">
              <span className="text-[10px] text-slate-400 uppercase font-semibold mr-1">Přístup:</span>
              {roles.map((r) => <RoleBadge key={r} role={r} />)}
            </div>
          )}
        </div>
      </div>
      <div className="text-sm text-slate-600 space-y-1.5 pl-1">{children}</div>
    </div>
  );
}

export default function AppDocumentation() {
  const handleExport = () => {
    // BOM zajistí korektní diakritiku při otevření v Excelu / textovém editoru
    const blob = new Blob(["\uFEFF" + APP_DOCUMENTATION_PROMPT], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const stamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `HCMS-popis-aplikace-${stamp}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="mb-8 border-2 border-red-200 bg-gradient-to-br from-red-50/40 to-white">
      <CardHeader>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <CardTitle className="text-2xl flex items-center gap-3">
              <ShieldAlert className="w-8 h-8 text-red-600" />
              Kompletní dokumentace aplikace
            </CardTitle>
            <p className="text-sm text-slate-500 mt-1">
              Tato sekce je viditelná <strong>pouze pro SuperAdministrátory</strong> a obsahuje detailní technický popis
              celého systému — všech stránek, sekcí, rolí, datových struktur a automatizací.
            </p>
          </div>
          <Button onClick={handleExport} className="gap-2 flex-shrink-0">
            <Download className="w-4 h-4" />
            Export do Excelu
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-8">

        {/* Přehled architektury */}
        <section>
          <h3 className="text-lg font-bold text-slate-900 mb-3 flex items-center gap-2">
            <Cpu className="w-5 h-5 text-slate-500" /> Architektura systému
          </h3>
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div className="bg-white border border-slate-200 rounded-lg p-4">
              <h4 className="font-semibold text-slate-800 mb-1">Frontend</h4>
              <p className="text-slate-600">React + Vite, stylování pomocí Tailwind CSS a komponent shadcn/ui. Stavová data a cache jsou řízeny přes React Query. Grafy jsou vykreslovány knihovnou Recharts.</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-lg p-4">
              <h4 className="font-semibold text-slate-800 mb-1">Backend (Base44)</h4>
              <p className="text-slate-600">Databázové entity, serverové funkce (Deno), automatizace (plánované i událostní) a integrace (e-mail, AI analýza, příjem dat ze senzorů přes webhook).</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-lg p-4">
              <h4 className="font-semibold text-slate-800 mb-1">Dva provozní režimy</h4>
              <p className="text-slate-600"><strong>Režim Údržba</strong> (plné rozhraní) a <strong>Režim DEMIP</strong> (zjednodušené mobilní rozhraní pro techniky v terénu se spodní lištou a NFC skenováním kontrolních bodů).</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-lg p-4">
              <h4 className="font-semibold text-slate-800 mb-1">Příjem dat ze senzorů</h4>
              <p className="text-slate-600">Vibrační senzory Aissens posílají data přes MQTT/webhook. Backend dekóduje payload, počítá RMS/FFT metriky, ukládá trendy a vyhodnocuje alarmy proti normám.</p>
            </div>
          </div>
        </section>

        {/* Uživatelské role */}
        <section>
          <h3 className="text-lg font-bold text-slate-900 mb-3 flex items-center gap-2">
            <Users className="w-5 h-5 text-slate-500" /> Uživatelské role a oprávnění
          </h3>
          <div className="space-y-3 text-sm">
            <div className="bg-white border border-slate-200 rounded-lg p-4 flex items-start gap-3">
              <RoleBadge role="SuperAdmin" />
              <p className="text-slate-600 flex-1">Nejvyšší oprávnění. Vidí a spravuje všechny podniky, uživatele a systémová nastavení. Má přístup k API dokumentaci, logům ladění, nástrojům pro úklid dat a k této kompletní dokumentaci. Aktivuje moduly podnikům.</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-lg p-4 flex items-start gap-3">
              <RoleBadge role="Admin" />
              <p className="text-slate-600 flex-1">Správce přiřazených podniků (<code>assigned_company_ids</code>). Spravuje linky, stroje, kontrolní body, uživatele a nastavení v rámci svých podniků.</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-lg p-4 flex items-start gap-3">
              <RoleBadge role="Manager" />
              <p className="text-slate-600 flex-1">Vedoucí v rámci jednoho podniku (<code>company_id</code>). Schvaluje závady, vidí audit log a administraci, ale nemá plná systémová nastavení.</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-lg p-4 flex items-start gap-3">
              <RoleBadge role="Technik" />
              <p className="text-slate-600 flex-1">Pracovník v terénu. Plní pracovní příkazy, provádí kontroly (DEMIP), hlásí závady. Může být vynucen do mobilního režimu DEMIP.</p>
            </div>
            <div className="bg-white border border-amber-200 bg-amber-50/50 rounded-lg p-4 flex items-start gap-3">
              <Info className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <p className="text-slate-600 flex-1">Nový uživatel bez přiřazeného podniku vidí jen Dashboard, Novinky a O aplikaci, dokud mu administrátor nepřiřadí podnik. Účet může mít také nastavenou expiraci přístupu (<code>access_until</code>) a automatické odhlášení při nečinnosti.</p>
            </div>
          </div>
        </section>

        {/* Stránky a sekce */}
        <section>
          <h3 className="text-lg font-bold text-slate-900 mb-3 flex items-center gap-2">
            <GitBranch className="w-5 h-5 text-slate-500" /> Jednotlivé stránky a sekce
          </h3>
          <div className="grid gap-3">

            <PageBlock icon={LayoutDashboard} title="Dashboard" route="/Dashboard" roles={["Všichni"]}>
              <p>Hlavní rozcestník. Postupná navigace: výběr podniku → linky → stroje → kontrolního bodu. Pro techniky v režimu DEMIP zobrazuje zjednodušený přehled kontrolních bodů s podporou NFC skenování a manuálního potvrzení kontroly.</p>
            </PageBlock>

            <PageBlock icon={ClipboardList} title="Pracovní příkazy" route="/WorkOrders" roles={["Všichni"]}>
              <p>Seznam plánované údržby přiřazené uživatelům. Technik vidí své úkoly, jejich termíny a stav (přiřazeno / po termínu). Notifikace v hlavičce upozorňují na aktivní příkazy.</p>
            </PageBlock>

            <PageBlock icon={Radio} title="Vibrace online" route="/VibrationOnline" roles={["Všichni"]}>
              <p>Přehled strojů s aktivním vibračním monitoringem seskupený podle podniku a linky. Karty strojů ukazují stav senzoru (Online &lt; 12 h / Nedávno 12–24 h / Offline &gt; 24 h), baterii, teplotu, sílu signálu a barevný semafor stavu vibrací (A/B zelená, C žlutá, D červená).</p>
              <p>Záložka <strong>Alarmy</strong> zobrazuje aktivní vibrační výstrahy s možností kvitování. Viditelnost se řídí aktivací modulu vibrací u podniku.</p>
            </PageBlock>

            <PageBlock icon={AlertTriangle} title="Správa závad" route="/IssueApproval" roles={["Manager", "Admin", "SuperAdmin"]}>
              <p>Workflow pro schvalování nahlášených závad. Závady přicházejí ve stavu „reported", schvalovatel je posune dál nebo zamítne. Odznak v menu ukazuje počet čekajících závad v rámci viditelných podniků.</p>
            </PageBlock>

            <PageBlock icon={Activity} title="Audit Log" route="/AuditLog" roles={["Manager", "Admin", "SuperAdmin"]}>
              <p>Detailní historie aktivit (kdo, co, kdy). Obsahuje statistiky kontrol a aktivitu uživatelů pro účely compliance a zpětné kontroly.</p>
            </PageBlock>

            <PageBlock icon={Building2} title="Administrace" route="/Admin" roles={["Manager", "Admin", "SuperAdmin"]}>
              <p>Centrální místo pro správu struktury: podniky (a aktivace modulů — DEMIP, Údržba, Náhradní díly, Vibrace, Termo, Tribo, AI prediktivní analýza), linky, stroje, kontrolní body, vibrační normy, schémata měření, ložiska, termodiagnostika, kontroly linek, export a úklid dat.</p>
            </PageBlock>

            <PageBlock icon={Users} title="Uživatelé" route="/Users" roles={["Manager", "Admin", "SuperAdmin"]}>
              <p>Správa uživatelských účtů, rolí a přiřazení k podnikům. SuperAdmin zde navíc vidí trvalou tabulku nepřiřazených uživatelů (nově registrovaných bez podniku) pro rychlé zařazení.</p>
            </PageBlock>

            <PageBlock icon={Settings} title="Nastavení" route="/Settings" roles={["Admin", "SuperAdmin"]}>
              <p>Systémová konfigurace — parametry MQTT (práh trendu, spodní ořez FFT frekvence), nastavení e-mailových notifikací a další globální volby.</p>
            </PageBlock>

            <PageBlock icon={Sparkles} title="Novinky (Changelog)" route="/Changelog" roles={["Všichni"]}>
              <p>Seznam změn a vydání s typem (funkce, oprava, vylepšení, oznámení), verzí a datem. Podporuje Markdown popis.</p>
            </PageBlock>

            <PageBlock icon={Info} title="O aplikaci" route="/About" roles={["Všichni"]}>
              <p>Marketingový a informační přehled systému. Tato kompletní technická dokumentace (kterou právě čtete) je v rámci stránky viditelná pouze SuperAdminům.</p>
            </PageBlock>

            <PageBlock icon={Code} title="API Dokumentace" route="/ApiDocumentation" roles={["SuperAdmin"]}>
              <p>Popis API endpointů a webhooku pro příjem dat ze senzorů, včetně formátu payloadu a autentizace tokenem.</p>
            </PageBlock>

            <PageBlock icon={Terminal} title="Log ladění" route="/DebugLog" roles={["SuperAdmin"]}>
              <p>Diagnostický výpis pro řešení problémů — zpracování zpráv ze senzorů, NFC skenování a systémové události.</p>
            </PageBlock>

            <PageBlock icon={Droplet} title="DEMIP / Mobilní režim" route="/MobileHome" roles={["Technik", "Všichni"]}>
              <p>Zjednodušené terénní rozhraní se spodní navigační lištou (Skenovat NFC, Přehled, Příkazy, Menu, Odhlásit). Optimalizováno pro rychlou práci na hale z mobilu.</p>
            </PageBlock>

          </div>
        </section>

        {/* Detail stroje */}
        <section>
          <h3 className="text-lg font-bold text-slate-900 mb-3 flex items-center gap-2">
            <Wrench className="w-5 h-5 text-slate-500" /> Detail stroje — záložky
          </h3>
          <div className="bg-white border border-slate-200 rounded-lg p-4 text-sm text-slate-600 space-y-2">
            <p><strong className="text-slate-800">Přehled</strong> — základní info o stroji, stav závad a kontrolních bodů.</p>
            <p><strong className="text-slate-800">DEMIP</strong> — mazací a kontrolní body s intervaly a potvrzováním.</p>
            <p><strong className="text-slate-800">Vibrační karta</strong> — tabulka měřicích míst s hodnotami Vel X/Y/Z, Acc Z, Obálka Z, teplota, baterie, signál a stav senzoru. Každé místo lze konfigurovat (senzor, normy pro rychlost/zrychlení/teplotu, typ ložiska). Obsahuje panely Trend, Spektrum (FFT analýza) a AI diagnostickou analýzu (při stavu C/D, pokud má podnik povolen prediktivní modul).</p>
            <p><strong className="text-slate-800">Dokumentace</strong> — technické dokumenty a manuály ke stroji.</p>
            <p><strong className="text-slate-800">Statistiky</strong> — historie údržby, závad a měření.</p>
            <p><strong className="text-slate-800">Údržba</strong> — záznamy o provedené údržbě (preventivní, reaktivní, prediktivní, inspekce).</p>
          </div>
        </section>

        {/* Datové entity */}
        <section>
          <h3 className="text-lg font-bold text-slate-900 mb-3 flex items-center gap-2">
            <Database className="w-5 h-5 text-slate-500" /> Klíčové datové entity
          </h3>
          <div className="grid md:grid-cols-2 gap-3 text-sm">
            {[
              ["Company", "Podnik — aktivace modulů, vizualizace překročení intervalů, kontaktní údaje."],
              ["Line / Machine", "Linky a stroje (vč. podřízených sekcí). Stroj nese typ, normy, schéma měření a příznaky monitoringu."],
              ["ControlPoint", "Kontrolní/mazací bod s NFC čipem, intervalem a typem kontroly."],
              ["AissensSensor", "Registrovaný vibrační senzor — last_seen, baterie, teplota, signál, firmware."],
              ["SensorData / SensorFFTData", "Surová a spektrální měření, předpočítané RMS hodnoty (vel, acc, obálka)."],
              ["SensorTrendPoint", "Body trendu v čase pro rychlé vykreslení grafů."],
              ["VibrationStandard", "Normy s limity A/B/C/D pro rychlost, zrychlení a teplotu."],
              ["VibrationSensorAssignment", "Přiřazení senzoru a norem k řádku vibračního schématu."],
              ["VibrationAlert", "Vibrační alarm — pásmo, metrika, hodnota, stav (aktivní/kvitováno)."],
              ["BearingType", "Databáze ložisek (~31 tis. záznamů) s koeficienty BPFO/BPFI/BSF/FTF."],
              ["Issue", "Nahlášená závada a její schvalovací workflow."],
              ["PlannedMaintenance / MaintenanceRecord", "Plánované příkazy a provedené údržbové úkony."],
              ["PredictiveAnalysis", "Výsledky AI prediktivní analýzy — skóre zdraví, pravděpodobnost selhání."],
              ["User", "Účet — role, přiřazení k podniku, expirace přístupu, auto-logout."],
              ["AuditLog / SystemLog / NfcLog", "Záznamy aktivit, systémové a NFC logy."],
            ].map(([name, desc]) => (
              <div key={name} className="bg-white border border-slate-200 rounded-lg p-3">
                <code className="text-xs font-bold text-indigo-600">{name}</code>
                <p className="text-slate-600 mt-1">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Automatizace */}
        <section>
          <h3 className="text-lg font-bold text-slate-900 mb-3 flex items-center gap-2">
            <Bell className="w-5 h-5 text-slate-500" /> Automatizace a serverové funkce
          </h3>
          <div className="bg-white border border-slate-200 rounded-lg p-4 text-sm text-slate-600 space-y-2">
            <p><strong className="text-slate-800">Příjem dat ze senzorů</strong> — webhook dekóduje payload, počítá metriky, ukládá trendy a generuje vibrační alarmy proti normám.</p>
            <p><strong className="text-slate-800">Notifikace nových registrací</strong> — pravidelná kontrola nově registrovaných uživatelů a upozornění SuperAdminů e-mailem.</p>
            <p><strong className="text-slate-800">Kontrola vibračních alarmů</strong> — vyhodnocení překročení limitů a odeslání notifikací příjemcům (dle pásma C/D a jejich nastavení).</p>
            <p><strong className="text-slate-800">AI diagnostika</strong> — analýza FFT spektra pro detekci poškození ložisek a doporučení údržby.</p>
            <p><strong className="text-slate-800">Sledování aktivity</strong> — záznam aktivity uživatelů pro určení online stavu a auto-logout.</p>
            <p><strong className="text-slate-800">Úklidové nástroje</strong> — odstranění osiřelých záznamů, neplatných dat a hromadné operace nad strukturou.</p>
          </div>
        </section>

        <div className="bg-slate-900 text-slate-300 rounded-xl p-4 text-xs flex items-start gap-3">
          <Smartphone className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
          <p>Dokument je generován jako interní přehled pro správce systému. Konkrétní viditelnost položek menu i funkcí se dále řídí aktivovanými moduly daného podniku a rolí přihlášeného uživatele.</p>
        </div>

      </CardContent>
    </Card>
  );
}