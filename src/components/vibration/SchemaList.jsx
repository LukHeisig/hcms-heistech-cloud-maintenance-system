import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2 } from "lucide-react";

export default function SchemaList({ schemas, onEdit, onDelete, emptyText, itemsLabel = "měřících bodů" }) {
  if (schemas.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-sm text-slate-500">
          {emptyText}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4">
      {schemas.map((sch) => {
        let rowsCount = 0;
        try { rowsCount = JSON.parse(sch.rows_definition).length; } catch (e) {}
        return (
          <Card key={sch.id}>
            <CardContent className="p-6 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-lg">{sch.name}</h3>
                <p className="text-sm text-slate-500">{sch.description}</p>
                <p className="text-xs text-slate-400 mt-1">{rowsCount} {itemsLabel}</p>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="icon" onClick={() => onEdit(sch)}>
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" className="text-red-600" onClick={() => onDelete(sch.id)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}