import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { VTZ_TYPES, CATEGORIES, nextRevisionFrom } from "./revisionConstants";

const Field = ({ label, children, className = "" }) => (
  <div className={className}><Label className="text-xs">{label}</Label>{children}</div>
);

export default function ReportForm({ value, onChange, disabled }) {
  const set = (patch) => onChange({ ...value, ...patch });
  const txt = (key) => ({ value: value[key] || "", disabled, onChange: (e) => set({ [key]: e.target.value }) });

  const setCategory = (category) => {
    const months = CATEGORIES[category]?.months;
    const patch = { category };
    if (months) {
      patch.interval_months = months;
      patch.next_revision_date = nextRevisionFrom(value.revision_date_to || value.revision_date_from, months) || value.next_revision_date;
    }
    set(patch);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <Field label="Číslo revizní zprávy *"><Input {...txt("report_number")} /></Field>
      <Field label="Typ VTZ *">
        <Select value={value.vtz_type || "electro"} onValueChange={(v) => set({ vtz_type: v })} disabled={disabled}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{Object.entries(VTZ_TYPES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
        </Select>
      </Field>
      <Field label="Předmět revize / zařízení" className="md:col-span-2"><Input {...txt("subject")} /></Field>
      <Field label="Kategorie (výchozí interval)">
        <Select value={value.category || ""} onValueChange={setCategory} disabled={disabled}>
          <SelectTrigger><SelectValue placeholder="Vyberte..." /></SelectTrigger>
          <SelectContent>
            {Object.entries(CATEGORIES).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.label}{v.months ? ` – ${v.months / 12} ${v.months === 12 ? "rok" : "roky"}` : ""}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Druh revize"><Input {...txt("revision_kind")} placeholder="pravidelná" /></Field>
      <Field label="Revizní technik"><Input {...txt("technician_name")} /></Field>
      <Field label="Ev. č. revizního technika"><Input {...txt("technician_reg_no")} /></Field>
      <Field label="Revize provedena od"><Input type="date" {...txt("revision_date_from")} /></Field>
      <Field label="Revize ukončena dne"><Input type="date" {...txt("revision_date_to")} /></Field>
      <Field label="Předchozí revize"><Input type="date" {...txt("previous_revision_date")} /></Field>
      <Field label="Vyhotovení zprávy"><Input type="date" {...txt("report_date")} /></Field>
      <Field label="Interval (měsíce)">
        <Input type="number" disabled={disabled} value={value.interval_months ?? ""}
          onChange={(e) => set({ interval_months: e.target.value ? Number(e.target.value) : null })} />
      </Field>
      <Field label="Termín příští revize"><Input type="date" {...txt("next_revision_date")} /></Field>
      <Field label="Odpovědná osoba / útvar za zařízení" className="md:col-span-2"><Input {...txt("responsible_person")} /></Field>
      <Field label="Celkový posudek" className="md:col-span-2"><Textarea rows={2} {...txt("overall_assessment")} /></Field>
      <Field label="Závěr" className="md:col-span-2"><Textarea rows={2} {...txt("conclusion")} /></Field>
      <Field label="Poznámka" className="md:col-span-2"><Textarea rows={2} {...txt("notes")} /></Field>
    </div>
  );
}