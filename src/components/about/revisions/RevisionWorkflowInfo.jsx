import React from "react";
import { GitBranch, ArrowRight } from "lucide-react";
import { InfoSection } from "./InfoSection";
import { STATUSES } from "@/components/revisions/revisionConstants";

const STEPS = [
  ["new", "Závada je založena z revizní zprávy (ručně nebo automaticky z PDF)."],
  ["assigned", "Vedoucí přidělí pracovníka – stav se nastaví automaticky. Pracovník dostane upozornění."],
  ["in_progress", "Pracovník tlačítkem „Převzít k řešení“ potvrdí, že na závadě pracuje. Vyplňuje popis opravy a nahrává přílohy."],
  ["awaiting_verification", "Tlačítkem „Předat k ověření“ pracovník opravu předá. Systém vyžaduje vyplněný popis opravy a alespoň jednu přílohu, automaticky doplní datum a jméno toho, kdo závadu odstranil."],
  ["closed", "Vedoucí nebo admin opravu zkontroluje a tlačítkem „Potvrdit a ukončit“ závadu uzavře, případně ji „Vrátí do řešení“."],
];

export default function RevisionWorkflowInfo() {
  return (
    <InfoSection icon={GitBranch} iconClass="text-violet-600" title="Životní cyklus revizní závady">
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {STEPS.map(([key], i) => (
          <React.Fragment key={key}>
            <span className={`px-3 py-1 rounded-full border text-xs font-semibold ${STATUSES[key].color}`}>{STATUSES[key].label}</span>
            {i < STEPS.length - 1 && <ArrowRight className="w-4 h-4 text-slate-400" />}
          </React.Fragment>
        ))}
      </div>
      <ol className="space-y-3">
        {STEPS.map(([key, text], i) => (
          <li key={key} className="flex gap-3">
            <span className="w-6 h-6 rounded-full bg-slate-900 text-white text-xs font-bold flex items-center justify-center shrink-0">{i + 1}</span>
            <span><strong className="text-slate-800">{STATUSES[key].label}:</strong> {text}</span>
          </li>
        ))}
      </ol>
      <p className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-3">
        Závada, která není odstraněna do termínu (stav Nová, Přiděleno nebo V řešení), je automaticky označena červeně jako <strong>Po termínu</strong> a řadí se na začátek seznamů.
      </p>
    </InfoSection>
  );
}