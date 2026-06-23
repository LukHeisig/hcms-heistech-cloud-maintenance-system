// Kompletní textový prompt popisující aplikaci HCMS.
// Slouží jako podklad pro export (lze otevřít i v Excelu) a jako vstup pro AI nástroje.

export const APP_DOCUMENTATION_PROMPT = `# HCMS — Heistech Cloud Maintenance System
# Kompletní popis aplikace (prompt)

## SHRNUTÍ
HCMS je cloudový systém pro komplexní správu údržby průmyslových zařízení. Pokrývá mazací a inspekční plány (DEMIP), plánovanou a reaktivní údržbu, správu závad, online vibrační diagnostiku se senzory Aissens, termodiagnostiku, AI prediktivní analýzu, dokumentaci a reporting. Je multi-podnikový s řízením přístupu podle rolí.

## ARCHITEKTURA
- Frontend: React + Vite, Tailwind CSS, shadcn/ui, React Query (cache/stav), Recharts (grafy).
- Backend (Base44): databázové entity, serverové funkce (Deno), automatizace (plánované i událostní), integrace (e-mail, AI, příjem dat ze senzorů přes webhook).
- Dva provozní režimy: "Údržba" (plné rozhraní) a "DEMIP" (zjednodušené mobilní rozhraní pro techniky se spodní lištou a NFC skenováním kontrolních bodů).
- Příjem dat: vibrační senzory Aissens posílají data přes MQTT/webhook; backend dekóduje payload, počítá RMS/FFT metriky, ukládá trendy a vyhodnocuje alarmy proti normám.

## UŽIVATELSKÉ ROLE
- SuperAdmin: nejvyšší oprávnění, všechny podniky a uživatelé, systémová nastavení, API dokumentace, logy ladění, úklid dat, aktivace modulů podnikům, tato kompletní dokumentace.
- Admin: správce přiřazených podniků (assigned_company_ids) — linky, stroje, kontrolní body, uživatelé, nastavení v rámci svých podniků.
- Manager: vedoucí jednoho podniku (company_id) — schvaluje závady, vidí audit log a administraci bez plných systémových nastavení.
- Technik: pracovník v terénu — plní pracovní příkazy, provádí kontroly (DEMIP), hlásí závady; může být vynucen do mobilního režimu DEMIP.
- Nový uživatel bez podniku: vidí jen Dashboard, Novinky a O aplikaci, dokud mu admin nepřiřadí podnik. Účet může mít expiraci přístupu (access_until) a automatické odhlášení při nečinnosti.

## STRÁNKY A SEKCE
- Dashboard (/Dashboard) — Všichni: rozcestník, navigace podnik → linka → stroj → kontrolní bod; pro techniky DEMIP zjednodušený přehled s NFC skenováním a manuálním potvrzením.
- Pracovní příkazy (/WorkOrders) — Všichni: seznam plánované údržby přiřazené uživatelům, termíny, stav (přiřazeno/po termínu), notifikace v hlavičce.
- Vibrace online (/VibrationOnline) — Všichni: přehled strojů s vibračním monitoringem dle podniku a linky; stav senzoru (Online <12h / Nedávno 12–24h / Offline >24h), baterie, teplota, signál, semafor vibrací (A/B zelená, C žlutá, D červená); záložka Alarmy s kvitováním; řízeno aktivací modulu vibrací.
- Správa závad (/IssueApproval) — Manager/Admin/SuperAdmin: workflow schvalování závad (stav reported → schválit/zamítnout), odznak s počtem čekajících.
- Audit Log (/AuditLog) — Manager/Admin/SuperAdmin: historie aktivit (kdo, co, kdy), statistiky kontrol a aktivita uživatelů.
- Administrace (/Admin) — Manager/Admin/SuperAdmin: podniky a aktivace modulů (DEMIP, Údržba, Náhradní díly, Vibrace, Termo, Tribo, AI prediktivní analýza), linky, stroje, kontrolní body, vibrační normy, schémata měření, ložiska, termodiagnostika, kontroly linek, export a úklid dat.
- Uživatelé (/Users) — Manager/Admin/SuperAdmin: správa účtů, rolí a přiřazení k podnikům; SuperAdmin navíc tabulka nepřiřazených uživatelů.
- Nastavení (/Settings) — Admin/SuperAdmin: parametry MQTT (práh trendu, spodní ořez FFT frekvence), e-mailové notifikace, globální volby.
- Novinky/Changelog (/Changelog) — Všichni: seznam změn s typem (funkce, oprava, vylepšení, oznámení), verzí a datem, Markdown popis.
- O aplikaci (/About) — Všichni: informační přehled; kompletní technická dokumentace viditelná jen SuperAdminům.
- API Dokumentace (/ApiDocumentation) — SuperAdmin: popis API a webhooku pro příjem dat ze senzorů, formát payloadu a autentizace tokenem.
- Log ladění (/DebugLog) — SuperAdmin: diagnostický výpis (zpracování senzorů, NFC, systémové události).
- DEMIP / Mobilní režim (/MobileHome) — Technik/Všichni: terénní rozhraní se spodní lištou (Skenovat NFC, Přehled, Příkazy, Menu, Odhlásit), optimalizováno pro mobil.

## DETAIL STROJE — ZÁLOŽKY
- Přehled: základní info, stav závad a kontrolních bodů.
- DEMIP: mazací a kontrolní body s intervaly a potvrzováním.
- Vibrační karta: tabulka měřicích míst (Vel X/Y/Z, Acc Z, Obálka Z, teplota, baterie, signál, stav senzoru); konfigurace místa (senzor, normy rychlost/zrychlení/teplota, typ ložiska); panely Trend, Spektrum (FFT) a AI diagnostika (při C/D, pokud má podnik povolen prediktivní modul).
- Dokumentace: technické dokumenty a manuály.
- Statistiky: historie údržby, závad a měření.
- Údržba: záznamy o provedené údržbě (preventivní, reaktivní, prediktivní, inspekce).

## KLÍČOVÉ DATOVÉ ENTITY
- Company: podnik — aktivace modulů, vizualizace překročení intervalů, kontaktní údaje.
- Line / Machine: linky a stroje (vč. podřízených sekcí); stroj nese typ, normy, schéma měření a příznaky monitoringu.
- ControlPoint: kontrolní/mazací bod s NFC čipem, intervalem a typem kontroly.
- AissensSensor: registrovaný vibrační senzor — last_seen, baterie, teplota, signál, firmware.
- SensorData / SensorFFTData: surová a spektrální měření, předpočítané RMS hodnoty (vel, acc, obálka).
- SensorTrendPoint: body trendu v čase pro grafy.
- VibrationStandard: normy s limity A/B/C/D pro rychlost, zrychlení a teplotu.
- VibrationSensorAssignment: přiřazení senzoru a norem k řádku vibračního schématu.
- VibrationAlert: vibrační alarm — pásmo, metrika, hodnota, stav (aktivní/kvitováno).
- BearingType: databáze ložisek (~31 tis. záznamů) s koeficienty BPFO/BPFI/BSF/FTF.
- Issue: nahlášená závada a její schvalovací workflow.
- PlannedMaintenance / MaintenanceRecord: plánované příkazy a provedené úkony.
- PredictiveAnalysis: výsledky AI analýzy — skóre zdraví, pravděpodobnost selhání.
- User: účet — role, přiřazení k podniku, expirace přístupu, auto-logout.
- AuditLog / SystemLog / NfcLog: záznamy aktivit, systémové a NFC logy.

## AUTOMATIZACE A SERVEROVÉ FUNKCE
- Příjem dat ze senzorů: webhook dekóduje payload, počítá metriky, ukládá trendy, generuje vibrační alarmy proti normám.
- Notifikace nových registrací: kontrola nově registrovaných a upozornění SuperAdminů e-mailem.
- Kontrola vibračních alarmů: vyhodnocení překročení limitů a notifikace příjemcům (dle pásma C/D a nastavení).
- AI diagnostika: analýza FFT spektra pro detekci poškození ložisek a doporučení údržby.
- Sledování aktivity: záznam aktivity uživatelů pro online stav a auto-logout.
- Úklidové nástroje: odstranění osiřelých záznamů, neplatných dat, hromadné operace nad strukturou.

## POZNÁMKA
Viditelnost položek menu i funkcí se řídí aktivovanými moduly daného podniku a rolí přihlášeného uživatele.
`;