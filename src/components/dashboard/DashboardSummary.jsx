import React from "react";
import { Link } from "react-router-dom";

export default function DashboardSummary({ items }) {
  return <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6">
    {items.map(({ label, value, icon: Icon, to, note, danger, onClick }) => {
      const content = <><div className="flex items-start justify-between gap-2"><p className="text-sm font-medium text-muted-foreground">{label}</p>{Icon && <Icon className={`w-5 h-5 shrink-0 ${danger ? "text-status-danger" : "text-dashboard-accent"}`} />}</div>
        <p className={`text-4xl font-bold mt-2 ${danger ? "text-status-danger" : "text-foreground"}`}>{value}</p>
        {note && <p className="text-xs text-muted-foreground mt-1">{note}</p>}</>;
      const className = "rounded-xl bg-card border border-border p-4 md:p-5 shadow-sm min-w-0";
      return to ? <Link key={label} to={to} className={`${className} hover:border-dashboard-accent`}>{content}</Link> : onClick ? <button key={label} type="button" onClick={onClick} className={`${className} text-left hover:border-dashboard-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`}>{content}</button> : <div key={label} className={className}>{content}</div>;
    })}
  </div>;
}