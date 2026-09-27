import React from "react";
import { Droplet, ScanLine as Nfc, Clock, Smartphone } from "lucide-react";
import { InfoSection, Bullets } from "@/components/about/revisions/InfoSection";

export default function DemipModuleInfo() {
  return (
    <div>
      <InfoSection icon={Droplet} iconClass="text-blue-600" title="DEMIP – shrnutí">
        <p>
          DEMIP je modul pro řízení mazacích, inspekčních a preventivních plánů. Každý stroj obsahuje kontrolní body s předepsaným
          intervalem a pracovníci jejich provedení potvrzují přímo u stroje – ideálně načtením NFC čipu, čímž je prokázáno,
          že byli fyzicky na místě. Systém průběžně ukazuje, které body jsou v pořádku, blíží se termínu nebo jsou po termínu.
        </p>
        <Bullets items={[
          ["Struktura:", "podnik → linka → stroj (případně podřízená sekce) → kontrolní bod."],
          ["Režim DEMIP:", "zjednodušené mobilní rozhraní pro techniky se spodní lištou Skenovat, Přehled, Příkazy, Menu a Odhlásit."],
          ["Vynucení režimu:", "podnik může technikům na mobilu režim DEMIP vynutit."],
        ]} />
      </InfoSection>

      <InfoSection icon={Clock} iconClass="text-amber-600" title="Typy kontrolních bodů a intervaly">
        <Bullets items={[
          ["Mazání:", "s typem maziva a množstvím v gramech."],
          ["Inspekce a prevence:", "s popisem činností; prevenci lze potvrzovat NFC nebo ručně."],
          ["Automatické maznice:", "sledování výměny a kontroly automatických maznic."],
          ["Interval v hodinách:", "počítá se od posledního potvrzení (u nového bodu od prvního potvrzení)."],
          ["Dny odstávky linky:", "u linky lze vyloučit dny v týdnu, kdy linka stojí – ty se do intervalu nezapočítávají."],
          ["Vizualizace:", "dvoubarevná (v pořádku / po termínu) nebo semafor se žlutou tolerancí v procentech intervalu a minimálním žlutým oknem pro krátké intervaly."],
        ]} />
      </InfoSection>

      <InfoSection icon={Nfc} iconClass="text-indigo-600" title="Potvrzení pomocí NFC">
        <Bullets items={[
          ["Rychlé skenování:", "po přiložení čipu aplikace sama najde kontrolní bod, stroj a linku a otevře jej."],
          ["Kontrola oprávnění:", "technik může potvrdit jen body svého podniku."],
          ["Ruční potvrzení:", "podnik může povolit potvrzení bez NFC (např. při poškozeném čipu)."],
          ["NFC log:", "každé skenování se zaznamená včetně výsledku a zařízení pro dohledání problémů."],
        ]} />
      </InfoSection>

      <InfoSection icon={Smartphone} iconClass="text-green-600" title="Práce v terénu">
        <p>
          Při kontrole lze rovnou nahlásit závadu s fotografií. Rozhraní je optimalizované pro telefony a tablety
          a NFC skenování funguje v prohlížeči Chrome na zařízeních s Androidem.
        </p>
      </InfoSection>
    </div>
  );
}