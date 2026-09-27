import React from "react";
import { ClipboardList, ListChecks, Bell } from "lucide-react";
import { InfoSection, Bullets } from "@/components/about/revisions/InfoSection";

export default function WorkOrdersModuleInfo() {
  return (
    <div>
      <InfoSection icon={ClipboardList} iconClass="text-orange-600" title="Pracovní příkazy – shrnutí">
        <p>
          Pracovní příkazy slouží k plánování a řízení údržbových prací na strojích. Vedoucí naplánuje úkol, přiřadí jej
          technikovi a stanoví termín; technik jej provede a dokončením automaticky vznikne záznam o údržbě v historii stroje.
        </p>
        <Bullets items={[
          ["Typy údržby:", "preventivní, reaktivní (oprava), prediktivní a inspekce."],
          ["Parametry:", "název, popis práce, stroj, plánované datum, priorita (nízká / střední / vysoká), odhad doby trvání a nákladů."],
          ["Opakované úkoly:", "lze nastavit interval opakování ve dnech."],
          ["Vazba na závady:", "příkaz může vzniknout přímo z nahlášené závady a zůstává s ní propojen."],
        ]} />
      </InfoSection>

      <InfoSection icon={ListChecks} iconClass="text-green-600" title="Stavy příkazu">
        <Bullets items={[
          ["Plánováno:", "úkol je naplánován, zatím bez přiřazeného technika."],
          ["Přiřazeno:", "úkol má odpovědného technika a čeká na provedení; po uplynutí data je označen jako po termínu."],
          ["Dokončeno:", "práce je hotová, zaznamená se čas dokončení a vytvoří se záznam o údržbě."],
          ["Zrušeno:", "úkol se nebude provádět."],
        ]} />
      </InfoSection>

      <InfoSection icon={Bell} iconClass="text-amber-600" title="Upozornění technika">
        <p>
          Technik vidí v horní liště zvonek s počtem svých aktivních příkazů. Po rozkliknutí zobrazí jejich seznam se strojem,
          plánovaným datem a označením po termínu; kliknutím se otevře údržba daného stroje. Počet příkazů je uveden i u položky
          Pracovní příkazy v menu a v mobilním režimu DEMIP jsou příkazy dostupné ze spodní lišty.
        </p>
      </InfoSection>
    </div>
  );
}