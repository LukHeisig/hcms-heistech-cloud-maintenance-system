import { base44 } from "@/api/base44Client";

const SCHEMA = {
  type: "object",
  properties: {
    report_number: { type: "string" },
    vtz_type: { type: "string", enum: ["electro", "gas", "pressure", "lifting"] },
    category: { type: "string", enum: ["ex_special", "gas_boiler", "gas_appliances", "technology", "buildings", "lightning", "by_device"] },
    revision_kind: { type: "string" },
    subject: { type: "string" },
    technician_name: { type: "string" },
    technician_reg_no: { type: "string" },
    revision_date_from: { type: "string" },
    revision_date_to: { type: "string" },
    previous_revision_date: { type: "string" },
    report_date: { type: "string" },
    next_revision_month: { type: "string" },
    interval_months: { type: "number" },
    overall_assessment: { type: "string" },
    conclusion: { type: "string" },
    is_operational: { type: "boolean" },
    defects: {
      type: "array",
      items: {
        type: "object",
        properties: {
          location: { type: "string" },
          standard_ref: { type: "string" },
          description: { type: "string" },
          classification: { type: "string", enum: ["C1", "C2", "C3"] },
        },
      },
    },
  },
};

const PROMPT = `Jsi asistent pro evidenci revizí vyhrazených technických zařízení (VTZ). Z přiložené revizní zprávy (PDF, typicky z programu dm Revize) vytěž data.

Pravidla:
- report_number: evidenční číslo zprávy z hlavičky (např. "RE-26-4919", "RH-25-3988").
- vtz_type: electro (elektroinstalace, hromosvody), gas (plynová zařízení), pressure (tlaková), lifting (zdvihací).
- category: lightning pro hromosvody (LPS); gas_boiler pro plynové kotelny; gas_appliances pro místnosti s plynovými spotřebiči; ex_special pro prostory s nebezpečím výbuchu / Ex / speciální; technology pro technologické celky; buildings pro budovy, sklady, dílny a běžné prostory; by_device pro plynová/tlaková/zdvihací zařízení.
- revision_kind: např. "pravidelná", "výchozí", "mimořádná".
- subject: předmět revize (název objektu / zařízení).
- Všechna data převeď na formát YYYY-MM-DD. next_revision_month = "doporučená příští revize" ve formátu YYYY-MM.
- interval_months: interval pravidelné revize, pokud je v závěru uveden (např. "co 3 roky" = 36), jinak rozdíl mezi datem revize a doporučenou příští revizí v měsících.
- overall_assessment: text "Celkový posudek". conclusion: stručné shrnutí závěru (článek Závěr).
- is_operational: true, pokud je zařízení schopno bezpečného provozu.
- defects: VŠECHNY závady z oddílu "Zjištěné závady a odchylky od platných norem" (u elektro instalace článek 6, u hromosvodu článek 4). Každý blok [n] je jedna závada:
  - location = nadpis bloku za [n] (např. "Místnosti uklízeček"),
  - standard_ref = odkaz na normu a článek,
  - description = požadovaná nápravná opatření (všechny věty s pokyny, např. "Opravte zemnič..."); citaci normy nepřidávej, pokud jsou uvedeny pokyny,
  - classification = C1 / C2 / C3 dle uvedené klasifikace.
Nic si nevymýšlej; chybějící údaje vynech.`;

export async function extractRevisionReport(fileUrl) {
  return base44.integrations.Core.InvokeLLM({
    prompt: PROMPT,
    file_urls: [fileUrl],
    response_json_schema: SCHEMA,
  });
}