import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Code,
  Copy,
  CheckCircle,
  ExternalLink,
  FileText,
  Download,
  BookOpen,
  AlertCircle,
} from "lucide-react";

export default function ApiDocumentation() {
  const [copiedUrl, setCopiedUrl] = useState(null);
  const baseUrl = window.location.origin.replace(/^https?:\/\//, '').split('.')[0];
  const apiBaseUrl = `https://${baseUrl}.base44.com/api`;

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedUrl(id);
    setTimeout(() => setCopiedUrl(null), 2000);
  };

  const downloadDocumentation = (format) => {
    const doc = generateDocumentation(format);
    const blob = new Blob([doc.content], { type: doc.mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = doc.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const generateDocumentation = (format) => {
    if (format === 'json') {
      const jsonDoc = {
        title: "HCMS API Documentation",
        version: "1.0",
        baseUrl: apiBaseUrl,
        authentication: {
          type: "Bearer Token",
          header: "Authorization: Bearer YOUR_TOKEN",
          description: "Získejte token z nastavení uživatele v aplikaci"
        },
        endpoints: {
          companies: {
            list: { method: "GET", path: "/entities/Company" },
            create: { method: "POST", path: "/entities/Company" },
            update: { method: "PUT", path: "/entities/Company/{id}" },
            delete: { method: "DELETE", path: "/entities/Company/{id}" }
          },
          lines: {
            list: { method: "GET", path: "/entities/Line" },
            filter: { method: "GET", path: "/entities/Line?filter[company_id]={company_id}" },
            create: { method: "POST", path: "/entities/Line" },
            update: { method: "PUT", path: "/entities/Line/{id}" },
            delete: { method: "DELETE", path: "/entities/Line/{id}" }
          },
          machines: {
            list: { method: "GET", path: "/entities/Machine" },
            filter: { method: "GET", path: "/entities/Machine?filter[line_id]={line_id}" },
            create: { method: "POST", path: "/entities/Machine" },
            update: { method: "PUT", path: "/entities/Machine/{id}" },
            delete: { method: "DELETE", path: "/entities/Machine/{id}" }
          },
          controlPoints: {
            list: { method: "GET", path: "/entities/ControlPoint" },
            filter: { method: "GET", path: "/entities/ControlPoint?filter[machine_id]={machine_id}" },
            create: { method: "POST", path: "/entities/ControlPoint" },
            update: { method: "PUT", path: "/entities/ControlPoint/{id}" },
            delete: { method: "DELETE", path: "/entities/ControlPoint/{id}" }
          },
          controlRecords: {
            list: { method: "GET", path: "/entities/ControlRecord" },
            create: { method: "POST", path: "/entities/ControlRecord" }
          },
          issues: {
            list: { method: "GET", path: "/entities/Issue" },
            filter: { method: "GET", path: "/entities/Issue?filter[status]=reported" },
            create: { method: "POST", path: "/entities/Issue" },
            update: { method: "PUT", path: "/entities/Issue/{id}" },
            delete: { method: "DELETE", path: "/entities/Issue/{id}" }
          },
          users: {
            list: { method: "GET", path: "/entities/User" },
            me: { method: "GET", path: "/auth/me" },
            update: { method: "PUT", path: "/entities/User/{id}" }
          }
        },
        entities: [
          "Company", "Line", "Machine", "ControlPoint", "ControlRecord", 
          "Issue", "Note", "Documentation", "MaintenanceRecord", "SparePart",
          "VibrationMeasurement", "MachineResponsibility", "PlannedMaintenance",
          "AuditLog", "User"
        ]
      };
      
      return {
        content: JSON.stringify(jsonDoc, null, 2),
        mimeType: 'application/json',
        filename: 'hcms-api-documentation.json'
      };
    } else if (format === 'markdown') {
      const markdown = `# HCMS API Documentation

## Základní informace

**Base URL:** \`${apiBaseUrl}\`  
**Verze:** 1.0  
**Autentizace:** Bearer Token

## Autentizace

Všechny požadavky musí obsahovat autentizační token v hlavičce:

\`\`\`
Authorization: Bearer YOUR_TOKEN
\`\`\`

Token získáte v nastavení uživatele v aplikaci HCMS.

## Formát dat

API používá JSON formát pro všechny požadavky a odpovědi.

**Content-Type:** \`application/json\`

## Endpointy

### Podniky (Companies)

#### Získat seznam podniků
\`\`\`
GET ${apiBaseUrl}/entities/Company
\`\`\`

#### Vytvořit podnik
\`\`\`
POST ${apiBaseUrl}/entities/Company
Content-Type: application/json

{
  "name": "Název podniku",
  "address": "Adresa",
  "contact_person": "Kontaktní osoba",
  "email": "email@example.com",
  "phone": "+420123456789",
  "is_active": true
}
\`\`\`

#### Aktualizovat podnik
\`\`\`
PUT ${apiBaseUrl}/entities/Company/{id}
Content-Type: application/json

{
  "name": "Nový název"
}
\`\`\`

#### Smazat podnik
\`\`\`
DELETE ${apiBaseUrl}/entities/Company/{id}
\`\`\`

---

### Linky (Lines)

#### Získat linky podniku
\`\`\`
GET ${apiBaseUrl}/entities/Line?filter[company_id]={company_id}
\`\`\`

#### Vytvořit linku
\`\`\`
POST ${apiBaseUrl}/entities/Line
Content-Type: application/json

{
  "company_id": "company_id",
  "name": "Název linky",
  "description": "Popis",
  "order_index": 1
}
\`\`\`

---

### Stroje (Machines)

#### Získat stroje linky
\`\`\`
GET ${apiBaseUrl}/entities/Machine?filter[line_id]={line_id}
\`\`\`

#### Vytvořit stroj
\`\`\`
POST ${apiBaseUrl}/entities/Machine
Content-Type: application/json

{
  "line_id": "line_id",
  "name": "Název stroje",
  "description": "Popis",
  "machine_type": "press",
  "inventory_number": "INV-001",
  "location": "Hala A",
  "order_index": 1
}
\`\`\`

---

### Kontrolní body (ControlPoints)

#### Získat kontrolní body stroje
\`\`\`
GET ${apiBaseUrl}/entities/ControlPoint?filter[machine_id]={machine_id}
\`\`\`

#### Vytvořit kontrolní bod
\`\`\`
POST ${apiBaseUrl}/entities/ControlPoint
Content-Type: application/json

{
  "machine_id": "machine_id",
  "type": "lubrication",
  "name": "Název bodu",
  "lubricant_type": "SKF LGWA 2",
  "lubricant_amount": 10,
  "interval_hours": 168,
  "nfc_chip_id": "04:23:45:67:89:AB:CD"
}
\`\`\`

---

### Záznamy kontrol (ControlRecords)

#### Vytvořit záznam kontroly/mazání
\`\`\`
POST ${apiBaseUrl}/entities/ControlRecord
Content-Type: application/json

{
  "control_point_id": "control_point_id",
  "record_type": "lubrication",
  "performed_at": "2025-01-15T10:30:00Z",
  "note": "Mazání provedeno dle plánu"
}
\`\`\`

---

### Závady (Issues)

#### Získat aktivní závady
\`\`\`
GET ${apiBaseUrl}/entities/Issue?filter[status]=reported
\`\`\`

#### Nahlásit závadu
\`\`\`
POST ${apiBaseUrl}/entities/Issue
Content-Type: application/json

{
  "control_point_id": "control_point_id",
  "description": "Popis závady",
  "photo_url": "https://...",
  "status": "reported"
}
\`\`\`

#### Vyřešit závadu
\`\`\`
PUT ${apiBaseUrl}/entities/Issue/{id}
Content-Type: application/json

{
  "status": "resolved",
  "resolved_at": "2025-01-15T14:00:00Z",
  "resolved_by": "email@example.com",
  "resolution_note": "Závada vyřešena"
}
\`\`\`

---

### Uživatelé (Users)

#### Získat informace o aktuálním uživateli
\`\`\`
GET ${apiBaseUrl}/auth/me
\`\`\`

**Odpověď:**
\`\`\`json
{
  "id": "user_id",
  "email": "user@example.com",
  "full_name": "Jan Novák",
  "role": "admin",
  "user_type": "manager",
  "company_id": "company_id",
  "last_active_at": "2025-01-15T10:30:00Z"
}
\`\`\`

#### Aktualizovat aktivitu uživatele
\`\`\`
PUT ${apiBaseUrl}/auth/me
Content-Type: application/json

{
  "last_active_at": "2025-01-15T10:30:00Z"
}
\`\`\`

---

## HTTP Status kódy

- **200 OK** - Požadavek byl úspěšný
- **201 Created** - Entita byla vytvořena
- **400 Bad Request** - Chybný formát požadavku
- **401 Unauthorized** - Chybí nebo je neplatný token
- **403 Forbidden** - Nedostatečná oprávnění
- **404 Not Found** - Entita nebyla nalezena
- **500 Internal Server Error** - Chyba serveru

---

## Další entity

Systém podporuje následující další entity:

- **Note** - Poznámky ke kontrolním bodům
- **Documentation** - Fotodokumentace
- **MaintenanceRecord** - Záznamy údržby
- **SparePart** - Náhradní díly
- **VibrationMeasurement** - Měření vibrací
- **MachineResponsibility** - Odpovědnosti za stroje
- **PlannedMaintenance** - Plánovaná údržba
- **AuditLog** - Audit log změn

Pro detailní schémata těchto entit použijte endpointy výše nebo kontaktujte podporu.

---

## Příklad - NFC workflow

### 1. Uživatel naskenuje NFC čip
Mobilní aplikace přečte \`nfc_chip_id\` z čipu.

### 2. Najít kontrolní bod podle NFC
\`\`\`
GET ${apiBaseUrl}/entities/ControlPoint?filter[nfc_chip_id]={nfc_chip_id}
\`\`\`

### 3. Potvrdit provedení kontroly
\`\`\`
POST ${apiBaseUrl}/entities/ControlRecord
Content-Type: application/json

{
  "control_point_id": "control_point_id",
  "record_type": "lubrication",
  "performed_at": "2025-01-15T10:30:00Z"
}
\`\`\`

### 4. Aktualizovat aktivitu uživatele
\`\`\`
PUT ${apiBaseUrl}/auth/me
Content-Type: application/json

{
  "last_active_at": "2025-01-15T10:30:00Z"
}
\`\`\`

---

Wygenerowano: ${new Date().toLocaleString('cs-CZ')}
`;
      
      return {
        content: markdown,
        mimeType: 'text/markdown',
        filename: 'hcms-api-documentation.md'
      };
    }
  };

  return (
    <div className="p-4 md:p-8 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 mb-2 flex items-center gap-3">
                <BookOpen className="w-8 h-8 text-blue-600" />
                API Dokumentace
              </h1>
              <p className="text-slate-600">
                REST API pro integraci s HCMS systémem
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => downloadDocumentation('json')}
                variant="outline"
                className="gap-2"
              >
                <Download className="w-4 h-4" />
                Stáhnout JSON
              </Button>
              <Button
                onClick={() => downloadDocumentation('markdown')}
                className="gap-2 bg-gradient-to-r from-blue-600 to-blue-700"
              >
                <Download className="w-4 h-4" />
                Stáhnout Markdown
              </Button>
            </div>
          </div>
        </div>

        <Card className="mb-6 border-blue-200 bg-blue-50">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-blue-900 font-medium mb-1">
                  Base URL vašeho API:
                </p>
                <div className="flex items-center gap-2 bg-white rounded-lg p-3 border border-blue-200">
                  <code className="text-sm font-mono text-blue-900 flex-1">
                    {apiBaseUrl}
                  </code>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => copyToClipboard(apiBaseUrl, 'baseUrl')}
                    className="flex-shrink-0"
                  >
                    {copiedUrl === 'baseUrl' ? (
                      <CheckCircle className="w-4 h-4 text-green-600" />
                    ) : (
                      <Copy className="w-4 h-4 text-slate-600" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="basics" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 lg:grid-cols-8 bg-white shadow-sm">
            <TabsTrigger value="basics">Základy</TabsTrigger>
            <TabsTrigger value="companies">Podniky</TabsTrigger>
            <TabsTrigger value="lines">Linky</TabsTrigger>
            <TabsTrigger value="machines">Stroje</TabsTrigger>
            <TabsTrigger value="points">Body</TabsTrigger>
            <TabsTrigger value="records">Záznamy</TabsTrigger>
            <TabsTrigger value="issues">Závady</TabsTrigger>
            <TabsTrigger value="users">Uživatelé</TabsTrigger>
          </TabsList>

          {/* Základy API */}
          <TabsContent value="basics">
            <div className="space-y-6">
              <Card className="shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Code className="w-5 h-5" />
                    Autentizace
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-slate-600">
                    Všechny požadavky na API musí obsahovat autentizační token v hlavičce:
                  </p>
                  <div className="bg-slate-900 text-slate-100 rounded-lg p-4 font-mono text-sm">
                    <div className="flex items-start justify-between gap-4">
                      <pre className="flex-1 overflow-x-auto">Authorization: Bearer YOUR_TOKEN</pre>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => copyToClipboard('Authorization: Bearer YOUR_TOKEN', 'authHeader')}
                        className="flex-shrink-0 text-slate-400 hover:text-white"
                      >
                        {copiedUrl === 'authHeader' ? (
                          <CheckCircle className="w-4 h-4 text-green-400" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <p className="text-sm text-amber-900">
                      <strong>Jak získat token:</strong> Token najdete v nastavení uživatele v aplikaci HCMS.
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    Formát dat
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-slate-600">
                    API používá JSON formát pro všechny požadavky a odpovědi.
                  </p>
                  <div className="bg-slate-900 text-slate-100 rounded-lg p-4 font-mono text-sm">
                    <div className="flex items-start justify-between gap-4">
                      <pre className="flex-1">Content-Type: application/json</pre>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => copyToClipboard('Content-Type: application/json', 'contentType')}
                        className="flex-shrink-0 text-slate-400 hover:text-white"
                      >
                        {copiedUrl === 'contentType' ? (
                          <CheckCircle className="w-4 h-4 text-green-400" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-lg">
                <CardHeader>
                  <CardTitle>HTTP Status kódy</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {[
                      { code: "200", label: "OK", desc: "Požadavek byl úspěšný", color: "text-green-600" },
                      { code: "201", label: "Created", desc: "Entita byla vytvořena", color: "text-green-600" },
                      { code: "400", label: "Bad Request", desc: "Chybný formát požadavku", color: "text-orange-600" },
                      { code: "401", label: "Unauthorized", desc: "Chybí nebo je neplatný token", color: "text-red-600" },
                      { code: "403", label: "Forbidden", desc: "Nedostatečná oprávnění", color: "text-red-600" },
                      { code: "404", label: "Not Found", desc: "Entita nebyla nalezena", color: "text-orange-600" },
                      { code: "500", label: "Internal Server Error", desc: "Chyba serveru", color: "text-red-600" },
                    ].map((status) => (
                      <div key={status.code} className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
                        <Badge className={`${status.color} bg-transparent border-2 font-mono`}>
                          {status.code}
                        </Badge>
                        <div>
                          <p className="font-semibold text-slate-900">{status.label}</p>
                          <p className="text-sm text-slate-600">{status.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-lg border-2 border-purple-200 bg-purple-50">
                <CardHeader>
                  <CardTitle className="text-purple-900">Dostupné entity</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                    {[
                      "Company", "Line", "Machine", "ControlPoint", "ControlRecord",
                      "Issue", "Note", "Documentation", "MaintenanceRecord", "SparePart",
                      "VibrationMeasurement", "MachineResponsibility", "PlannedMaintenance",
                      "AuditLog", "User"
                    ].map((entity) => (
                      <Badge key={entity} variant="outline" className="justify-center">
                        {entity}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Podniky */}
          <TabsContent value="companies">
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle>Podniky (Companies)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h3 className="font-semibold text-lg mb-2 flex items-center gap-2">
                    <Badge>GET</Badge>
                    Získat seznam podniků
                  </h3>
                  <div className="bg-slate-900 text-slate-100 rounded-lg p-4 font-mono text-sm mb-3">
                    <div className="flex items-start justify-between gap-4">
                      <pre className="flex-1 overflow-x-auto">{`GET ${apiBaseUrl}/entities/Company`}</pre>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => copyToClipboard(`GET ${apiBaseUrl}/entities/Company`, 'companies-list')}
                        className="flex-shrink-0 text-slate-400 hover:text-white"
                      >
                        {copiedUrl === 'companies-list' ? (
                          <CheckCircle className="w-4 h-4 text-green-400" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                  <p className="text-sm text-slate-600 mb-2">Příklad odpovědi:</p>
                  <div className="bg-slate-900 text-slate-100 rounded-lg p-4 font-mono text-sm overflow-x-auto">
                    <pre>{`[
  {
    "id": "company_id",
    "name": "Demo podnik",
    "address": "Průmyslová 1, Praha",
    "contact_person": "Jan Novák",
    "email": "kontakt@example.com",
    "phone": "+420123456789",
    "is_active": true,
    "created_date": "2025-01-01T10:00:00Z"
  }
]`}</pre>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold text-lg mb-2 flex items-center gap-2">
                    <Badge className="bg-green-600">POST</Badge>
                    Vytvořit podnik
                  </h3>
                  <div className="bg-slate-900 text-slate-100 rounded-lg p-4 font-mono text-sm mb-3">
                    <div className="flex items-start justify-between gap-4">
                      <pre className="flex-1 overflow-x-auto">{`POST ${apiBaseUrl}/entities/Company`}</pre>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => copyToClipboard(`POST ${apiBaseUrl}/entities/Company`, 'companies-create')}
                        className="flex-shrink-0 text-slate-400 hover:text-white"
                      >
                        {copiedUrl === 'companies-create' ? (
                          <CheckCircle className="w-4 h-4 text-green-400" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                  <p className="text-sm text-slate-600 mb-2">Tělo požadavku:</p>
                  <div className="bg-slate-900 text-slate-100 rounded-lg p-4 font-mono text-sm overflow-x-auto">
                    <pre>{`{
  "name": "Název podniku",
  "address": "Adresa",
  "contact_person": "Kontaktní osoba",
  "email": "email@example.com",
  "phone": "+420123456789",
  "is_active": true
}`}</pre>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold text-lg mb-2 flex items-center gap-2">
                    <Badge className="bg-blue-600">PUT</Badge>
                    Aktualizovat podnik
                  </h3>
                  <div className="bg-slate-900 text-slate-100 rounded-lg p-4 font-mono text-sm">
                    <div className="flex items-start justify-between gap-4">
                      <pre className="flex-1 overflow-x-auto">{`PUT ${apiBaseUrl}/entities/Company/{id}`}</pre>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => copyToClipboard(`PUT ${apiBaseUrl}/entities/Company/{id}`, 'companies-update')}
                        className="flex-shrink-0 text-slate-400 hover:text-white"
                      >
                        {copiedUrl === 'companies-update' ? (
                          <CheckCircle className="w-4 h-4 text-green-400" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold text-lg mb-2 flex items-center gap-2">
                    <Badge className="bg-red-600">DELETE</Badge>
                    Smazat podnik
                  </h3>
                  <div className="bg-slate-900 text-slate-100 rounded-lg p-4 font-mono text-sm">
                    <div className="flex items-start justify-between gap-4">
                      <pre className="flex-1 overflow-x-auto">{`DELETE ${apiBaseUrl}/entities/Company/{id}`}</pre>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => copyToClipboard(`DELETE ${apiBaseUrl}/entities/Company/{id}`, 'companies-delete')}
                        className="flex-shrink-0 text-slate-400 hover:text-white"
                      >
                        {copiedUrl === 'companies-delete' ? (
                          <CheckCircle className="w-4 h-4 text-green-400" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Linky */}
          <TabsContent value="lines">
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle>Linky (Lines)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h3 className="font-semibold text-lg mb-2 flex items-center gap-2">
                    <Badge>GET</Badge>
                    Získat linky podniku
                  </h3>
                  <div className="bg-slate-900 text-slate-100 rounded-lg p-4 font-mono text-sm">
                    <div className="flex items-start justify-between gap-4">
                      <pre className="flex-1 overflow-x-auto">{`GET ${apiBaseUrl}/entities/Line?filter[company_id]={company_id}`}</pre>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => copyToClipboard(`GET ${apiBaseUrl}/entities/Line?filter[company_id]={company_id}`, 'lines-filter')}
                        className="flex-shrink-0 text-slate-400 hover:text-white"
                      >
                        {copiedUrl === 'lines-filter' ? (
                          <CheckCircle className="w-4 h-4 text-green-400" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold text-lg mb-2 flex items-center gap-2">
                    <Badge className="bg-green-600">POST</Badge>
                    Vytvořit linku
                  </h3>
                  <div className="bg-slate-900 text-slate-100 rounded-lg p-4 font-mono text-sm mb-3">
                    <div className="flex items-start justify-between gap-4">
                      <pre className="flex-1 overflow-x-auto">{`POST ${apiBaseUrl}/entities/Line`}</pre>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => copyToClipboard(`POST ${apiBaseUrl}/entities/Line`, 'lines-create')}
                        className="flex-shrink-0 text-slate-400 hover:text-white"
                      >
                        {copiedUrl === 'lines-create' ? (
                          <CheckCircle className="w-4 h-4 text-green-400" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                  <p className="text-sm text-slate-600 mb-2">Tělo požadavku:</p>
                  <div className="bg-slate-900 text-slate-100 rounded-lg p-4 font-mono text-sm overflow-x-auto">
                    <pre>{`{
  "company_id": "company_id",
  "name": "Linka 1",
  "description": "Hlavní výrobní linka",
  "order_index": 1
}`}</pre>
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-900">
                    <strong>Atributy:</strong> company_id (povinné), name (povinné), description, order_index
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Stroje */}
          <TabsContent value="machines">
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle>Stroje (Machines)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h3 className="font-semibold text-lg mb-2 flex items-center gap-2">
                    <Badge>GET</Badge>
                    Získat stroje linky
                  </h3>
                  <div className="bg-slate-900 text-slate-100 rounded-lg p-4 font-mono text-sm">
                    <div className="flex items-start justify-between gap-4">
                      <pre className="flex-1 overflow-x-auto">{`GET ${apiBaseUrl}/entities/Machine?filter[line_id]={line_id}`}</pre>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => copyToClipboard(`GET ${apiBaseUrl}/entities/Machine?filter[line_id]={line_id}`, 'machines-filter')}
                        className="flex-shrink-0 text-slate-400 hover:text-white"
                      >
                        {copiedUrl === 'machines-filter' ? (
                          <CheckCircle className="w-4 h-4 text-green-400" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold text-lg mb-2 flex items-center gap-2">
                    <Badge className="bg-green-600">POST</Badge>
                    Vytvořit stroj
                  </h3>
                  <div className="bg-slate-900 text-slate-100 rounded-lg p-4 font-mono text-sm mb-3">
                    <div className="flex items-start justify-between gap-4">
                      <pre className="flex-1 overflow-x-auto">{`POST ${apiBaseUrl}/entities/Machine`}</pre>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => copyToClipboard(`POST ${apiBaseUrl}/entities/Machine`, 'machines-create')}
                        className="flex-shrink-0 text-slate-400 hover:text-white"
                      >
                        {copiedUrl === 'machines-create' ? (
                          <CheckCircle className="w-4 h-4 text-green-400" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                  <p className="text-sm text-slate-600 mb-2">Tělo požadavku:</p>
                  <div className="bg-slate-900 text-slate-100 rounded-lg p-4 font-mono text-sm overflow-x-auto">
                    <pre>{`{
  "line_id": "line_id",
  "name": "Lis LH-500",
  "description": "Hydraulický lis 500t",
  "machine_type": "press",
  "inventory_number": "INV-001",
  "location": "Hala A, Sekce 1",
  "order_index": 1
}`}</pre>
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-900 mb-2">
                    <strong>Typy strojů (machine_type):</strong>
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {["press", "conveyor", "pump", "fan", "compressor", "motor", "gearbox", "crane", "robot", "cnc_machine", "welding_machine", "other"].map(type => (
                      <Badge key={type} variant="outline">{type}</Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Kontrolní body */}
          <TabsContent value="points">
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle>Kontrolní body (ControlPoints)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h3 className="font-semibold text-lg mb-2 flex items-center gap-2">
                    <Badge>GET</Badge>
                    Získat kontrolní body stroje
                  </h3>
                  <div className="bg-slate-900 text-slate-100 rounded-lg p-4 font-mono text-sm">
                    <div className="flex items-start justify-between gap-4">
                      <pre className="flex-1 overflow-x-auto">{`GET ${apiBaseUrl}/entities/ControlPoint?filter[machine_id]={machine_id}`}</pre>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => copyToClipboard(`GET ${apiBaseUrl}/entities/ControlPoint?filter[machine_id]={machine_id}`, 'points-filter')}
                        className="flex-shrink-0 text-slate-400 hover:text-white"
                      >
                        {copiedUrl === 'points-filter' ? (
                          <CheckCircle className="w-4 h-4 text-green-400" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold text-lg mb-2 flex items-center gap-2">
                    <Badge>GET</Badge>
                    Najít bod podle NFC čipu
                  </h3>
                  <div className="bg-slate-900 text-slate-100 rounded-lg p-4 font-mono text-sm">
                    <div className="flex items-start justify-between gap-4">
                      <pre className="flex-1 overflow-x-auto">{`GET ${apiBaseUrl}/entities/ControlPoint?filter[nfc_chip_id]={nfc_chip_id}`}</pre>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => copyToClipboard(`GET ${apiBaseUrl}/entities/ControlPoint?filter[nfc_chip_id]={nfc_chip_id}`, 'points-nfc')}
                        className="flex-shrink-0 text-slate-400 hover:text-white"
                      >
                        {copiedUrl === 'points-nfc' ? (
                          <CheckCircle className="w-4 h-4 text-green-400" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold text-lg mb-2 flex items-center gap-2">
                    <Badge className="bg-green-600">POST</Badge>
                    Vytvořit kontrolní bod
                  </h3>
                  <div className="bg-slate-900 text-slate-100 rounded-lg p-4 font-mono text-sm mb-3">
                    <div className="flex items-start justify-between gap-4">
                      <pre className="flex-1 overflow-x-auto">{`POST ${apiBaseUrl}/entities/ControlPoint`}</pre>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => copyToClipboard(`POST ${apiBaseUrl}/entities/ControlPoint`, 'points-create')}
                        className="flex-shrink-0 text-slate-400 hover:text-white"
                      >
                        {copiedUrl === 'points-create' ? (
                          <CheckCircle className="w-4 h-4 text-green-400" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                  <p className="text-sm text-slate-600 mb-2">Tělo požadavku (mazací bod):</p>
                  <div className="bg-slate-900 text-slate-100 rounded-lg p-4 font-mono text-sm overflow-x-auto">
                    <pre>{`{
  "machine_id": "machine_id",
  "type": "lubrication",
  "name": "Hlavní ložisko",
  "description": "Mazání hlavního ložiska",
  "lubricant_type": "SKF LGWA 2",
  "lubricant_amount": 10,
  "interval_hours": 168,
  "nfc_chip_id": "04:23:45:67:89:AB:CD"
}`}</pre>
                  </div>
                  <p className="text-sm text-slate-600 mb-2 mt-4">Tělo požadavku (inspekční bod):</p>
                  <div className="bg-slate-900 text-slate-100 rounded-lg p-4 font-mono text-sm overflow-x-auto">
                    <pre>{`{
  "machine_id": "machine_id",
  "type": "inspection",
  "name": "Kontrola úniku oleje",
  "inspection_tasks": "Zkontrolovat těsnost systému",
  "interval_hours": 168,
  "nfc_chip_id": "04:23:45:67:89:AB:CD"
}`}</pre>
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-900">
                    <strong>Typy bodů:</strong> lubrication (mazání), inspection (inspekce), auto_lubricator (automatický mazací systém)
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Záznamy kontrol */}
          <TabsContent value="records">
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle>Záznamy kontrol (ControlRecords)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h3 className="font-semibold text-lg mb-2 flex items-center gap-2">
                    <Badge className="bg-green-600">POST</Badge>
                    Vytvořit záznam kontroly/mazání
                  </h3>
                  <div className="bg-slate-900 text-slate-100 rounded-lg p-4 font-mono text-sm mb-3">
                    <div className="flex items-start justify-between gap-4">
                      <pre className="flex-1 overflow-x-auto">{`POST ${apiBaseUrl}/entities/ControlRecord`}</pre>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => copyToClipboard(`POST ${apiBaseUrl}/entities/ControlRecord`, 'records-create')}
                        className="flex-shrink-0 text-slate-400 hover:text-white"
                      >
                        {copiedUrl === 'records-create' ? (
                          <CheckCircle className="w-4 h-4 text-green-400" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                  <p className="text-sm text-slate-600 mb-2">Tělo požadavku:</p>
                  <div className="bg-slate-900 text-slate-100 rounded-lg p-4 font-mono text-sm overflow-x-auto">
                    <pre>{`{
  "control_point_id": "control_point_id",
  "record_type": "lubrication",
  "performed_at": "2025-01-15T10:30:00Z",
  "note": "Mazání provedeno dle plánu"
}`}</pre>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold text-lg mb-2 flex items-center gap-2">
                    <Badge>GET</Badge>
                    Získat záznamy kontrolního bodu
                  </h3>
                  <div className="bg-slate-900 text-slate-100 rounded-lg p-4 font-mono text-sm">
                    <div className="flex items-start justify-between gap-4">
                      <pre className="flex-1 overflow-x-auto">{`GET ${apiBaseUrl}/entities/ControlRecord?filter[control_point_id]={control_point_id}`}</pre>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => copyToClipboard(`GET ${apiBaseUrl}/entities/ControlRecord?filter[control_point_id]={control_point_id}`, 'records-filter')}
                        className="flex-shrink-0 text-slate-400 hover:text-white"
                      >
                        {copiedUrl === 'records-filter' ? (
                          <CheckCircle className="w-4 h-4 text-green-400" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <p className="text-sm text-amber-900">
                    <strong>Poznámka:</strong> Pole <code>performed_at</code> je ve formátu ISO 8601 (např. 2025-01-15T10:30:00Z). 
                    Pokud není zadáno, automaticky se použije aktuální čas.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Závady */}
          <TabsContent value="issues">
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle>Závady (Issues)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h3 className="font-semibold text-lg mb-2 flex items-center gap-2">
                    <Badge>GET</Badge>
                    Získat aktivní závady
                  </h3>
                  <div className="bg-slate-900 text-slate-100 rounded-lg p-4 font-mono text-sm">
                    <div className="flex items-start justify-between gap-4">
                      <pre className="flex-1 overflow-x-auto">{`GET ${apiBaseUrl}/entities/Issue?filter[status]=reported`}</pre>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => copyToClipboard(`GET ${apiBaseUrl}/entities/Issue?filter[status]=reported`, 'issues-reported')}
                        className="flex-shrink-0 text-slate-400 hover:text-white"
                      >
                        {copiedUrl === 'issues-reported' ? (
                          <CheckCircle className="w-4 h-4 text-green-400" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold text-lg mb-2 flex items-center gap-2">
                    <Badge className="bg-green-600">POST</Badge>
                    Nahlásit závadu
                  </h3>
                  <div className="bg-slate-900 text-slate-100 rounded-lg p-4 font-mono text-sm mb-3">
                    <div className="flex items-start justify-between gap-4">
                      <pre className="flex-1 overflow-x-auto">{`POST ${apiBaseUrl}/entities/Issue`}</pre>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => copyToClipboard(`POST ${apiBaseUrl}/entities/Issue`, 'issues-create')}
                        className="flex-shrink-0 text-slate-400 hover:text-white"
                      >
                        {copiedUrl === 'issues-create' ? (
                          <CheckCircle className="w-4 h-4 text-green-400" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                  <p className="text-sm text-slate-600 mb-2">Tělo požadavku:</p>
                  <div className="bg-slate-900 text-slate-100 rounded-lg p-4 font-mono text-sm overflow-x-auto">
                    <pre>{`{
  "control_point_id": "control_point_id",
  "description": "Zjištěn únik maziva z těsnění",
  "photo_url": "https://...",
  "status": "reported"
}`}</pre>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold text-lg mb-2 flex items-center gap-2">
                    <Badge className="bg-blue-600">PUT</Badge>
                    Vyřešit závadu
                  </h3>
                  <div className="bg-slate-900 text-slate-100 rounded-lg p-4 font-mono text-sm mb-3">
                    <div className="flex items-start justify-between gap-4">
                      <pre className="flex-1 overflow-x-auto">{`PUT ${apiBaseUrl}/entities/Issue/{id}`}</pre>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => copyToClipboard(`PUT ${apiBaseUrl}/entities/Issue/{id}`, 'issues-resolve')}
                        className="flex-shrink-0 text-slate-400 hover:text-white"
                      >
                        {copiedUrl === 'issues-resolve' ? (
                          <CheckCircle className="w-4 h-4 text-green-400" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                  <p className="text-sm text-slate-600 mb-2">Tělo požadavku:</p>
                  <div className="bg-slate-900 text-slate-100 rounded-lg p-4 font-mono text-sm overflow-x-auto">
                    <pre>{`{
  "status": "resolved",
  "resolved_at": "2025-01-15T14:00:00Z",
  "resolved_by": "email@example.com",
  "resolution_note": "Závada vyřešena výměnou těsnění"
}`}</pre>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Uživatelé */}
          <TabsContent value="users">
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle>Uživatelé (Users)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h3 className="font-semibold text-lg mb-2 flex items-center gap-2">
                    <Badge>GET</Badge>
                    Získat informace o aktuálním uživateli
                  </h3>
                  <div className="bg-slate-900 text-slate-100 rounded-lg p-4 font-mono text-sm mb-3">
                    <div className="flex items-start justify-between gap-4">
                      <pre className="flex-1 overflow-x-auto">{`GET ${apiBaseUrl}/auth/me`}</pre>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => copyToClipboard(`GET ${apiBaseUrl}/auth/me`, 'users-me')}
                        className="flex-shrink-0 text-slate-400 hover:text-white"
                      >
                        {copiedUrl === 'users-me' ? (
                          <CheckCircle className="w-4 h-4 text-green-400" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                  <p className="text-sm text-slate-600 mb-2">Příklad odpovědi:</p>
                  <div className="bg-slate-900 text-slate-100 rounded-lg p-4 font-mono text-sm overflow-x-auto">
                    <pre>{`{
  "id": "user_id",
  "email": "user@example.com",
  "full_name": "Jan Novák",
  "role": "admin",
  "user_type": "manager",
  "company_id": "company_id",
  "phone": "+420123456789",
  "custom_display_name": "Jan N.",
  "last_active_at": "2025-01-15T10:30:00Z",
  "created_date": "2025-01-01T10:00:00Z"
}`}</pre>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold text-lg mb-2 flex items-center gap-2">
                    <Badge className="bg-blue-600">PUT</Badge>
                    Aktualizovat aktivitu uživatele
                  </h3>
                  <div className="bg-slate-900 text-slate-100 rounded-lg p-4 font-mono text-sm mb-3">
                    <div className="flex items-start justify-between gap-4">
                      <pre className="flex-1 overflow-x-auto">{`PUT ${apiBaseUrl}/auth/me`}</pre>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => copyToClipboard(`PUT ${apiBaseUrl}/auth/me`, 'users-update-activity')}
                        className="flex-shrink-0 text-slate-400 hover:text-white"
                      >
                        {copiedUrl === 'users-update-activity' ? (
                          <CheckCircle className="w-4 h-4 text-green-400" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                  <p className="text-sm text-slate-600 mb-2">Tělo požadavku:</p>
                  <div className="bg-slate-900 text-slate-100 rounded-lg p-4 font-mono text-sm overflow-x-auto">
                    <pre>{`{
  "last_active_at": "2025-01-15T10:30:00Z"
}`}</pre>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold text-lg mb-2 flex items-center gap-2">
                    <Badge>GET</Badge>
                    Získat seznam všech uživatelů
                  </h3>
                  <div className="bg-slate-900 text-slate-100 rounded-lg p-4 font-mono text-sm">
                    <div className="flex items-start justify-between gap-4">
                      <pre className="flex-1 overflow-x-auto">{`GET ${apiBaseUrl}/entities/User`}</pre>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => copyToClipboard(`GET ${apiBaseUrl}/entities/User`, 'users-list')}
                        className="flex-shrink-0 text-slate-400 hover:text-white"
                      >
                        {copiedUrl === 'users-list' ? (
                          <CheckCircle className="w-4 h-4 text-green-400" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mt-3">
                    <p className="text-sm text-amber-900">
                      <strong>Poznámka:</strong> Seznam uživatelů je dostupný pouze pro administrátory. 
                      Běžní uživatelé vidí pouze svoje údaje přes endpoint <code>/auth/me</code>.
                    </p>
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-900 mb-2">
                    <strong>Atributy uživatele:</strong>
                  </p>
                  <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                    <li><code>user_type</code>: superAdmin, admin, manager, technician</li>
                    <li><code>company_id</code>: ID přiřazeného podniku</li>
                    <li><code>assigned_company_ids</code>: pole ID podniků (pouze pro admin)</li>
                    <li><code>custom_display_name</code>: vlastní zobrazované jméno</li>
                    <li><code>last_active_at</code>: poslední aktivita v systému (ISO 8601)</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* NFC Workflow */}
        <Card className="shadow-lg border-2 border-green-200 bg-green-50">
          <CardHeader>
            <CardTitle className="text-green-900 flex items-center gap-2">
              <Activity className="w-5 h-5" />
              Příklad: NFC Workflow pro mobilní aplikaci
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-white rounded-lg p-4 border border-green-200">
              <h4 className="font-semibold text-slate-900 mb-2">1. Uživatel naskenuje NFC čip</h4>
              <p className="text-sm text-slate-600">
                Mobilní aplikace přečte <code>nfc_chip_id</code> z NFC čipu pomocí nativního API.
              </p>
            </div>

            <div className="bg-white rounded-lg p-4 border border-green-200">
              <h4 className="font-semibold text-slate-900 mb-2">2. Najít kontrolní bod podle NFC</h4>
              <div className="bg-slate-900 text-slate-100 rounded-lg p-3 font-mono text-xs mt-2 overflow-x-auto">
                <pre>{`GET ${apiBaseUrl}/entities/ControlPoint?filter[nfc_chip_id]={nfc_chip_id}`}</pre>
              </div>
            </div>

            <div className="bg-white rounded-lg p-4 border border-green-200">
              <h4 className="font-semibold text-slate-900 mb-2">3. Potvrdit provedení kontroly</h4>
              <div className="bg-slate-900 text-slate-100 rounded-lg p-3 font-mono text-xs mt-2 overflow-x-auto">
                <pre>{`POST ${apiBaseUrl}/entities/ControlRecord
{
  "control_point_id": "control_point_id",
  "record_type": "lubrication",
  "performed_at": "2025-01-15T10:30:00Z"
}`}</pre>
              </div>
            </div>

            <div className="bg-white rounded-lg p-4 border border-green-200">
              <h4 className="font-semibold text-slate-900 mb-2">4. Aktualizovat aktivitu uživatele</h4>
              <div className="bg-slate-900 text-slate-100 rounded-lg p-3 font-mono text-xs mt-2 overflow-x-auto">
                <pre>{`PUT ${apiBaseUrl}/auth/me
{
  "last_active_at": "2025-01-15T10:30:00Z"
}`}</pre>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}