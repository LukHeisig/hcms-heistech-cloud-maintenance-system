import { base44 } from "@/api/base44Client";

export const TRACKED_FIELD_LABELS = {
  status: "Stav",
  due_date: "Termín odstranění",
  responsible: "Odpovědná osoba / útvar",
  assigned_to: "Přidělený pracovník",
  classification: "Klasifikace",
  description: "Popis",
  removed_date: "Datum odstranění",
  removed_by: "Odstranil",
  closed_date: "Datum ukončení",
  closed_by: "Ukončil / potvrdil",
  verified_by: "Následná kontrola",
  removal_method: "Způsob odstranění",
  note: "Poznámka",
  next_revision_date: "Termín příští revize",
  responsible_person: "Odpovědná osoba",
  report_number: "Číslo zprávy",
  subject: "Předmět revize",
};

const str = (v) => (v === undefined || v === null ? "" : String(v));

// Zapíše změny sledovaných polí do historie
export async function logChanges({ user, recordType, recordId, companyId, before, after, action = "updated" }) {
  const base = {
    company_id: companyId,
    record_type: recordType,
    record_id: recordId,
    changed_by: user?.email,
    changed_by_name: user?.custom_display_name || user?.full_name || user?.email,
  };
  if (action !== "updated") {
    await base44.entities.RevisionChangeLog.create({ ...base, action, new_value: str(after) });
    return;
  }
  const entries = Object.keys(TRACKED_FIELD_LABELS)
    .filter((f) => f in after && str(before?.[f]) !== str(after[f]))
    .map((f) => ({ ...base, action, field: f, old_value: str(before?.[f]), new_value: str(after[f]) }));
  if (entries.length) await base44.entities.RevisionChangeLog.bulkCreate(entries);
}