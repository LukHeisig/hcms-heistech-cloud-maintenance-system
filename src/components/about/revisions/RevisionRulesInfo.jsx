import React from "react";
import { CalendarClock } from "lucide-react";
import { InfoSection } from "./InfoSection";
import { CATEGORIES, CLASSIFICATIONS, VTZ_TYPES } from "@/components/revisions/revisionConstants";

export default function RevisionRulesInfo() {
  return (
    <InfoSection icon={CalendarClock} iconClass="text-amber-600" title="Typy VTZ, klasifikace závad a intervaly revizí">
      <p><strong className="text-slate-800">Podporované typy VTZ:</strong> {Object.values(VTZ_TYPES).join(", ")}.</p>
      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <h4 className="font-semibold text-slate-900 mb-2">Klasifikace závad a výchozí termín odstranění</h4>
          <table className="w-full text-sm border rounded-lg overflow-hidden">
            <tbody>
              {Object.entries(CLASSIFICATIONS).map(([k, c]) => (
                <tr key={k} className="border-t">
                  <td className="p-2"><span className={`px-2 py-0.5 rounded border text-xs font-semibold ${c.color}`}>{k}</span></td>
                  <td className="p-2">{c.label.split("–")[1]?.trim()}</td>
                  <td className="p-2 whitespace-nowrap font-medium">{c.days} dní</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs">Termín se počítá od data zjištění a lze jej ručně upravit.</p>
        </div>
        <div>
          <h4 className="font-semibold text-slate-900 mb-2">Výchozí intervaly revizí dle kategorie</h4>
          <table className="w-full text-sm border rounded-lg overflow-hidden">
            <tbody>
              {Object.entries(CATEGORIES).map(([k, c]) => (
                <tr key={k} className="border-t">
                  <td className="p-2">{c.label}</td>
                  <td className="p-2 whitespace-nowrap font-medium">{c.months ? `${c.months} měs.` : "individuálně"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs">Termín příští revize se dopočítá ke konci měsíce od data ukončení revize. Revize do 90 dní jsou zvýrazněny oranžově, prošlé červeně.</p>
        </div>
      </div>
    </InfoSection>
  );
}