import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle } from "lucide-react";

export function InfoSection({ icon: Icon, iconClass = "text-blue-600", title, children }) {
  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="text-xl flex items-center gap-3"><Icon className={`w-6 h-6 ${iconClass}`} /> {title}</CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-slate-600 space-y-3">{children}</CardContent>
    </Card>
  );
}

export function Bullets({ items }) {
  return (
    <ul className="space-y-2">
      {items.map(([title, text]) => (
        <li key={title} className="flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 shrink-0" />
          <span><strong className="text-slate-800">{title}</strong> {text}</span>
        </li>
      ))}
    </ul>
  );
}