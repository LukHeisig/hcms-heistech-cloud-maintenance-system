import React, { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, AlertTriangle, ShieldCheck } from "lucide-react";
import RevisionStats from "@/components/revisions/RevisionStats";
import UpcomingRevisions from "@/components/revisions/UpcomingRevisions";
import DefectsTable from "@/components/revisions/DefectsTable";
import ReportsTable from "@/components/revisions/ReportsTable";
import ReportImportDialog from "@/components/revisions/ReportImportDialog";
import ReportEditDialog from "@/components/revisions/ReportEditDialog";
import DefectDetailDialog from "@/components/revisions/DefectDetailDialog";

export default function Revisions() {
  const qc = useQueryClient();
  const [user, setUser] = useState(null);
  const [companyId, setCompanyId] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [openReport, setOpenReport] = useState(null);
  const [openDefect, setOpenDefect] = useState(null);
  const [params, setParams] = useSearchParams();

  useEffect(() => { base44.auth.me().then(setUser); }, []);
  const isGlobal = ["superAdmin", "admin"].includes(user?.user_type);
  const canEdit = ["superAdmin", "admin", "manager"].includes(user?.user_type);

  const { data: companies = [] } = useQuery({
    queryKey: ["companies"],
    queryFn: () => base44.entities.Company.list(null, 1000),
    enabled: !!user,
  });

  const companyOptions = useMemo(() => {
    const enabled = companies.filter((c) => c.enable_revisions);
    if (user?.user_type === "superAdmin") return enabled;
    if (user?.user_type === "admin") return enabled.filter((c) => (user.assigned_company_ids || []).includes(c.id));
    return enabled.filter((c) => c.id === user?.company_id);
  }, [companies, user]);

  useEffect(() => {
    if (!user || companyId) return;
    if (companyOptions.length) setCompanyId(companyOptions[0].id);
  }, [user, isGlobal, companyOptions, companyId]);

  const { data: reports = [], isLoading: loadingReports } = useQuery({
    queryKey: ["revisionReports", companyId],
    queryFn: () => base44.entities.RevisionReport.filter({ company_id: companyId }, "-created_date", 1000),
    enabled: !!companyId,
  });
  const { data: defects = [], isLoading: loadingDefects } = useQuery({
    queryKey: ["revisionDefects", companyId],
    queryFn: () => base44.entities.RevisionDefect.filter({ company_id: companyId }, "-created_date", 5000),
    enabled: !!companyId,
  });
  const { data: users = [] } = useQuery({
    queryKey: ["revisionUsers"],
    queryFn: async () => (await base44.functions.invoke("getUsers")).data || [],
    enabled: !!user,
    staleTime: 300000,
  });

  // Otevření závady z notifikace (?company=...&defect=...)
  useEffect(() => {
    const c = params.get("company");
    if (c) setCompanyId(c);
  }, [params]);
  useEffect(() => {
    const id = params.get("defect");
    const d = id && defects.find((x) => x.id === id);
    if (d) { setOpenDefect(d); setParams({}, { replace: true }); }
  }, [params, defects]);

  const reportOf = (d) => reports.find((r) => r.id === d?.report_id);
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["revisionReports"] });
    qc.invalidateQueries({ queryKey: ["revisionDefects"] });
  };

  if (!user) return <div className="p-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>;

  return (
    <div className="p-4 md:p-8 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-2"><ShieldCheck className="w-8 h-8 text-blue-600" /> Revize VTZ</h1>
            <p className="text-slate-600 mt-1">Evidence revizních zpráv a revizních závad</p>
          </div>
          <div className="flex items-center gap-2">
            {isGlobal && (
              <Select value={companyId} onValueChange={setCompanyId}>
                <SelectTrigger className="w-64"><SelectValue placeholder="Vyberte podnik" /></SelectTrigger>
                <SelectContent>{companyOptions.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            )}
            {canEdit && companyId && (
              <Button onClick={() => setImportOpen(true)} className="bg-blue-600 hover:bg-blue-700 gap-2">
                <Plus className="w-4 h-4" /> Nová revizní zpráva
              </Button>
            )}
          </div>
        </div>

        {!companyId ? (
          <Card><CardContent className="p-12 text-center text-slate-500">Není vybrán podnik s aktivním modulem Revize.</CardContent></Card>
        ) : loadingReports || loadingDefects ? (
          <div className="p-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>
        ) : (
          <Tabs defaultValue="overview">
            <TabsList>
              <TabsTrigger value="overview">Přehled</TabsTrigger>
              <TabsTrigger value="defects">Revizní závady ({defects.length})</TabsTrigger>
              <TabsTrigger value="reports">Revizní zprávy ({reports.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6 mt-4">
              <RevisionStats reports={reports} defects={defects} />
              <div className="grid lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-2">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-red-600" /> Co je potřeba řešit
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <DefectsTable defects={defects} reports={reports} users={users} onOpen={setOpenDefect} initialStatus="open" />
                  </CardContent>
                </Card>
                <UpcomingRevisions reports={reports} onOpen={setOpenReport} />
              </div>
            </TabsContent>

            <TabsContent value="defects" className="mt-4">
              <DefectsTable defects={defects} reports={reports} users={users} onOpen={setOpenDefect} />
            </TabsContent>

            <TabsContent value="reports" className="mt-4">
              <ReportsTable reports={reports} defects={defects} onOpen={setOpenReport} />
            </TabsContent>
          </Tabs>
        )}
      </div>

      <ReportImportDialog open={importOpen} onOpenChange={setImportOpen} companyId={companyId} user={user} onSaved={refresh} />
      {openReport && (
        <ReportEditDialog report={openReport} defects={defects} users={users} user={user} canEdit={canEdit} canDelete={user?.user_type === "superAdmin"}
          onClose={() => setOpenReport(null)}
          onOpenDefect={(d) => { setOpenReport(null); setOpenDefect(d); }} />
      )}
      {openDefect && (
        <DefectDetailDialog defect={openDefect} report={reportOf(openDefect)} users={users} user={user} canEdit={canEdit}
          onClose={() => setOpenDefect(null)} />
      )}
    </div>
  );
}