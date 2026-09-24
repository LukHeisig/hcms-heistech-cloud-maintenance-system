import { addDays, addMonths, format, endOfMonth, differenceInCalendarDays } from "date-fns";

export const VTZ_TYPES = {
  electro: "Elektro VTZ",
  gas: "Plynová VTZ",
  pressure: "Tlaková VTZ",
  lifting: "Zdvihací VTZ",
};

export const CATEGORIES = {
  ex_special: { label: "Nebezpečí výbuchu / Ex / speciální prostory", months: 12 },
  gas_boiler: { label: "Plynové kotelny", months: 12 },
  gas_appliances: { label: "Místnosti s plynovými spotřebiči", months: 24 },
  technology: { label: "Technologické celky", months: 36 },
  buildings: { label: "Budovy, sklady", months: 36 },
  lightning: { label: "Hromosvody", months: 48 },
  by_device: { label: "Dle konkrétního zařízení a režimu", months: null },
};

export const CLASSIFICATIONS = {
  C1: { label: "C1 – nebezpečné / bránící provozu", days: 3, color: "bg-red-100 text-red-800 border-red-300" },
  C2: { label: "C2 – potenciálně nebezpečné", days: 30, color: "bg-orange-100 text-orange-800 border-orange-300" },
  C3: { label: "C3 – bez vlivu na bezpečnost", days: 90, color: "bg-yellow-50 text-yellow-800 border-yellow-300" },
};

// Jednotné barvy: modrá = evidence, oranžová = přiděleno/termín, červená = po termínu, zelená = ukončeno
export const STATUSES = {
  new: { label: "Nová", color: "bg-blue-100 text-blue-800 border-blue-300" },
  assigned: { label: "Přiděleno", color: "bg-amber-100 text-amber-800 border-amber-300" },
  in_progress: { label: "V řešení", color: "bg-amber-100 text-amber-800 border-amber-300" },
  removed: { label: "Odstraněno", color: "bg-violet-100 text-violet-800 border-violet-300" },
  awaiting_verification: { label: "Čeká na ověření", color: "bg-violet-100 text-violet-800 border-violet-300" },
  closed: { label: "Ukončeno", color: "bg-green-100 text-green-800 border-green-300" },
};

export const OVERDUE_STYLE = { label: "Po termínu", color: "bg-red-600 text-white border-red-700" };

export const OPEN_STATUSES = ["new", "assigned", "in_progress"];

export const ATTACHMENT_KINDS = {
  defect_protocol: "Protokol o závadě",
  photo_before: "Foto před opravou",
  repair_description: "Popis provedené opravy",
  repair_protocol: "Protokol o opravě a ukončení",
  photo_after: "Foto po opravě",
  component_proof: "Doklad o výměně komponentu",
  work_order: "Pracovní výkaz / zakázka",
  technician_protocol: "Protokol revizního technika",
  other: "Jiná dokumentace",
};

export const toIso = (d) => format(d, "yyyy-MM-dd");
export const todayIso = () => toIso(new Date());

export const fmtDate = (d) => (d ? format(new Date(d), "d. M. yyyy") : "—");

export const isDefectOverdue = (d) =>
  !!d.due_date && OPEN_STATUSES.includes(d.status || "new") && d.due_date < todayIso();

export const dueDateFor = (foundDate, classification) => {
  const days = CLASSIFICATIONS[classification]?.days;
  if (!foundDate || !days) return "";
  return toIso(addDays(new Date(foundDate), days));
};

export const nextRevisionFrom = (dateIso, months) => {
  if (!dateIso || !months) return "";
  return toIso(endOfMonth(addMonths(new Date(dateIso), months)));
};

export const daysUntil = (dateIso) => differenceInCalendarDays(new Date(dateIso), new Date());

export const userName = (users, email) => {
  const u = users.find((x) => x.email === email);
  return u ? u.custom_display_name || u.full_name || u.email : email || "—";
};