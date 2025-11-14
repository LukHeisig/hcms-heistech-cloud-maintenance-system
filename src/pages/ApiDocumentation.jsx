import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Code, Copy, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ApiDocumentation() {
  const [copiedSection, setCopiedSection] = React.useState(null);

  const copyToClipboard = (text, section) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(section);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const apiBaseUrl = window.location.origin + "/api/v1";

  return (
    <div className="p-4 md:p-8 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">REST API Dokumentace</h1>
          <p className="text-slate-600">
            Kompletní dokumentace pro připojení mobilní aplikace k HCMS systému
          </p>
        </div>

        {/* Základní informace */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Základní informace</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="font-semibold text-slate-900 mb-2">Base URL</h3>
              <div className="bg-slate-900 text-green-400 p-4 rounded-lg font-mono text-sm flex items-center justify-between">
                <code>{apiBaseUrl}</code>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(apiBaseUrl, 'baseUrl')}
                  className="text-white hover:text-green-400"
                >
                  {copiedSection === 'baseUrl' ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-slate-900 mb-2">Autentizace</h3>
              <p className="text-sm text-slate-600 mb-3">
                Všechny požadavky musí obsahovat autentizační token v HTTP hlavičce:
              </p>
              <div className="bg-slate-900 text-green-400 p-4 rounded-lg font-mono text-sm">
                <code>Authorization: Bearer YOUR_ACCESS_TOKEN</code>
              </div>
              <p className="text-xs text-slate-500 mt-2">
                Token získáte přihlášením přes Base44 OAuth systém nebo z dashboard → settings → API Keys
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-slate-900 mb-2">Formát dat</h3>
              <p className="text-sm text-slate-600">
                Všechna data jsou ve formátu <Badge variant="outline">JSON</Badge>
              </p>
              <div className="bg-slate-900 text-green-400 p-4 rounded-lg font-mono text-sm mt-2">
                <code>Content-Type: application/json</code>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Entity endpointy */}
        <Tabs defaultValue="companies" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 lg:grid-cols-6 gap-2">
            <TabsTrigger value="companies">Podniky</TabsTrigger>
            <TabsTrigger value="lines">Linky</TabsTrigger>
            <TabsTrigger value="machines">Stroje</TabsTrigger>
            <TabsTrigger value="controlpoints">Kontrolní body</TabsTrigger>
            <TabsTrigger value="records">Záznamy</TabsTrigger>
            <TabsTrigger value="issues">Závady</TabsTrigger>
          </TabsList>

          {/* Companies */}
          <TabsContent value="companies">
            <Card>
              <CardHeader>
                <CardTitle>Company (Podniky)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* List */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className="bg-blue-600">GET</Badge>
                    <code className="text-sm">/entities/Company</code>
                  </div>
                  <p className="text-sm text-slate-600 mb-3">Získání všech podniků</p>
                  <div className="bg-slate-900 text-green-400 p-4 rounded-lg font-mono text-xs overflow-x-auto">
                    <pre>{`// Požadavek
GET ${apiBaseUrl}/entities/Company
Authorization: Bearer YOUR_TOKEN

// Odpověď
[
  {
    "id": "company_123",
    "name": "Heistech s.r.o.",
    "address": "Průmyslová 1, Praha",
    "contact_person": "Jan Novák",
    "email": "info@heistech.cz",
    "phone": "+420 123 456 789",
    "is_active": true,
    "created_date": "2024-01-15T10:30:00Z",
    "updated_date": "2024-01-15T10:30:00Z",
    "created_by": "user@example.com"
  }
]`}</pre>
                  </div>
                </div>

                {/* Get by ID */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className="bg-blue-600">GET</Badge>
                    <code className="text-sm">/entities/Company/:id</code>
                  </div>
                  <p className="text-sm text-slate-600 mb-3">Získání konkrétního podniku</p>
                </div>

                {/* Create */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className="bg-green-600">POST</Badge>
                    <code className="text-sm">/entities/Company</code>
                  </div>
                  <p className="text-sm text-slate-600 mb-3">Vytvoření nového podniku (pouze admin/superAdmin)</p>
                  <div className="bg-slate-900 text-green-400 p-4 rounded-lg font-mono text-xs overflow-x-auto">
                    <pre>{`// Požadavek
POST ${apiBaseUrl}/entities/Company
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "name": "Nový podnik s.r.o.",
  "address": "Adresa 123",
  "contact_person": "Kontaktní osoba",
  "email": "email@podnik.cz",
  "phone": "+420 123 456 789",
  "is_active": true
}`}</pre>
                  </div>
                </div>

                {/* Update */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className="bg-yellow-600">PUT</Badge>
                    <code className="text-sm">/entities/Company/:id</code>
                  </div>
                  <p className="text-sm text-slate-600">Aktualizace podniku</p>
                </div>

                {/* Delete */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className="bg-red-600">DELETE</Badge>
                    <code className="text-sm">/entities/Company/:id</code>
                  </div>
                  <p className="text-sm text-slate-600">Smazání podniku</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Lines */}
          <TabsContent value="lines">
            <Card>
              <CardHeader>
                <CardTitle>Line (Linky)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className="bg-blue-600">GET</Badge>
                    <code className="text-sm">/entities/Line</code>
                  </div>
                  <p className="text-sm text-slate-600 mb-3">Získání všech linek</p>
                  <div className="bg-slate-900 text-green-400 p-4 rounded-lg font-mono text-xs overflow-x-auto">
                    <pre>{`// Odpověď
[
  {
    "id": "line_123",
    "company_id": "company_123",
    "name": "Linka 1 - Lisovna",
    "description": "Hlavní výrobní linka",
    "order_index": 1,
    "created_date": "2024-01-15T10:30:00Z",
    "updated_date": "2024-01-15T10:30:00Z",
    "created_by": "user@example.com"
  }
]`}</pre>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold text-slate-900 mb-2">Filtrace</h3>
                  <div className="bg-slate-900 text-green-400 p-4 rounded-lg font-mono text-xs overflow-x-auto">
                    <pre>{`// Filtrovat linky podle company_id
GET ${apiBaseUrl}/entities/Line?filter={"company_id":"company_123"}

// S řazením podle order_index
GET ${apiBaseUrl}/entities/Line?filter={"company_id":"company_123"}&sort=order_index`}</pre>
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className="bg-green-600">POST</Badge>
                    <code className="text-sm">/entities/Line</code>
                  </div>
                  <p className="text-sm text-slate-600 mb-3">Vytvoření nové linky</p>
                  <div className="bg-slate-900 text-green-400 p-4 rounded-lg font-mono text-xs overflow-x-auto">
                    <pre>{`{
  "company_id": "company_123",
  "name": "Linka 2 - Montáž",
  "description": "Montážní linka",
  "order_index": 2
}`}</pre>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Machines */}
          <TabsContent value="machines">
            <Card>
              <CardHeader>
                <CardTitle>Machine (Stroje)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className="bg-blue-600">GET</Badge>
                    <code className="text-sm">/entities/Machine</code>
                  </div>
                  <p className="text-sm text-slate-600 mb-3">Získání všech strojů</p>
                  <div className="bg-slate-900 text-green-400 p-4 rounded-lg font-mono text-xs overflow-x-auto">
                    <pre>{`// Odpověď
[
  {
    "id": "machine_123",
    "line_id": "line_123",
    "name": "Lis LH-500",
    "description": "Hydraulický lis 500t",
    "inventory_number": "INV-2024-001",
    "location": "Hala A, sekce 1",
    "machine_type": "press",
    "order_index": 1,
    "created_date": "2024-01-15T10:30:00Z",
    "updated_date": "2024-01-15T10:30:00Z",
    "created_by": "user@example.com"
  }
]`}</pre>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold text-slate-900 mb-2">Typy strojů (machine_type)</h3>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">press</Badge>
                    <Badge variant="outline">conveyor</Badge>
                    <Badge variant="outline">pump</Badge>
                    <Badge variant="outline">fan</Badge>
                    <Badge variant="outline">compressor</Badge>
                    <Badge variant="outline">motor</Badge>
                    <Badge variant="outline">gearbox</Badge>
                    <Badge variant="outline">crane</Badge>
                    <Badge variant="outline">robot</Badge>
                    <Badge variant="outline">cnc_machine</Badge>
                    <Badge variant="outline">welding_machine</Badge>
                    <Badge variant="outline">other</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Control Points */}
          <TabsContent value="controlpoints">
            <Card>
              <CardHeader>
                <CardTitle>ControlPoint (Kontrolní body)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className="bg-blue-600">GET</Badge>
                    <code className="text-sm">/entities/ControlPoint</code>
                  </div>
                  <p className="text-sm text-slate-600 mb-3">Získání všech kontrolních bodů</p>
                  <div className="bg-slate-900 text-green-400 p-4 rounded-lg font-mono text-xs overflow-x-auto">
                    <pre>{`// Odpověď
[
  {
    "id": "cp_123",
    "machine_id": "machine_123",
    "type": "lubrication",
    "number": "1",
    "name": "Hlavní ložisko",
    "description": "Mazání hlavního ložiska lisu",
    "lubricant_type": "SKF LGWA 2",
    "lubricant_amount": 12,
    "interval_hours": 168,
    "nfc_chip_id": "04:5E:3A:2B:1C:90:80",
    "inspection_tasks": null,
    "created_date": "2024-01-15T10:30:00Z",
    "updated_date": "2024-01-15T10:30:00Z",
    "created_by": "user@example.com"
  }
]`}</pre>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold text-slate-900 mb-2">Důležité: NFC čipy</h3>
                  <p className="text-sm text-slate-600 mb-2">
                    Pole <code className="bg-slate-100 px-2 py-1 rounded">nfc_chip_id</code> obsahuje ID NFC čipu pro mobilní aplikaci.
                  </p>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-900">
                    <strong>Použití:</strong> Po přečtení NFC čipu v mobilní aplikaci použijte toto ID pro nalezení správného kontrolního bodu:
                    <div className="bg-slate-900 text-green-400 p-3 rounded mt-2 font-mono text-xs overflow-x-auto">
                      <pre>{`GET ${apiBaseUrl}/entities/ControlPoint?filter={"nfc_chip_id":"04:5E:3A:2B:1C:90:80"}`}</pre>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold text-slate-900 mb-2">Typy kontrolních bodů (type)</h3>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-blue-600">lubrication</Badge>
                      <span className="text-sm text-slate-600">Mazání (obsahuje lubricant_type, lubricant_amount)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className="bg-purple-600">inspection</Badge>
                      <span className="text-sm text-slate-600">Inspekce (obsahuje inspection_tasks)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className="bg-green-600">auto_lubricator</Badge>
                      <span className="text-sm text-slate-600">Automatický mazací systém</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Control Records */}
          <TabsContent value="records">
            <Card>
              <CardHeader>
                <CardTitle>ControlRecord (Záznamy o provedení)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className="bg-blue-600">GET</Badge>
                    <code className="text-sm">/entities/ControlRecord</code>
                  </div>
                  <p className="text-sm text-slate-600 mb-3">Získání všech záznamů</p>
                  <div className="bg-slate-900 text-green-400 p-4 rounded-lg font-mono text-xs overflow-x-auto">
                    <pre>{`// Odpověď
[
  {
    "id": "record_123",
    "control_point_id": "cp_123",
    "record_type": "lubrication",
    "performed_at": "2024-01-20T14:30:00Z",
    "note": "Mazání provedeno dle plánu",
    "photo_url": "https://...",
    "created_date": "2024-01-20T14:30:00Z",
    "updated_date": "2024-01-20T14:30:00Z",
    "created_by": "technik@heistech.cz"
  }
]`}</pre>
                  </div>
                </div>

                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h3 className="font-semibold text-green-900 mb-2">📱 Klíčový endpoint pro mobilní aplikaci</h3>
                  <p className="text-sm text-green-800 mb-3">
                    Po přečtení NFC čipu a provedení mazání/inspekce vytvořte nový záznam:
                  </p>
                  <div className="bg-slate-900 text-green-400 p-4 rounded-lg font-mono text-xs overflow-x-auto">
                    <pre>{`POST ${apiBaseUrl}/entities/ControlRecord
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "control_point_id": "cp_123",
  "record_type": "lubrication",
  "performed_at": "2024-01-20T14:30:00Z",
  "note": "Provedeno v pořádku",
  "photo_url": "https://..."  // volitelné
}`}</pre>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold text-slate-900 mb-2">Typy záznamů (record_type)</h3>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">lubrication</Badge>
                    <Badge variant="outline">inspection</Badge>
                    <Badge variant="outline">lubricator_change</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Issues */}
          <TabsContent value="issues">
            <Card>
              <CardHeader>
                <CardTitle>Issue (Závady)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className="bg-blue-600">GET</Badge>
                    <code className="text-sm">/entities/Issue</code>
                  </div>
                  <p className="text-sm text-slate-600 mb-3">Získání všech závad</p>
                  <div className="bg-slate-900 text-green-400 p-4 rounded-lg font-mono text-xs overflow-x-auto">
                    <pre>{`// Odpověď
[
  {
    "id": "issue_123",
    "control_point_id": "cp_123",
    "description": "Zjištěn mírný únik maziva",
    "photo_url": "https://...",
    "status": "reported",
    "resolved_at": null,
    "resolved_by": null,
    "resolution_note": null,
    "created_date": "2024-01-20T14:30:00Z",
    "updated_date": "2024-01-20T14:30:00Z",
    "created_by": "technik@heistech.cz"
  }
]`}</pre>
                  </div>
                </div>

                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                  <h3 className="font-semibold text-orange-900 mb-2">📱 Nahlášení závady z mobilní aplikace</h3>
                  <div className="bg-slate-900 text-green-400 p-4 rounded-lg font-mono text-xs overflow-x-auto mt-2">
                    <pre>{`POST ${apiBaseUrl}/entities/Issue
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "control_point_id": "cp_123",
  "description": "Popis zjištěné závady",
  "photo_url": "https://...",  // volitelné
  "status": "reported"
}`}</pre>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold text-slate-900 mb-2">Stavy závad (status)</h3>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-orange-600">reported</Badge>
                      <span className="text-sm text-slate-600">Nahlášená (výchozí)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className="bg-green-600">resolved</Badge>
                      <span className="text-sm text-slate-600">Vyřešená</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Příklad kompletního flow pro mobilní aplikaci */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>📱 Typický flow pro mobilní aplikaci s NFC</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center flex-shrink-0 font-bold">
                  1
                </div>
                <div>
                  <h4 className="font-semibold text-slate-900">Přečíst NFC čip</h4>
                  <p className="text-sm text-slate-600">Nativní NFC API v mobilní aplikaci přečte ID čipu (např. "04:5E:3A:2B:1C:90:80")</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center flex-shrink-0 font-bold">
                  2
                </div>
                <div>
                  <h4 className="font-semibold text-slate-900">Najít kontrolní bod</h4>
                  <div className="bg-slate-900 text-green-400 p-3 rounded-lg font-mono text-xs overflow-x-auto mt-2">
                    <pre>{`GET ${apiBaseUrl}/entities/ControlPoint?filter={"nfc_chip_id":"04:5E:3A:2B:1C:90:80"}`}</pre>
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center flex-shrink-0 font-bold">
                  3
                </div>
                <div>
                  <h4 className="font-semibold text-slate-900">Zobrazit detaily</h4>
                  <p className="text-sm text-slate-600">Aplikace zobrazí název bodu, typ maziva, množství, instrukce atd.</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center flex-shrink-0 font-bold">
                  4
                </div>
                <div>
                  <h4 className="font-semibold text-slate-900">Potvrdit provedení</h4>
                  <p className="text-sm text-slate-600 mb-2">Technik provede práci a potvrdí v aplikaci</p>
                  <div className="bg-slate-900 text-green-400 p-3 rounded-lg font-mono text-xs overflow-x-auto">
                    <pre>{`POST ${apiBaseUrl}/entities/ControlRecord
{
  "control_point_id": "cp_123",
  "record_type": "lubrication",
  "performed_at": "2024-01-20T14:30:00Z",
  "note": "Provedeno OK"
}`}</pre>
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-orange-600 text-white rounded-full flex items-center justify-center flex-shrink-0 font-bold">
                  5
                </div>
                <div>
                  <h4 className="font-semibold text-slate-900">Nahlásit závadu (volitelně)</h4>
                  <p className="text-sm text-slate-600 mb-2">Pokud je zjištěna závada</p>
                  <div className="bg-slate-900 text-green-400 p-3 rounded-lg font-mono text-xs overflow-x-auto">
                    <pre>{`POST ${apiBaseUrl}/entities/Issue
{
  "control_point_id": "cp_123",
  "description": "Zjištěn únik maziva",
  "status": "reported"
}`}</pre>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* HTTP Response Codes */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>HTTP Response Codes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <Badge className="bg-green-600">200</Badge>
                <span className="text-sm">OK - Požadavek byl úspěšný</span>
              </div>
              <div className="flex items-center gap-3">
                <Badge className="bg-green-600">201</Badge>
                <span className="text-sm">Created - Záznam byl vytvořen</span>
              </div>
              <div className="flex items-center gap-3">
                <Badge className="bg-yellow-600">400</Badge>
                <span className="text-sm">Bad Request - Neplatná data v požadavku</span>
              </div>
              <div className="flex items-center gap-3">
                <Badge className="bg-yellow-600">401</Badge>
                <span className="text-sm">Unauthorized - Chybí nebo neplatný token</span>
              </div>
              <div className="flex items-center gap-3">
                <Badge className="bg-yellow-600">403</Badge>
                <span className="text-sm">Forbidden - Nemáte oprávnění</span>
              </div>
              <div className="flex items-center gap-3">
                <Badge className="bg-yellow-600">404</Badge>
                <span className="text-sm">Not Found - Záznam nebyl nalezen</span>
              </div>
              <div className="flex items-center gap-3">
                <Badge className="bg-red-600">500</Badge>
                <span className="text-sm">Internal Server Error - Chyba serveru</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Další entity */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Další dostupné entity</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-600 mb-4">
              Stejným způsobem můžete pracovat s dalšími entitami:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <code className="text-sm bg-slate-100 px-2 py-1 rounded">/entities/User</code>
                <p className="text-xs text-slate-500 mt-1">Uživatelé systému</p>
              </div>
              <div>
                <code className="text-sm bg-slate-100 px-2 py-1 rounded">/entities/MaintenanceRecord</code>
                <p className="text-xs text-slate-500 mt-1">Záznamy o údržbě</p>
              </div>
              <div>
                <code className="text-sm bg-slate-100 px-2 py-1 rounded">/entities/PlannedMaintenance</code>
                <p className="text-xs text-slate-500 mt-1">Plánované údržby</p>
              </div>
              <div>
                <code className="text-sm bg-slate-100 px-2 py-1 rounded">/entities/SparePart</code>
                <p className="text-xs text-slate-500 mt-1">Náhradní díly</p>
              </div>
              <div>
                <code className="text-sm bg-slate-100 px-2 py-1 rounded">/entities/Documentation</code>
                <p className="text-xs text-slate-500 mt-1">Dokumentace strojů</p>
              </div>
              <div>
                <code className="text-sm bg-slate-100 px-2 py-1 rounded">/entities/Note</code>
                <p className="text-xs text-slate-500 mt-1">Poznámky</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Kontakt */}
        <Card className="mt-6 border-blue-200 bg-blue-50">
          <CardContent className="p-6">
            <h3 className="font-semibold text-blue-900 mb-2">Potřebujete pomoc?</h3>
            <p className="text-sm text-blue-800">
              Pro získání přístupového tokenu nebo další technickou podporu kontaktujte tým Heistech.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}