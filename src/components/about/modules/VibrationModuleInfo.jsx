import React from "react";
import { Radio, Gauge, Bell, BrainCircuit, Cpu } from "lucide-react";
import { InfoSection, Bullets } from "@/components/about/revisions/InfoSection";

export default function VibrationModuleInfo() {
  return (
    <div>
      <InfoSection icon={Radio} iconClass="text-rose-600" title="Vibrace online – shrnutí">
        <p>
          Modul Vibrace online zajišťuje nepřetržité sledování vibrací strojů pomocí bezdrátových senzorů Aissens a průmyslových
          jednotek ifm VSE. Data se automaticky přijímají, vyhodnocují proti normám a při překročení limitů systém vyvolá alarm.
          Cílem je odhalit vznikající poruchu (ložiska, nevyváženost, uvolnění, nesouosost) dříve, než způsobí neplánovanou odstávku.
        </p>
        <Bullets items={[
          ["Přehled strojů:", "stroje s vibračním monitoringem seskupené podle podniku a linky, s okamžitým semaforem stavu."],
          ["Stav senzoru:", "Online (data do 12 h), Nedávno (12–24 h), Offline (více než 24 h), dále baterie, teplota a síla signálu."],
          ["Dostupnost:", "modul se zapíná pro každý podnik zvlášť; bez aktivního modulu není položka v menu ani vibrační alarmy v hlavičce."],
        ]} />
      </InfoSection>

      <InfoSection icon={Gauge} iconClass="text-blue-600" title="Měřené veličiny a vyhodnocení">
        <Bullets items={[
          ["Rychlost vibrací (Vel X/Y/Z):", "efektivní hodnota v mm/s – základní ukazatel celkového stavu stroje."],
          ["Zrychlení (Acc Z) a obálka (Obálka Z):", "zobrazované v jednotkách g – citlivé na rané poškození ložisek a ozubení."],
          ["Teplota:", "teplota v místě senzoru."],
          ["Normy a pásma A/B/C/D:", "každé měřicí místo má přiřazené normy pro rychlost, zrychlení a teplotu. Pásmo A/B = zelená (v pořádku), C = žlutá (upozornění), D = červená (kritické)."],
          ["Schémata měření:", "stroj má definovaná měřicí místa (např. motor, převodovka) a směry, ke kterým se přiřazují senzory."],
        ]} />
      </InfoSection>

      <InfoSection icon={Cpu} iconClass="text-indigo-600" title="Trend, spektrum a ložiska">
        <Bullets items={[
          ["Trend:", "vývoj hodnot v čase s vyznačenými limity norem, všechny osy grafů s jednotkami."],
          ["Spektrum (FFT):", "frekvenční analýza zrychlení, rychlosti a obálky pro určení zdroje vibrací."],
          ["Databáze ložisek:", "katalog cca 31 tisíc ložisek s poruchovými frekvencemi BPFO, BPFI, BSF a FTF."],
          ["Kurzory poruchových frekvencí:", "ve spektru lze kliknutím zapnout značky frekvencí ložiska i jejich harmonických (výchozí stav vypnuto)."],
          ["Jednotky ifm VSE:", "data přes OPC UA bridge, přiřazení proměnných k měřicím místům a SCADA vizualizace stavů."],
        ]} />
      </InfoSection>

      <InfoSection icon={Bell} iconClass="text-red-600" title="Alarmy a notifikace">
        <Bullets items={[
          ["Automatické alarmy:", "při překročení pásma B, C nebo D vznikne alarm s hodnotou, metrikou a měřicím místem."],
          ["Zpoždění alarmu:", "u stroje lze nastavit, kolik po sobě jdoucích měření musí limit překročit, aby se alarm aktivoval – eliminuje falešné poplachy."],
          ["Kvitování:", "aktivní alarm blokuje vznik stejného alarmu; po kvitování (s poznámkou) se zaznamená kdo a kdy jej potvrdil."],
          ["Příjemci:", "e-mailové notifikace lze nastavit na podnik, linku či stroj a zvlášť pro pásmo C a D."],
          ["Ikona zvonku:", "v horní liště ukazuje počet aktivních vibračních alarmů."],
        ]} />
      </InfoSection>

      <InfoSection icon={BrainCircuit} iconClass="text-purple-600" title="AI diagnostika">
        <p>
          Pokud má podnik aktivní modul AI prediktivní analýzy, lze nad naměřeným spektrem spustit AI diagnostiku. Před analýzou se
          automaticky určí provozní otáčky ze spektra rychlosti, AI využije poruchové frekvence přiřazeného ložiska a vrátí
          pravděpodobnou příčinu, závažnost a doporučení údržby.
        </p>
      </InfoSection>
    </div>
  );
}