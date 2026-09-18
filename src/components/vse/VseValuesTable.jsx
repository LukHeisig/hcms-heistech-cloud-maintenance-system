import React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

function parse(json) {
  try { return JSON.parse(json || "[]"); } catch { return []; }
}

export default function VseValuesTable({ valuesJson }) {
  const values = parse(valuesJson);
  if (values.length === 0) {
    return <p className="text-sm text-slate-500 py-4 text-center">Žádné hodnoty</p>;
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Název</TableHead>
          <TableHead>Node ID</TableHead>
          <TableHead className="text-right">Hodnota</TableHead>
          <TableHead>Jednotka</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {values.map((v, i) => (
          <TableRow key={i}>
            <TableCell className="font-medium">{v.name}</TableCell>
            <TableCell className="font-mono text-xs text-slate-500">{v.node_id || "—"}</TableCell>
            <TableCell className="text-right font-mono">
              {typeof v.value === "number" ? v.value.toLocaleString("cs-CZ", { maximumFractionDigits: 3 }) : String(v.value)}
            </TableCell>
            <TableCell className="text-slate-500">{v.unit || ""}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}