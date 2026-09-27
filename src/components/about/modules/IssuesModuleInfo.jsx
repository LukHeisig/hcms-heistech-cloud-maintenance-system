import React from "react";
import { AlertTriangle, GitBranch, Filter } from "lucide-react";
import { InfoSection, Bullets } from "@/components/about/revisions/InfoSection";

export default function IssuesModuleInfo() {
  return (
    <div>
      <InfoSection icon={AlertTriangle} iconClass="text-red-600" title="Správa závad – shrnutí">
        <p>
          Modul Správa závad zajišťuje rychlé nahlášení problému přímo z provozu a jeho dotažení až do vyřešení. Závadu může
          nahlásit kterýkoli uživatel ke konkrétnímu kontrolnímu bodu nebo k celému stroji, vedoucí ji posoudí a rozhodne o dalším postupu.
        </p>
        <Bullets items={[
          ["Nahlášení:", "popis závady, fotografie a zařazení do údržby – elektro nebo mechanická."],
          ["Počet čekajících:", "u položky Správa závad v menu je odznak s počtem nevyřešených nahlášených závad."],
          ["Přístup:", "posuzování a úpravy závad jsou vyhrazeny vedoucím, administrátorům a SuperAdminům."],
        ]} />
      </InfoSection>

      <InfoSection icon={GitBranch} iconClass="text-violet-600" title="Postup řešení závady">
        <ol className="space-y-2 list-decimal pl-5">
          <li><strong className="text-slate-800">Nahlášeno</strong> – závada čeká na posouzení vedoucím.</li>
          <li><strong className="text-slate-800">Vytvořen pracovní příkaz</strong> – ze závady vznikne pracovní příkaz s přiřazeným technikem a termínem; závada je s příkazem propojená.</li>
          <li><strong className="text-slate-800">Vyřešeno</strong> – závada je uzavřena s poznámkou k vyřešení; zaznamená se kdo a kdy ji vyřešil.</li>
        </ol>
        <p>Drobnou závadu lze vyřešit i přímo, bez vytváření pracovního příkazu.</p>
      </InfoSection>

      <InfoSection icon={Filter} iconClass="text-blue-600" title="Přehled a filtrování">
        <Bullets items={[
          ["Filtrování:", "podle stavu, linky, stroje a zařazení do údržby (elektro / mechanická)."],
          ["Detail závady:", "fotografie, umístění, historie a odkaz na navazující pracovní příkaz."],
          ["Historie stroje:", "vyřešené závady zůstávají dohledatelné v detailu stroje."],
        ]} />
      </InfoSection>
    </div>
  );
}