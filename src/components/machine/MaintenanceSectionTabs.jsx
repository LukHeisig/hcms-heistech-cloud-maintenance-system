import React from "react";
import { Calendar, Wrench, AlertTriangle, ClipboardCheck, TrendingUp } from "lucide-react";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function MaintenanceSectionTabs({ taskCount, issueCount, inspectionCount }) {
  const items = [
    { value: "planned", icon: Calendar, label: `Plánovaná údržba (${taskCount})` },
    { value: "history", icon: Wrench, label: "Historie údržby" },
    { value: "active-issues", icon: AlertTriangle, label: `Aktivní závady (${issueCount})` },
    { value: "inspections", icon: ClipboardCheck, label: `Inspekce (${inspectionCount})` },
    { value: "costs", icon: TrendingUp, label: "Náklady" },
  ];
  return (
    <TabsList className="grid h-auto w-full min-w-0 grid-cols-2 gap-1 bg-card p-1 shadow-sm md:grid-cols-5">
      {items.map(({ value, icon: Icon, label }) => (
        <TabsTrigger key={value} value={value}
          className={`min-h-9 min-w-0 gap-1 whitespace-normal px-2 py-2 text-xs leading-snug md:gap-2 md:text-sm ${value === "costs" ? "col-span-2 md:col-span-1" : ""}`}>
          <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="min-w-0 [overflow-wrap:anywhere]">{label}</span>
        </TabsTrigger>
      ))}
    </TabsList>
  );
}