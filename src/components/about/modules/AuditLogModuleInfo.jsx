import React from "react";
import { Activity, BarChart3, Lock } from "lucide-react";
import { InfoSection, Bullets } from "@/components/about/revisions/InfoSection";

export default function AuditLogModuleInfo() {
  return (
    <div>
      <InfoSection icon={Activity} iconClass="text-slate-700" title="Audit Log – shrnutí">
        <p>
          Audit Log je centrální záznam aktivit v systému. Odpovídá na otázky kdo, co, kdy a v jaké roli změnil. Slouží pro
          zpětnou kontrolu, dohledání chyb, interní audity i doložení plnění údržbových povinností. Je dostupný vedoucím,
          administrátorům a SuperAdminům.
        </p>
        <Bullets items={[
          ["Zaznamenávané oblasti:", "podniky, linky, stroje, kontrolní body, závady, uživatelé a přihlášení."],
          ["Obsah záznamu:", "popis změny, e-mail a role uživatele v době změny, podnik a čas."],
          ["Filtrování:", "podle typu záznamu, uživatele a období."],
        ]} />
      </InfoSection>

      <InfoSection icon={BarChart3} iconClass="text-blue-600" title="Statistiky kontrol a aktivita uživatelů">
        <Bullets items={[
          ["Statistiky kontrol:", "přehled provedených kontrol a mazání podle linek, strojů a pracovníků za zvolené období."],
          ["Export do PDF:", "statistiky kontrol lze exportovat jako podklad pro reporting a audit."],
          ["Aktivita uživatelů:", "kdo je online, kdy byl naposledy aktivní a kolik úkonů provedl."],
        ]} />
      </InfoSection>

      <InfoSection icon={Lock} iconClass="text-green-600" title="Ochrana záznamů">
        <p>
          Každý uživatel vidí pouze záznamy svého podniku, resp. přiřazených podniků. Záznamy nemohou běžní uživatelé měnit
          ani mazat – úpravy jsou vyhrazeny pouze SuperAdminovi. Revizní modul navíc vede vlastní podrobnou historii změn
          s původní a novou hodnotou.
        </p>
      </InfoSection>
    </div>
  );
}