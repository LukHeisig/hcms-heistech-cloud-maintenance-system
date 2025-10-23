import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";

export default function IssueApproval() {
  const { data: issues = [] } = useQuery({
    queryKey: ["pendingIssues"],
    queryFn: () => base44.entities.Issue.filter({ status: "pending_approval" }),
  });

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-slate-900 mb-8">
          Závady ke schválení
        </h1>

        {issues.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <AlertTriangle className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">Nejsou žádné závady ke schválení</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {issues.map((issue) => (
              <Card key={issue.id}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-orange-700">
                    <AlertTriangle className="w-5 h-5" />
                    Závada #{issue.id.slice(0, 8)}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-slate-700">{issue.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}