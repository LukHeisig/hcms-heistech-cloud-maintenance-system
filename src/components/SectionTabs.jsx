import React from "react";
import { useSearchParams } from "react-router-dom";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export default function SectionTabs({ title, description, sections }) {
  const [params, setParams] = useSearchParams();
  const active = sections.find(section => section.value === params.get("tab")) || sections[0];
  if (!active) return null;
  const choose = value => setParams(previous => {
    const next = new URLSearchParams(previous);
    next.set("tab", value);
    return next;
  });
  const Content = active.component;
  return <div className="p-4 md:p-8 bg-background min-h-screen">
    <div className="max-w-7xl mx-auto min-w-0">
      <header className="mb-6">
        <h1 className="text-3xl font-bold text-foreground">{title}</h1>
        {description && <p className="text-muted-foreground mt-2">{description}</p>}
      </header>
      <Tabs value={active.value} onValueChange={choose}>
        <div className="overflow-x-auto mb-6">
          <TabsList aria-label={title} className="h-auto justify-start gap-1">
            {sections.map(({ value, label, icon: Icon }) => <TabsTrigger key={value} value={value} className="gap-2 px-4 py-3">
              <Icon className="w-4 h-4 shrink-0" />{label}
            </TabsTrigger>)}
          </TabsList>
        </div>
        <TabsContent key={active.value} value={active.value}>
          <Content embedded />
        </TabsContent>
      </Tabs>
    </div>
  </div>;
}