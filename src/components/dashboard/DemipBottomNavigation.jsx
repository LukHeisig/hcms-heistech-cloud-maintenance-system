import React from "react";
import { ArrowLeft, ClipboardList, Menu, Nfc, Wrench } from "lucide-react";

export default function DemipBottomNavigation({ pathname, search, onOverview, onMenu, onOrders, onBack, onScan }) {
  const items = [
    { label: "Přehled", icon: ClipboardList, onClick: onOverview, active: pathname === "/" || pathname.includes("Dashboard") },
    { label: "Menu", icon: Menu, onClick: onMenu },
    { label: "Příkazy", icon: Wrench, onClick: onOrders, active: pathname.includes("MobileHome") && search.includes("tab=orders") },
    { label: "Zpět", icon: ArrowLeft, onClick: onBack },
    { label: "Skenovat", icon: Nfc, onClick: onScan },
  ];
  return (
    <nav aria-label="Spodní navigace DEMIP" className="fixed bottom-0 left-0 right-0 z-40 grid h-[calc(3.75rem+env(safe-area-inset-bottom))] grid-cols-5 border-t border-border bg-card px-2 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] text-card-foreground shadow-sm">
      {items.map(({ label, icon: Icon, onClick, active }) => (
        <button key={label} type="button" onClick={onClick} aria-current={active ? "page" : undefined}
          className={`flex min-h-11 min-w-0 flex-col items-center justify-center gap-1 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${active ? "text-demip-brand" : "text-muted-foreground hover:text-demip-brand"}`}>
          <Icon className="h-6 w-6 shrink-0" aria-hidden="true" />
          <span className="w-full text-center text-[10px] font-medium">{label}</span>
        </button>
      ))}
    </nav>
  );
}