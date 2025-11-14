import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Copy,
  Check,
  Code,
  Database,
  Key,
  Link as LinkIcon,
  FileText,
  Zap,
  Shield,
  Activity,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

export default function ApiDocumentation() {
  const [copiedCode, setCopiedCode] = useState(null);
  const [expandedSections, setExpandedSections] = useState({});

  const copyToClipboard = (code, id) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(id);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const toggleSection = (sectionId) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }));
  };

  const entities = [
    {
      name: "Company",
      nameCz: "Podniky",
      description: "Správa podniků v systému",
      icon: "🏢",
      fields: [
        { name: "name", type: "string", required: true, description: "Název podniku" },
        { name: "address", type: "string", description: "Adresa" },
        { name: "contact_person", type: "string", description: "Kontaktní osoba" },
        { name: "email", type: "string", format: "email", description: "Email" },
        { name: "phone", type: "string", description: "Telefon" },
        { name: "is_active", type: "boolean", default: true, description: "Aktivní" }
      ]
    },
    {
      name: "Line",
      nameCz: "Výrobní linky",
      description: "Správa výrobních linek",
      icon: "🏭",
      fields: [
        { name: "company_id", type: "string", required: true, description: "ID podniku" },
        { name: "name", type: "string", required: true, description: "Název linky" },
        { name: "description", type: "string", description: "Popis" },
        { name: "order_index", type: "number", default: 0, description: "Pořadí" }
      ]
    },
    {
      name: "Machine",
      nameCz: "Stroje",
      description: "Správa strojů a zařízení",
      icon: "⚙️",
      fields: [
        { name: "line_id", type: "string", required: true, description: "ID linky" },
        { name: "name", type: "string", required: true, description: "Název stroje" },
        { name: "description", type: "string", description: "Popis" },
        { name: "inventory_number", type: "string", description: "Inventární číslo" },
        { name: "location", type: "string", description: "Umístění" },
        { name: "machine_type", type: "string", enum: ["press", "conveyor", "pump", "fan", "compressor", "motor", "gearbox", "crane", "robot", "cnc_machine", "welding_machine", "other"], description: "Typ stroje" },
        { name: "order_index", type: "number", default: 0, description: "Pořadí" }
      ]
    },
    {
      name: "ControlPoint",
      nameCz: "Kontrolní body",
      description: "Mazací a inspekční body",
      icon: "📍",
      fields: [
        { name: "machine_id", type: "string", required: true, description: "ID stroje" },
        { name: "type", type: "string", enum: ["lubrication", "inspection", "auto_lubricator"], required: true, description: "Typ bodu" },
        { name: "number", type: "string", description: "Číslo bodu" },
        { name: "name", type: "string", required: true, description: "Název" },
        { name: "description", type: "string", description: "Popis" },
        { name: "lubricant_type", type: "string", description: "Typ maziva" },
        { name: "lubricant_amount", type: "number", description: "Množství maziva (g)" },
        { name: "interval_hours", type: "number", description: "Interval v hodinách" },
        { name: "nfc_chip_id", type: "string", description: "ID NFC čipu" },
        { name: "inspection_tasks", type: "string", description: "Inspekční úkoly" }
      ]
    },
    {
      name: "ControlRecord",
      nameCz: "Záznamy kontrol",
      description: "Historie provedených kontrol",
      icon: "📝",
      fields: [
        { name: "control_point_id", type: "string", required: true, description: "ID kontrolního bodu" },
        { name: "record_type", type: "string", enum: ["lubrication", "inspection", "lubricator_change"], required: true, description: "Typ záznamu" },
        { name: "performed_at", type: "string", format: "date-time", required: true, description: "Datum provedení" },
        { name: "note", type: "string", description: "Poznámka" },
        { name: "photo_url", type: "string", description: "URL fotografie" }
      ]
    },
    {
      name: "Note",
      nameCz: "Poznámky",
      description: "Poznámky k bodům",
      icon: "💬",
      fields: [
        { name: "control_point_id", type: "string", required: true, description: "ID kontrolního bodu" },
        { name: "text", type: "string", required: true, description: "Text poznámky" }
      ]
    },
    {
      name: "Documentation",
      nameCz: "Dokumentace",
      description: "Fotodokumentace a soubory",
      icon: "📄",
      fields: [
        { name: "machine_id", type: "string", description: "ID stroje (volitelné)" },
        { name: "control_point_id", type: "string", description: "ID bodu (volitelné)" },
        { name: "file_url", type: "string", required: true, description: "URL souboru" },
        { name: "file_name", type: "string", required: true, description: "Název souboru" },
        { name: "file_type", type: "string", enum: ["photo", "schema", "document", "other_file"], required: true, description: "Typ souboru" },
        { name: "category", type: "string", enum: ["drawing", "operational", "other"], required: true, description: "Kategorie" }
      ]
    },
    {
      name: "Issue",
      nameCz: "Závady",
      description: "Nahlášené závady a problémy",
      icon: "⚠️",
      fields: [
        { name: "control_point_id", type: "string", description: "ID kontrolního bodu" },
        { name: "machine_id", type: "string", description: "ID stroje" },
        { name: "description", type: "string", required: true, description: "Popis závady" },
        { name: "photo_url", type: "string", description: "URL fotografie" },
        { name: "status", type: "string", enum: ["reported", "resolved"], default: "reported", description: "Stav" },
        { name: "resolved_at", type: "string", format: "date-time", description: "Datum vyřešení" },
        { name: "resolved_by", type: "string", description: "Email řešitele" },
        { name: "resolution_note", type: "string", description: "Poznámka k řešení" }
      ]
    },
    {
      name: "User",
      nameCz: "Uživatelé",
      description: "Uživatelské účty (pouze čtení a aktualizace vlastního účtu)",
      icon: "👤",
      fields: [
        { name: "email", type: "string", format: "email", readOnly: true, description: "Email (read-only)" },
        { name: "full_name", type: "string", readOnly: true, description: "Celé jméno (read-only)" },
        { name: "role", type: "string", enum: ["admin", "user"], readOnly: true, description: "Role (read-only)" },
        { name: "user_type", type: "string", enum: ["superAdmin", "admin", "manager", "technician"], description: "Typ uživatele" },
        { name: "company_id", type: "string", description: "ID podniku" },
        { name: "assigned_company_ids", type: "array", items: "string", description: "Přiřazené podniky (admin)" },
        { name: "phone", type: "string", description: "Telefon" },
        { name: "custom_display_name", type: "string", description: "Vlastní zobrazované jméno" },
        { name: "last_active_at", type: "string", format: "date-time", description: "Poslední aktivita" }
      ]
    },
    {
      name: "MaintenanceRecord",
      nameCz: "Záznamy údržby",
      description: "Historie údržbových zásahů",
      icon: "🔧",
      fields: [
        { name: "machine_id", type: "string", required: true, description: "ID stroje" },
        { name: "maintenance_type", type: "string", enum: ["preventive", "corrective", "predictive", "inspection"], required: true, description: "Typ údržby" },
        { name: "title", type: "string", required: true, description: "Název úkonu" },
        { name: "description", type: "string", description: "Popis" },
        { name: "performed_at", type: "string", format: "date-time", required: true, description: "Datum provedení" },
        { name: "duration_hours", type: "number", description: "Doba trvání (hod)" },
        { name: "cost", type: "number", description: "Náklady (Kč)" },
        { name: "spare_parts_used", type: "array", items: "string", description: "Použité náhradní díly (ID)" },
        { name: "technician", type: "string", description: "Jméno technika" },
        { name: "notes", type: "string", description: "Poznámky" }
      ]
    },
    {
      name: "SparePart",
      nameCz: "Náhradní díly",
      description: "Skladové zásoby náhradních dílů",
      icon: "🔩",
      fields: [
        { name: "machine_id", type: "string", required: true, description: "ID stroje" },
        { name: "name", type: "string", required: true, description: "Název dílu" },
        { name: "part_number", type: "string", description: "Katalogové číslo" },
        { name: "manufacturer", type: "string", description: "Výrobce" },
        { name: "category", type: "string", enum: ["mechanical", "electrical", "hydraulic", "pneumatic", "consumable", "other"], description: "Kategorie" },
        { name: "quantity_in_stock", type: "number", default: 0, description: "Počet na skladě" },
        { name: "minimum_stock", type: "number", default: 0, description: "Minimální stav" },
        { name: "unit_price", type: "number", description: "Cena za kus (Kč)" },
        { name: "supplier", type: "string", description: "Dodavatel" },
        { name: "supplier_contact", type: "string", description: "Kontakt dodavatele" },
        { name: "storage_location", type: "string", description: "Umístění skladu" },
        { name: "notes", type: "string", description: "Poznámky" }
      ]
    },
    {
      name: "VibrationMeasurement",
      nameCz: "Měření vibrací",
      description: "Diagnostická měření vibrací",
      icon: "📊",
      fields: [
        { name: "machine_id", type: "string", required: true, description: "ID stroje" },
        { name: "measurement_type", type: "string", enum: ["online", "offline"], required: true, description: "Typ měření" },
        { name: "measurement_date", type: "string", format: "date-time", required: true, description: "Datum měření" },
        { name: "measuring_point", type: "string", required: true, description: "Místo měření" },
        { name: "v_rms", type: "number", description: "Rychlost RMS (mm/s)" },
        { name: "a_rms", type: "number", description: "Zrychlení RMS (m/s²)" },
        { name: "a_envelope", type: "number", description: "Obálka zrychlení (g)" },
        { name: "overall_acceleration", type: "number", description: "Celkové zrychlení (m/s²)" },
        { name: "temperature", type: "number", description: "Teplota (°C)" },
        { name: "condition_rating", type: "string", enum: ["good", "acceptable", "unsatisfactory", "unacceptable"], description: "Hodnocení stavu" },
        { name: "findings", type: "string", description: "Zjištění" },
        { name: "recommendations", type: "string", description: "Doporučení" },
        { name: "measured_by", type: "string", description: "Měřil" }
      ]
    },
    {
      name: "MachineResponsibility",
      nameCz: "Odpovědnosti",
      description: "Přiřazení zodpovědných osob ke strojům",
      icon: "👥",
      fields: [
        { name: "machine_id", type: "string", required: true, description: "ID stroje" },
        { name: "responsibility_type", type: "string", enum: ["primary", "maintenance", "lubrication", "inspection", "vibration_analysis", "spare_parts"], required: true, description: "Typ odpovědnosti" },
        { name: "user_email", type: "string", format: "email", required: true, description: "Email uživatele" },
        { name: "user_name", type: "string", required: true, description: "Jméno uživatele" },
        { name: "notes", type: "string", description: "Poznámky" }
      ]
    },
    {
      name: "PlannedMaintenance",
      nameCz: "Plánovaná údržba",
      description: "Správa plánovaných údržbových úkolů",
      icon: "📅",
      fields: [
        { name: "machine_id", type: "string", required: true, description: "ID stroje" },
        { name: "title", type: "string", required: true, description: "Název" },
        { name: "description", type: "string", description: "Popis práce" },
        { name: "maintenance_type", type: "string", enum: ["preventive", "corrective", "predictive", "inspection"], required: true, description: "Typ údržby" },
        { name: "planned_date", type: "string", format: "date", required: true, description: "Plánované datum" },
        { name: "assigned_to", type: "string", format: "email", description: "Přiřazen technikovi" },
        { name: "status", type: "string", enum: ["planned", "assigned", "completed", "cancelled"], default: "planned", description: "Stav" },
        { name: "priority", type: "string", enum: ["low", "medium", "high"], default: "medium", description: "Priorita" },
        { name: "estimated_duration_hours", type: "number", description: "Odhadovaná doba (hod)" },
        { name: "estimated_cost", type: "number", description: "Odhadované náklady (Kč)" },
        { name: "interval_days", type: "number", description: "Interval opakování (dny)" },
        { name: "notes", type: "string", description: "Poznámky" },
        { name: "work_order_created_at", type: "string", format: "date-time", description: "Kdy byl vytvořen pracovní příkaz" },
        { name: "completed_at", type: "string", format: "date-time", description: "Kdy dokončeno" },
        { name: "maintenance_record_id", type: "string", description: "ID záznamu údržby" }
      ]
    },
    {
      name: "AuditLog",
      nameCz: "Audit Log",
      description: "Historie všech změn v systému (pouze čtení)",
      icon: "📜",
      readOnly: true,
      fields: [
        { name: "entity_type", type: "string", enum: ["Company", "Line", "Machine", "ControlPoint", "Issue", "User", "Auth"], required: true, description: "Typ entity" },
        { name: "entity_id", type: "string", description: "ID entity" },
        { name: "changed_by", type: "string", format: "email", required: true, description: "Email uživatele" },
        { name: "change_description", type: "string", required: true, description: "Popis změny" },
        { name: "user_type", type: "string", enum: ["technician", "manager", "admin", "superAdmin"], description: "Role uživatele" },
        { name: "company_id", type: "string", description: "ID podniku" }
      ]
    }
  ];

  const CodeBlock = ({ code, language = "javascript", id }) => (
    <div className="relative">
      <div className="absolute right-2 top-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => copyToClipboard(code, id)}
          className="text-slate-300 hover:text-white"
        >
          {copiedCode === id ? (
            <Check className="w-4 h-4" />
          ) : (
            <Copy className="w-4 h-4" />
          )}
        </Button>
      </div>
      <pre className="bg-slate-900 text-slate-100 p-4 rounded-lg overflow-x-auto text-sm">
        <code>{code}</code>
      </pre>
    </div>
  );

  return (
    <div className="p-4 md:p-8 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2">
            API Dokumentace HCMS
          </h1>
          <p className="text-slate-600">
            Kompletní REST API pro Heistech Cloud Maintenance System
          </p>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 bg-white shadow-sm">
            <TabsTrigger value="overview">Přehled</TabsTrigger>
            <TabsTrigger value="entities">Entity</TabsTrigger>
            <TabsTrigger value="authentication">Autentizace</TabsTrigger>
            <TabsTrigger value="examples">Příklady</TabsTrigger>
          </TabsList>

          {/* Přehled */}
          <TabsContent value="overview" className="space-y-6">
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <LinkIcon className="w-5 h-5" />
                  Základní informace
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h3 className="font-semibold text-slate-900 mb-2">Base URL</h3>
                  <code className="bg-slate-100 px-3 py-2 rounded block text-sm">
                    https://api.base44.com/v1/apps/{'<APP_ID>'}
                  </code>
                </div>

                <div>
                  <h3 className="font-semibold text-slate-900 mb-2">Autentizace</h3>
                  <p className="text-slate-600 mb-2">
                    Všechny požadavky musí obsahovat Bearer token v hlavičce:
                  </p>
                  <code className="bg-slate-100 px-3 py-2 rounded block text-sm">
                    Authorization: Bearer {'<TOKEN>'}
                  </code>
                </div>

                <div>
                  <h3 className="font-semibold text-slate-900 mb-2">Formát dat</h3>
                  <p className="text-slate-600">
                    API přijímá a vrací data ve formátu JSON. Všechny požadavky by měly mít:
                  </p>
                  <code className="bg-slate-100 px-3 py-2 rounded block text-sm mt-2">
                    Content-Type: application/json
                  </code>
                </div>

                <div>
                  <h3 className="font-semibold text-slate-900 mb-2">Vestavěné atributy</h3>
                  <p className="text-slate-600 mb-2">
                    Všechny entity automaticky obsahují:
                  </p>
                  <ul className="list-disc list-inside text-slate-600 space-y-1">
                    <li><code className="text-sm bg-slate-100 px-2 py-1 rounded">id</code> - unikátní identifikátor</li>
                    <li><code className="text-sm bg-slate-100 px-2 py-1 rounded">created_date</code> - datum vytvoření</li>
                    <li><code className="text-sm bg-slate-100 px-2 py-1 rounded">updated_date</code> - datum poslední úpravy</li>
                    <li><code className="text-sm bg-slate-100 px-2 py-1 rounded">created_by</code> - email uživatele, který vytvořil záznam</li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="w-5 h-5" />
                  HTTP Metody
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="border rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge className="bg-green-100 text-green-800">GET</Badge>
                      <h4 className="font-semibold">Načtení dat</h4>
                    </div>
                    <p className="text-sm text-slate-600">
                      Seznam všech záznamů nebo konkrétní záznam podle ID
                    </p>
                  </div>

                  <div className="border rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge className="bg-blue-100 text-blue-800">POST</Badge>
                      <h4 className="font-semibold">Vytvoření záznamu</h4>
                    </div>
                    <p className="text-sm text-slate-600">
                      Vytvoření nového záznamu entity
                    </p>
                  </div>

                  <div className="border rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge className="bg-yellow-100 text-yellow-800">PUT</Badge>
                      <h4 className="font-semibold">Aktualizace záznamu</h4>
                    </div>
                    <p className="text-sm text-slate-600">
                      Úprava existujícího záznamu podle ID
                    </p>
                  </div>

                  <div className="border rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge className="bg-red-100 text-red-800">DELETE</Badge>
                      <h4 className="font-semibold">Smazání záznamu</h4>
                    </div>
                    <p className="text-sm text-slate-600">
                      Odstranění záznamu podle ID
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="w-5 h-5" />
                  Dostupné entity ({entities.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {entities.map((entity) => (
                    <div
                      key={entity.name}
                      className="border rounded-lg p-3 hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-2xl">{entity.icon}</span>
                        <h4 className="font-semibold text-slate-900">{entity.nameCz}</h4>
                      </div>
                      <p className="text-xs text-slate-600">{entity.description}</p>
                      <code className="text-xs bg-slate-100 px-2 py-1 rounded mt-2 inline-block">
                        {entity.name}
                      </code>
                      {entity.readOnly && (
                        <Badge variant="outline" className="ml-2 text-xs">
                          Read-only
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Entity */}
          <TabsContent value="entities" className="space-y-6">
            {entities.map((entity) => (
              <Card key={entity.name} className="shadow-lg">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-3">
                      <span className="text-3xl">{entity.icon}</span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span>{entity.nameCz}</span>
                          <code className="text-sm font-normal bg-slate-100 px-2 py-1 rounded">
                            {entity.name}
                          </code>
                          {entity.readOnly && (
                            <Badge variant="outline" className="text-xs">
                              Read-only
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm font-normal text-slate-600 mt-1">
                          {entity.description}
                        </p>
                      </div>
                    </CardTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleSection(entity.name)}
                    >
                      {expandedSections[entity.name] ? (
                        <ChevronDown className="w-5 h-5" />
                      ) : (
                        <ChevronRight className="w-5 h-5" />
                      )}
                    </Button>
                  </div>
                </CardHeader>

                {expandedSections[entity.name] && (
                  <CardContent className="space-y-6">
                    {/* Schéma */}
                    <div>
                      <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        Schéma entity
                      </h3>
                      <div className="bg-slate-50 rounded-lg p-4 space-y-2">
                        {entity.fields.map((field) => (
                          <div key={field.name} className="flex items-start gap-3 border-b border-slate-200 pb-2 last:border-0">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <code className="text-sm font-semibold text-blue-700">
                                  {field.name}
                                </code>
                                {field.required && (
                                  <Badge variant="destructive" className="text-xs">
                                    povinné
                                  </Badge>
                                )}
                                {field.readOnly && (
                                  <Badge variant="outline" className="text-xs">
                                    read-only
                                  </Badge>
                                )}
                              </div>
                              <div className="text-xs text-slate-600 space-y-1">
                                <p>
                                  <span className="font-medium">Typ:</span>{" "}
                                  <code className="bg-white px-1 py-0.5 rounded">
                                    {field.type}
                                    {field.format && ` (${field.format})`}
                                  </code>
                                </p>
                                {field.enum && (
                                  <p>
                                    <span className="font-medium">Hodnoty:</span>{" "}
                                    {field.enum.map((val, i) => (
                                      <code key={i} className="bg-white px-1 py-0.5 rounded mr-1">
                                        {val}
                                      </code>
                                    ))}
                                  </p>
                                )}
                                {field.default !== undefined && (
                                  <p>
                                    <span className="font-medium">Výchozí:</span>{" "}
                                    <code className="bg-white px-1 py-0.5 rounded">
                                      {JSON.stringify(field.default)}
                                    </code>
                                  </p>
                                )}
                                {field.description && (
                                  <p className="text-slate-500 italic">{field.description}</p>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* API Endpointy */}
                    {!entity.readOnly && (
                      <div>
                        <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                          <Code className="w-4 h-4" />
                          API Endpointy
                        </h3>
                        
                        <div className="space-y-4">
                          {/* GET All */}
                          <div className="border rounded-lg p-4">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge className="bg-green-100 text-green-800">GET</Badge>
                              <code className="text-sm">/entities/{entity.name}</code>
                            </div>
                            <p className="text-sm text-slate-600 mb-3">
                              Načte seznam všech záznamů. Podporuje filtrování a řazení.
                            </p>
                            <CodeBlock
                              id={`${entity.name}-get-all`}
                              code={`// Základní dotaz
fetch('https://api.base44.com/v1/apps/<APP_ID>/entities/${entity.name}', {
  headers: {
    'Authorization': 'Bearer <TOKEN>',
    'Content-Type': 'application/json'
  }
})

// S filtrováním a řazením
fetch('https://api.base44.com/v1/apps/<APP_ID>/entities/${entity.name}?${
  entity.name === 'Machine' ? 'filter={"line_id":"<LINE_ID>"}' : 
  entity.name === 'ControlPoint' ? 'filter={"machine_id":"<MACHINE_ID>"}' :
  entity.name === 'Issue' ? 'filter={"status":"reported"}' :
  'filter={}'
}&sort=-created_date&limit=20', {
  headers: {
    'Authorization': 'Bearer <TOKEN>',
    'Content-Type': 'application/json'
  }
})`}
                            />
                          </div>

                          {/* GET by ID */}
                          <div className="border rounded-lg p-4">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge className="bg-green-100 text-green-800">GET</Badge>
                              <code className="text-sm">/entities/{entity.name}/{'{id}'}</code>
                            </div>
                            <p className="text-sm text-slate-600 mb-3">
                              Načte konkrétní záznam podle ID.
                            </p>
                            <CodeBlock
                              id={`${entity.name}-get-id`}
                              code={`fetch('https://api.base44.com/v1/apps/<APP_ID>/entities/${entity.name}/<ID>', {
  headers: {
    'Authorization': 'Bearer <TOKEN>',
    'Content-Type': 'application/json'
  }
})`}
                            />
                          </div>

                          {/* POST */}
                          <div className="border rounded-lg p-4">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge className="bg-blue-100 text-blue-800">POST</Badge>
                              <code className="text-sm">/entities/{entity.name}</code>
                            </div>
                            <p className="text-sm text-slate-600 mb-3">
                              Vytvoří nový záznam.
                            </p>
                            <CodeBlock
                              id={`${entity.name}-post`}
                              code={`fetch('https://api.base44.com/v1/apps/<APP_ID>/entities/${entity.name}', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer <TOKEN>',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
${entity.fields
  .filter(f => !f.readOnly && (f.required || f.default === undefined))
  .slice(0, 3)
  .map(f => {
    let value = 'value';
    if (f.type === 'string') value = f.enum ? `"${f.enum[0]}"` : '"example"';
    if (f.type === 'number') value = '0';
    if (f.type === 'boolean') value = 'true';
    if (f.type === 'array') value = '[]';
    return `    "${f.name}": ${value}`;
  })
  .join(',\n')}
  })
})`}
                            />
                          </div>

                          {/* PUT */}
                          <div className="border rounded-lg p-4">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge className="bg-yellow-100 text-yellow-800">PUT</Badge>
                              <code className="text-sm">/entities/{entity.name}/{'{id}'}</code>
                            </div>
                            <p className="text-sm text-slate-600 mb-3">
                              Aktualizuje existující záznam podle ID.
                            </p>
                            <CodeBlock
                              id={`${entity.name}-put`}
                              code={`fetch('https://api.base44.com/v1/apps/<APP_ID>/entities/${entity.name}/<ID>', {
  method: 'PUT',
  headers: {
    'Authorization': 'Bearer <TOKEN>',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
${entity.fields
  .filter(f => !f.readOnly)
  .slice(0, 2)
  .map(f => {
    let value = 'new_value';
    if (f.type === 'string') value = '"new_value"';
    if (f.type === 'number') value = '100';
    if (f.type === 'boolean') value = 'false';
    return `    "${f.name}": ${value}`;
  })
  .join(',\n')}
  })
})`}
                            />
                          </div>

                          {/* DELETE */}
                          <div className="border rounded-lg p-4">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge className="bg-red-100 text-red-800">DELETE</Badge>
                              <code className="text-sm">/entities/{entity.name}/{'{id}'}</code>
                            </div>
                            <p className="text-sm text-slate-600 mb-3">
                              Smaže záznam podle ID.
                            </p>
                            <CodeBlock
                              id={`${entity.name}-delete`}
                              code={`fetch('https://api.base44.com/v1/apps/<APP_ID>/entities/${entity.name}/<ID>', {
  method: 'DELETE',
  headers: {
    'Authorization': 'Bearer <TOKEN>',
    'Content-Type': 'application/json'
  }
})`}
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {entity.readOnly && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <div className="flex items-start gap-2">
                          <Shield className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="text-sm font-semibold text-blue-900 mb-1">
                              Pouze pro čtení
                            </p>
                            <p className="text-sm text-blue-800">
                              Tato entita je pouze pro čtení. Podporuje pouze GET operace. Záznamy se vytváří automaticky systémem.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                )}
              </Card>
            ))}
          </TabsContent>

          {/* Autentizace */}
          <TabsContent value="authentication" className="space-y-6">
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Key className="w-5 h-5" />
                  Získání API tokenu
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-slate-600">
                  Pro přístup k API potřebujete autentizační token. Token získáte pomocí přihlašovacích údajů:
                </p>
                
                <CodeBlock
                  id="auth-login"
                  code={`// Přihlášení a získání tokenu
const response = await fetch('https://api.base44.com/v1/auth/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'your_password'
  })
});

const { token } = await response.json();
console.log('Token:', token);`}
                />

                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mt-4">
                  <div className="flex items-start gap-2">
                    <Shield className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-yellow-900 mb-1">
                        Bezpečnost tokenu
                      </p>
                      <p className="text-sm text-yellow-800">
                        Nikdy nesdílejte svůj API token veřejně. Token má neomezenou platnost, dokud ho sami nezrušíte.
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5" />
                  Použití tokenu v požadavcích
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-slate-600">
                  Token přidejte do hlavičky Authorization každého API požadavku:
                </p>
                
                <CodeBlock
                  id="auth-usage"
                  code={`const response = await fetch('https://api.base44.com/v1/apps/<APP_ID>/entities/Machine', {
  headers: {
    'Authorization': 'Bearer <YOUR_TOKEN>',
    'Content-Type': 'application/json'
  }
});

const machines = await response.json();`}
                />
              </CardContent>
            </Card>

            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="w-5 h-5" />
                  Aktualizace vlastní aktivity
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-slate-600">
                  Pro sledování vlastní aktivity v systému použijte speciální endpoint:
                </p>
                
                <CodeBlock
                  id="auth-update-me"
                  code={`// Aktualizace vlastních údajů včetně last_active_at
await fetch('https://api.base44.com/v1/auth/me', {
  method: 'PUT',
  headers: {
    'Authorization': 'Bearer <TOKEN>',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    last_active_at: new Date().toISOString(),
    custom_display_name: "Nové jméno",
    phone: "+420123456789"
  })
});`}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Příklady */}
          <TabsContent value="examples" className="space-y-6">
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle>Kompletní workflow - Mobilní aplikace pro mazání</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-slate-600">
                  Typický workflow mobilní aplikace pro technika:
                </p>

                <div className="space-y-6">
                  <div>
                    <h4 className="font-semibold text-slate-900 mb-2">
                      1. Přihlášení
                    </h4>
                    <CodeBlock
                      id="example-1"
                      code={`const loginResponse = await fetch('https://api.base44.com/v1/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'technik@example.com',
    password: 'heslo123'
  })
});
const { token } = await loginResponse.json();`}
                    />
                  </div>

                  <div>
                    <h4 className="font-semibold text-slate-900 mb-2">
                      2. Načtení kontrolních bodů pro stroj
                    </h4>
                    <CodeBlock
                      id="example-2"
                      code={`const pointsResponse = await fetch(
  'https://api.base44.com/v1/apps/<APP_ID>/entities/ControlPoint?' +
  'filter={"machine_id":"<MACHINE_ID>","type":"lubrication"}',
  {
    headers: {
      'Authorization': \`Bearer \${token}\`,
      'Content-Type': 'application/json'
    }
  }
);
const points = await pointsResponse.json();`}
                    />
                  </div>

                  <div>
                    <h4 className="font-semibold text-slate-900 mb-2">
                      3. Čtení NFC čipu (v aplikaci)
                    </h4>
                    <CodeBlock
                      id="example-3"
                      code={`// NFC skenování v prohlížeči (Web NFC API)
const ndef = new NDEFReader();
await ndef.scan();

ndef.addEventListener("reading", ({ serialNumber }) => {
  // Vyhledání bodu podle NFC ID
  const point = points.find(p => p.nfc_chip_id === serialNumber);
  if (point) {
    console.log('Nalezen bod:', point.name);
  }
});`}
                    />
                  </div>

                  <div>
                    <h4 className="font-semibold text-slate-900 mb-2">
                      4. Vytvoření záznamu o mazání
                    </h4>
                    <CodeBlock
                      id="example-4"
                      code={`await fetch('https://api.base44.com/v1/apps/<APP_ID>/entities/ControlRecord', {
  method: 'POST',
  headers: {
    'Authorization': \`Bearer \${token}\`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    control_point_id: point.id,
    record_type: 'lubrication',
    performed_at: new Date().toISOString(),
    note: 'Mazání provedeno dle plánu'
  })
});`}
                    />
                  </div>

                  <div>
                    <h4 className="font-semibold text-slate-900 mb-2">
                      5. Nahlášení závady (volitelné)
                    </h4>
                    <CodeBlock
                      id="example-5"
                      code={`// Nahrání fotografie
const photoFormData = new FormData();
photoFormData.append('file', photoFile);

const uploadResponse = await fetch(
  'https://api.base44.com/v1/apps/<APP_ID>/integrations/Core/UploadFile',
  {
    method: 'POST',
    headers: { 'Authorization': \`Bearer \${token}\` },
    body: photoFormData
  }
);
const { file_url } = await uploadResponse.json();

// Vytvoření závady
await fetch('https://api.base44.com/v1/apps/<APP_ID>/entities/Issue', {
  method: 'POST',
  headers: {
    'Authorization': \`Bearer \${token}\`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    control_point_id: point.id,
    description: 'Zjištěn únik maziva',
    photo_url: file_url,
    status: 'reported'
  })
});`}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle>Filtrování a řazení</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-semibold text-slate-900 mb-2">
                    Filtrování záznamů
                  </h4>
                  <CodeBlock
                    id="example-filter"
                    code={`// Filtrace podle jednoho pole
const response = await fetch(
  'https://api.base44.com/v1/apps/<APP_ID>/entities/Issue?' +
  'filter={"status":"reported"}',
  { headers: { 'Authorization': \`Bearer \${token}\` } }
);

// Filtrace podle více polí
const response2 = await fetch(
  'https://api.base44.com/v1/apps/<APP_ID>/entities/Machine?' +
  'filter={"line_id":"<LINE_ID>","machine_type":"press"}',
  { headers: { 'Authorization': \`Bearer \${token}\` } }
);`}
                  />
                </div>

                <div>
                  <h4 className="font-semibold text-slate-900 mb-2">
                    Řazení výsledků
                  </h4>
                  <CodeBlock
                    id="example-sort"
                    code={`// Vzestupně podle created_date
const response = await fetch(
  'https://api.base44.com/v1/apps/<APP_ID>/entities/ControlRecord?' +
  'sort=created_date',
  { headers: { 'Authorization': \`Bearer \${token}\` } }
);

// Sestupně (nejnovější první) - prefix "-"
const response2 = await fetch(
  'https://api.base44.com/v1/apps/<APP_ID>/entities/ControlRecord?' +
  'sort=-created_date&limit=50',
  { headers: { 'Authorization': \`Bearer \${token}\` } }
);`}
                  />
                </div>

                <div>
                  <h4 className="font-semibold text-slate-900 mb-2">
                    Limitování výsledků
                  </h4>
                  <CodeBlock
                    id="example-limit"
                    code={`// Načíst pouze posledních 20 záznamů
const response = await fetch(
  'https://api.base44.com/v1/apps/<APP_ID>/entities/AuditLog?' +
  'sort=-created_date&limit=20',
  { headers: { 'Authorization': \`Bearer \${token}\` } }
);`}
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle>HTTP Response kódy</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-start gap-3 p-3 bg-green-50 border border-green-200 rounded">
                    <Badge className="bg-green-100 text-green-800">200</Badge>
                    <div>
                      <p className="font-semibold text-green-900">OK</p>
                      <p className="text-sm text-green-800">Požadavek byl úspěšně zpracován</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 bg-blue-50 border border-blue-200 rounded">
                    <Badge className="bg-blue-100 text-blue-800">201</Badge>
                    <div>
                      <p className="font-semibold text-blue-900">Created</p>
                      <p className="text-sm text-blue-800">Nový záznam byl úspěšně vytvořen</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 bg-yellow-50 border border-yellow-200 rounded">
                    <Badge className="bg-yellow-100 text-yellow-800">400</Badge>
                    <div>
                      <p className="font-semibold text-yellow-900">Bad Request</p>
                      <p className="text-sm text-yellow-800">Neplatná data v požadavku (chybějící povinná pole, špatný formát)</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 bg-orange-50 border border-orange-200 rounded">
                    <Badge className="bg-orange-100 text-orange-800">401</Badge>
                    <div>
                      <p className="font-semibold text-orange-900">Unauthorized</p>
                      <p className="text-sm text-orange-800">Chybí nebo je neplatný autentizační token</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded">
                    <Badge className="bg-red-100 text-red-800">404</Badge>
                    <div>
                      <p className="font-semibold text-red-900">Not Found</p>
                      <p className="text-sm text-red-800">Požadovaný záznam nebyl nalezen</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 bg-slate-50 border border-slate-200 rounded">
                    <Badge className="bg-slate-100 text-slate-800">500</Badge>
                    <div>
                      <p className="font-semibold text-slate-900">Server Error</p>
                      <p className="text-sm text-slate-800">Chyba na straně serveru</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}