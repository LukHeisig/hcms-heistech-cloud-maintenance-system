import React from "react";
import { Badge } from "@/components/ui/badge";
import { STATUSES, OVERDUE_STYLE, CLASSIFICATIONS, isDefectOverdue } from "./revisionConstants";

export function DefectStatusBadge({ defect }) {
  const st = STATUSES[defect.status || "new"];
  return (
    <div className="flex flex-wrap gap-1">
      <Badge variant="outline" className={st.color}>{st.label}</Badge>
      {isDefectOverdue(defect) && (
        <Badge variant="outline" className={OVERDUE_STYLE.color}>{OVERDUE_STYLE.label}</Badge>
      )}
    </div>
  );
}

export function ClassificationBadge({ value }) {
  const c = CLASSIFICATIONS[value];
  if (!c) return null;
  return <Badge variant="outline" className={`${c.color} font-bold`}>{value}</Badge>;
}

export default DefectStatusBadge;