import React from "react";
import { Link } from "react-router-dom";
import { Menu } from "lucide-react";

export default function LeftMobileNavigation({ items, pathname, onOpen }) {
  return <nav aria-label="Mobilní navigace" className="lg:hidden fixed inset-y-0 left-0 z-50 w-14 bg-card border-r border-border flex flex-col items-center gap-2 py-3 overflow-y-auto">
    <button aria-label="Otevřít menu" onClick={onOpen} className="p-3 rounded-lg text-foreground hover:bg-muted"><Menu className="w-5 h-5" /></button>
    {items.map(item => <Link key={item.title} to={item.url} title={item.title} aria-label={item.title} aria-current={pathname === item.url || (pathname === "/" && item.title === "Dashboard") ? "page" : undefined}
      className={`relative p-3 rounded-lg ${pathname === item.url || (pathname === "/" && item.title === "Dashboard") ? "bg-dashboard-background text-dashboard-accent" : "text-muted-foreground hover:bg-muted"}`}>
      <item.icon className="w-5 h-5" />{item.badge > 0 && <span className="absolute right-1 top-1 w-2 h-2 bg-status-danger rounded-full" />}
    </Link>)}
  </nav>;
}