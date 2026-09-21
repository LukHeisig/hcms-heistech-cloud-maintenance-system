import { format } from "date-fns";
import { cs } from "date-fns/locale";

const esc = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * Otevře tiskové okno s tabulkou kontrol — uživatel uloží jako PDF.
 * rows: [{ date, type, point, machine, line, user, note }]
 */
export function exportControlChecksPdf(rows, subtitle = "") {
  const headers = ["Datum", "Typ kontroly", "Kontrolní bod", "Popis", "Stroj", "Linka", "Uživatel", "Poznámka"];
  const body = rows.map(r => `<tr>${[r.date, r.type, r.point, r.description, r.machine, r.line, r.user, r.note].map(c => `<td>${esc(c)}</td>`).join("")}</tr>`).join("");
  const generated = format(new Date(), "d. M. yyyy HH:mm", { locale: cs });

  const html = `<!DOCTYPE html><html lang="cs"><head><meta charset="utf-8"><title>Statistiky kontrol</title>
<style>
  @page { size: A4 landscape; margin: 14mm; }
  body { font-family: Arial, Helvetica, sans-serif; color: #0f172a; font-size: 11px; }
  h1 { font-size: 18px; margin: 0 0 4px; }
  .meta { color: #64748b; margin-bottom: 12px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #cbd5e1; padding: 5px 6px; text-align: left; vertical-align: top; }
  th { background: #f1f5f9; font-weight: 600; }
  tr { page-break-inside: avoid; }
  thead { display: table-header-group; }
</style></head><body>
<h1>HCMS – Statistiky kontrol</h1>
<div class="meta">Vygenerováno: ${esc(generated)} · Počet záznamů: ${rows.length}${subtitle ? ` · ${esc(subtitle)}` : ""}</div>
<table><thead><tr>${headers.map(h => `<th>${h}</th>`).join("")}</tr></thead><tbody>${body}</tbody></table>
<script>window.onload = () => { window.focus(); window.print(); };</script>
</body></html>`;

  const win = window.open("", "_blank");
  if (!win) return;
  win.document.open();
  win.document.write(html);
  win.document.close();
}