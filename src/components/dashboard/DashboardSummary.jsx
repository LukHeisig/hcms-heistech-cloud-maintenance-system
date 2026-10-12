import React from "react";
import { Link } from "react-router-dom";

export default function DashboardSummary({ items }) {
  return <div className="op-summary">
    {items.map(({ label, value, icon: Icon, to, note, danger, onClick }) => {
      const content = <><div className="op-ml"><p>{label}</p>{Icon && <Icon className={`op-ico ${danger ? "op-danger" : ""}`} />}</div>
        <p className={`op-mv ${danger ? "op-danger" : ""}`}>{value}</p>
        {note && <p className="op-mn">{note}</p>}</>;
      const className = "op-m";
      return to ? <Link key={label} to={to} className={`${className} hover:border-dashboard-accent`}>{content}</Link> : onClick ? <button key={label} type="button" onClick={onClick} className={`${className} text-left hover:border-dashboard-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`}>{content}</button> : <div key={label} className={className}>{content}</div>;
    })}
  </div>;
}