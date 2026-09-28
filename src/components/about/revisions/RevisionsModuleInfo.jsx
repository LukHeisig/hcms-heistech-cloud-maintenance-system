import React from "react";
import { ShieldCheck, FileText, Users, Bell, History } from "lucide-react";
import { InfoSection, Bullets } from "./InfoSection";
import RevisionWorkflowInfo from "./RevisionWorkflowInfo";
import RevisionRulesInfo from "./RevisionRulesInfo";
import { ATTACHMENT_KINDS } from "@/components/revisions/revisionConstants";

export default function RevisionsModuleInfo() {
  return (
    <div>
      <InfoSection icon={ShieldCheck} title="Modul Revize VTZ – shrnutí">
        <p>
          Modul Revize slouží k digitální evidenci revizních zpráv vyhrazených technických zařízení (VTZ) a k řízení odstraňování revizních závad
          od jejich zjištění až po ověřené ukončení. Nahrazuje papírové a tabulkové evidence, hlídá zákonné termíny a vytváří auditní stopu
          použitelnou při kontrolách (inspektorát práce, pojišťovna, interní audit).
        </p>
        <Bullets items={[
          ["Přehled:", "statistiky otevřených, po termínu a ukončených závad, seznam „Co je potřeba řešit“ a blížící se termíny revizí."],
          ["Revizní závady:", "kompletní seznam s filtrováním podle stavu, klasifikace, typu VTZ a fulltextovým vyhledáváním."],
          ["Revizní zprávy:", "evidence všech zpráv; u každé je vidět, zda jsou všechny závady ukončeny (✓ Vše ukončeno), nebo kolik jich zbývá (např. Zbývá ukončit 3 / 5)."],
        ]} />
      </InfoSection>

      <InfoSection icon={FileText} iconClass="text-indigo-600" title="Import revizní zprávy z PDF">
        <Bullets items={[
          ["Automatické vytěžení:", "po nahrání PDF umělá inteligence načte číslo zprávy, předmět, revizního technika, data revize, celkový posudek, závěr i jednotlivé závady s klasifikací."],
          ["Kontrola před uložením:", "vytěžená data se zobrazí k revizi a úpravě – nic se neuloží bez potvrzení uživatele."],
          ["Ruční zadání:", "zprávu lze zadat i ručně, pokud PDF není k dispozici nebo vytěžení selže."],
          ["Dopočty:", "termín odstranění závad a termín příští revize se předvyplní automaticky dle klasifikace a kategorie."],
          ["Archiv:", "původní PDF zůstává připojeno ke zprávě a lze jej kdykoli otevřít."],
        ]} />
      </InfoSection>

      <RevisionWorkflowInfo />
      <RevisionRulesInfo />

      <InfoSection icon={Users} iconClass="text-purple-600" title="Role a oprávnění">
        <Bullets items={[
          ["Vedoucí, Admin, SuperAdmin:", "zakládají a upravují revizní zprávy a závady, přidělují pracovníky, ověřují a ukončují závady, mohou vrátit závadu do řešení."],
          ["Přidělený pracovník:", "převezme závadu k řešení, vyplní způsob odstranění, nahraje přílohy a předá závadu k ověření. Ostatní údaje závady nemůže měnit."],
          ["Mazání zpráv:", "revizní zprávu (včetně jejích závad) smí smazat pouze SuperAdmin."],
          ["Oddělení dat:", "každý uživatel vidí pouze zprávy a závady svého podniku, resp. podniků, které má přiřazené."],
        ]} />
      </InfoSection>

      <InfoSection icon={Bell} iconClass="text-violet-600" title="Upozornění na úkoly">
        <Bullets items={[
          ["Ikona štítu v horní liště:", "zobrazuje počet čekajících úkolů a po rozkliknutí jejich seznam s termínem a označením po termínu."],
          ["Pracovník:", "vidí závady, které mu byly přiděleny a čekají na převzetí („K převzetí“)."],
          ["Vedoucí a admin:", "navíc vidí závady předané k ověření („K ověření“)."],
          ["Rychlý přístup:", "kliknutím na úkol se závada rovnou otevře. Počet úkolů se zobrazuje i u položky Revize v menu a obnovuje se automaticky."],
        ]} />
      </InfoSection>

      <InfoSection icon={History} iconClass="text-slate-700" title="Přílohy a auditní stopa">
        <p>Ke každé závadě lze připojit dokumentaci těchto typů: {Object.values(ATTACHMENT_KINDS).join(", ")}. U každé přílohy se eviduje, kdo a kdy ji nahrál.</p>
        <Bullets items={[
          ["Historie změn:", "každá změna zprávy i závady (stav, termín, přidělení, popis, přílohy) se zaznamená s původní a novou hodnotou, autorem a časem."],
          ["Přehled průběhu:", "v detailu závady je souhrnně vidět kdo ji převzal, kdy byla odstraněna, kdo ji potvrdil a kdo provedl následnou kontrolu."],
          ["Nezměnitelnost:", "záznamy historie nemohou běžní uživatelé upravovat ani mazat."],
        ]} />
      </InfoSection>
    </div>
  );
}