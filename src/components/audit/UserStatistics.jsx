import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, BarChart3, Calendar, Building2, Download } from "lucide-react";
import { startOfDay, startOfWeek, startOfMonth, isAfter } from "date-fns";

export function UserStatistics({ users, allLogs, companies }) {
  const [timeRange, setTimeRange] = useState('month'); // day, week, month
  const [companyFilter, setCompanyFilter] = useState('all');

  const { data: controlRecords = [], isLoading: isLoadingRecords } = useQuery({
    queryKey: ['controlRecordsStats'],
    queryFn: () => base44.entities.ControlRecord.list('-performed_at', 5000),
    staleTime: 300000,
  });

  // Načíst Auth logy samostatně s vyšším limitem (allLogs je omezeno na 1000 celkem)
  const { data: authLogs = [], isLoading: isLoadingAuthLogs } = useQuery({
    queryKey: ['authLogsStats'],
    queryFn: () => base44.entities.AuditLog.filter({ entity_type: 'Auth' }, '-created_date', 10000),
    staleTime: 60000,
  });

  const { data: issues = [], isLoading: isLoadingIssues } = useQuery({
    queryKey: ['issuesStats'],
    queryFn: () => base44.entities.Issue.list('-created_date', 5000),
    staleTime: 300000,
  });

  const stats = useMemo(() => {
    const now = new Date();
    let startDate;
    
    switch (timeRange) {
      case 'day':
        startDate = startOfDay(now);
        break;
      case 'week':
        startDate = startOfWeek(now, { weekStartsOn: 1 });
        break;
      case 'month':
      default:
        startDate = startOfMonth(now);
        break;
    }

    // Use dedicated authLogs (higher limit) filtered by time range
    const relevantLogs = authLogs.filter(log => 
      new Date(log.created_date) >= startDate
    );

    // Filter records for confirmations
    const relevantRecords = controlRecords.filter(record => 
      new Date(record.performed_at) >= startDate
    );

    // Group by user
    const userStats = {};

    // Initialize for all visible users
    users.filter(user => {
      if (companyFilter === 'all') return true;
      // Check direct company_id
      if (user.company_id === companyFilter) return true;
      // Check assigned companies
      if (Array.isArray(user.assigned_company_ids) && user.assigned_company_ids.includes(companyFilter)) return true;
      return false;
    }).forEach(user => {
      const email = user.email?.toLowerCase();
      userStats[email] = {
        email: email,
        name: user.custom_display_name || user.full_name || user.email,
        role: user.user_type,
        company_id: user.company_id,
        logins: 0,
        confirmations: 0,
        issuesReported: 0,
        total: 0
      };
    });

    // Count logins
    relevantLogs.forEach(log => {
      const email = log.changed_by?.toLowerCase();
      if (userStats[email]) {
        userStats[email].logins++;
      }
    });

    // Count confirmations - match case-insensitively
    relevantRecords.forEach(record => {
      const email = record.created_by?.toLowerCase();
      if (email && userStats[email]) {
        userStats[email].confirmations++;
      }
    });

    // Count reported issues
    const relevantIssues = issues.filter(issue =>
      new Date(issue.created_date) >= startDate
    );
    relevantIssues.forEach(issue => {
      const email = issue.created_by?.toLowerCase();
      if (email && userStats[email]) {
        userStats[email].issuesReported++;
      }
    });

    // Convert to array and sort
    return Object.values(userStats)
      .map(stat => ({
        ...stat,
        total: stat.logins + stat.confirmations + stat.issuesReported
      }))
      .sort((a, b) => b.confirmations - a.confirmations || b.logins - a.logins);

  }, [users, authLogs, controlRecords, issues, timeRange, companyFilter]);

  const chartData = useMemo(() => {
    return stats.slice(0, 10); // Top 10 users
  }, [stats]);

  const getTimeRangeLabel = () => {
    switch (timeRange) {
      case 'day': return 'Dnes';
      case 'week': return 'Tento týden';
      case 'month': return 'Tento měsíc';
      default: return '';
    }
  };

  const getRoleBadge = (role) => {
    switch (role) {
        case 'superAdmin': return <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">Super Admin</Badge>;
        case 'admin': return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Admin</Badge>;
        case 'manager': return <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">Vedoucí</Badge>;
        case 'technician': return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Technik</Badge>;
        default: return <Badge variant="outline">{role}</Badge>;
    }
  };

  const handleExport = () => {
    // Add BOM for Excel to recognize UTF-8
    const BOM = "\uFEFF";
    
    const headers = ["Jméno", "Email", "Role", "Firma", "Potvrzení", "Závady nahlášeny", "Aktivita", "Celkem aktivita"];
    const rows = stats.map(user => {
        const companyName = companies?.find(c => c.id === user.company_id)?.name || "-";
        // Escape quotes and wrap in quotes for CSV safety
        const safe = (val) => `"${String(val || "").replace(/"/g, '""')}"`;
        
        return [
            safe(user.name),
            safe(user.email),
            safe(user.role),
            safe(companyName),
            user.confirmations,
            user.issuesReported,
            user.logins,
            user.total
        ].join(";");
    });

    const csvContent = BOM + [headers.join(";"), ...rows].join("\n");
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `statistiky_uzivatelu_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (isLoadingRecords || isLoadingAuthLogs || isLoadingIssues) {
    return (
        <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
        </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Statistiky aktivity ({getTimeRangeLabel()})
            </CardTitle>
            
            <div className="flex items-center gap-2 flex-wrap justify-end">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-slate-500" />
                <Select value={companyFilter} onValueChange={setCompanyFilter}>
                    <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filtrovat firmu" />
                    </SelectTrigger>
                    <SelectContent>
                    <SelectItem value="all">Všechny firmy</SelectItem>
                    {companies?.map(company => (
                        <SelectItem key={company.id} value={company.id}>{company.name}</SelectItem>
                    ))}
                    </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-slate-500" />
                <Select value={timeRange} onValueChange={setTimeRange}>
                    <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Vyberte období" />
                    </SelectTrigger>
                    <SelectContent>
                    <SelectItem value="day">Dnes</SelectItem>
                    <SelectItem value="week">Tento týden</SelectItem>
                    <SelectItem value="month">Tento měsíc</SelectItem>
                    </SelectContent>
                </Select>
              </div>

              <Button variant="outline" size="icon" onClick={handleExport} title="Exportovat do Excelu">
                <Download className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
           {/* Chart */}
           <div className="h-[300px] w-full mb-8">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  margin={{
                    top: 20,
                    right: 30,
                    left: 20,
                    bottom: 5,
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{fontSize: 12}} interval={0} angle={-20} textAnchor="end" height={60} />
                  <YAxis />
                  <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    cursor={{ fill: 'rgba(0,0,0,0.05)' }}
                  />
                  <Legend />
                  <Bar dataKey="confirmations" name="Potvrzení" fill="#22c55e" radius={[4, 4, 0, 0]} maxBarSize={50} />
                  <Bar dataKey="issuesReported" name="Závady nahlášeny" fill="#f97316" radius={[4, 4, 0, 0]} maxBarSize={50} />
                  <Bar dataKey="logins" name="Aktivita" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={50} />
                </BarChart>
              </ResponsiveContainer>
           </div>

           {/* Table */}
           <div className="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Uživatel</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead className="text-right">Potvrzení</TableHead>
                    <TableHead className="text-right">Závady nahlášeny</TableHead>
                    <TableHead className="text-right">Aktivita</TableHead>
                    <TableHead className="text-right">Celkem aktivita</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.map((stat) => (
                    <TableRow key={stat.email}>
                      <TableCell className="font-medium">
                        <div>
                            <div className="font-semibold text-slate-900">{stat.name}</div>
                            <div className="text-xs text-slate-500">{stat.email}</div>
                        </div>
                      </TableCell>
                      <TableCell>{getRoleBadge(stat.role)}</TableCell>
                      <TableCell className="text-right font-bold text-green-600">{stat.confirmations}</TableCell>
                       <TableCell className="text-right font-bold text-orange-600">{stat.issuesReported}</TableCell>
                       <TableCell className="text-right font-bold text-blue-600">{stat.logins}</TableCell>
                       <TableCell className="text-right font-bold">{stat.total}</TableCell>
                    </TableRow>
                  ))}
                  {stats.length === 0 && (
                    <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-slate-500">
                            Žádná data pro vybrané období
                        </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
           </div>
        </CardContent>
      </Card>
    </div>
  );
}