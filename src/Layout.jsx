import React, { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { useQuery } from '@tanstack/react-query';
import {
  LayoutDashboard,
  Factory,
  Settings,
  Users,
  AlertTriangle,
  LogOut,
  Menu,
  X,
  Rocket,
  Bell,
  Info
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  SidebarProvider,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { cs } from "date-fns/locale";

export default function Layout({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [hasData, setHasData] = useState(true);

  useEffect(() => {
    loadUser();
    checkData();
  }, []);

  const loadUser = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
    } catch (error) {
      console.error("Error loading user:", error);
    }
  };

  // Použít useQuery pro automatickou aktualizaci počtu závad
  const { data: allReportedIssues = [] } = useQuery({
    queryKey: ["reportedIssues"],
    queryFn: () => base44.entities.Issue.filter({ status: "reported" }),
    enabled: !!user,
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ["allUsers"],
    queryFn: () => base44.entities.User.list(),
  });

  const userMap = React.useMemo(() => {
    return allUsers.reduce((acc, u) => {
      acc[u.email] = u;
      return acc;
    }, {});
  }, [allUsers]);

  const getUserDisplayName = (userObj) => {
    if (!userObj) return "Neznámý";
    return userObj.custom_display_name || userObj.full_name || userObj.email;
  };

  const { data: lines = [] } = useQuery({
    queryKey: ["lines", user?.company_id],
    queryFn: () => user?.company_id 
      ? base44.entities.Line.filter({ company_id: user.company_id })
      : [],
    enabled: !!user && user.user_type !== "admin" && user.user_type !== "superAdmin",
  });

  const { data: machines = [] } = useQuery({
    queryKey: ["machines"],
    queryFn: () => base44.entities.Machine.list(),
    enabled: !!user && user.user_type !== "admin" && user.user_type !== "superAdmin",
  });

  const { data: controlPoints = [] } = useQuery({
    queryKey: ["controlPoints"],
    queryFn: () => base44.entities.ControlPoint.list(),
    enabled: !!user && user.user_type !== "admin" && user.user_type !== "superAdmin",
  });

  // Načíst pracovní příkazy přiřazené aktuálnímu uživateli
  const { data: myWorkOrders = [] } = useQuery({
    queryKey: ["myWorkOrders", user?.email],
    queryFn: async () => {
      if (!user?.email) return [];
      const allOrders = await base44.entities.PlannedMaintenance.filter({ 
        assigned_to: user.email,
        status: "assigned"
      }, "planned_date");
      return allOrders;
    },
    enabled: !!user?.email,
    refetchInterval: 30000, // Aktualizovat každých 30 sekund
  });

  // Načíst stroje pro notifikace
  const { data: allMachines = [] } = useQuery({
    queryKey: ["allMachinesForNotifications"],
    queryFn: () => base44.entities.Machine.list(),
    enabled: myWorkOrders.length > 0,
  });

  // Vypočítat počet závad podle uživatele
  const pendingIssuesCount = React.useMemo(() => {
    if (!user) return 0;
    if (user.user_type === "admin" || user.user_type === "superAdmin") return allReportedIssues.length;

    // Pro non-admin: filtrovat podle company_id
    const companyLineIds = lines.map(l => l.id);
    const companyMachines = machines.filter(m => companyLineIds.includes(m.line_id));
    const companyMachineIds = companyMachines.map(m => m.id);
    const companyControlPoints = controlPoints.filter(cp => companyMachineIds.includes(cp.machine_id));
    const companyControlPointIds = companyControlPoints.map(cp => cp.id);
    
    return allReportedIssues.filter(issue => companyControlPointIds.includes(issue.control_point_id)).length;
  }, [allReportedIssues, user, lines, machines, controlPoints]);

  const checkData = async () => {
    try {
      const lines = await base44.entities.Line.list();
      setHasData(lines.length > 0);
    } catch (error) {
      setHasData(false);
    }
  };

  const handleLogout = async () => {
    await base44.auth.logout();
  };

  const handleNotificationClick = (workOrder) => {
    navigate(createPageUrl(`Machine?id=${workOrder.machine_id}#maintenance`));
  };

  const navigationItems = [
    {
      title: "Dashboard",
      url: createPageUrl("Dashboard"),
      icon: LayoutDashboard,
    },
    {
      title: "Přehled výroby",
      url: createPageUrl("Lines"),
      icon: Factory,
    },
    ...(user?.user_type === "manager" || user?.user_type === "admin" || user?.user_type === "superAdmin"
      ? [
          {
            title: "Správa závad",
            url: createPageUrl("IssueApproval"),
            icon: AlertTriangle,
            badge: pendingIssuesCount,
          },
        ]
      : []),
    ...(user?.user_type === "superAdmin"
      ? [
          {
            title: "Administrace",
            url: createPageUrl("Admin"),
            icon: Settings,
          },
          {
            title: "Uživatelé",
            url: createPageUrl("Users"),
            icon: Users,
          },
        ]
      : []),
    {
      title: "O aplikaci",
      url: createPageUrl("About"),
      icon: Info,
    },
  ];

  // Přidat Setup do menu pokud nejsou data
  if (!hasData) {
    navigationItems.unshift({
      title: "🚀 Vytvořit demo data",
      url: createPageUrl("Setup"),
      icon: Rocket,
      highlight: true,
    });
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header pro mobilní */}
      <header className="lg:hidden bg-white border-b border-slate-200 px-4 py-3 sticky top-0 z-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg flex items-center justify-center shadow-lg">
              <span className="text-white font-bold text-lg">H</span>
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900">HCMS</h1>
              <p className="text-xs text-slate-500">Heistech Cloud</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Notifikace - Mobilní */}
            {myWorkOrders.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="relative p-2 rounded-lg hover:bg-slate-100 transition-colors">
                    <Bell className="w-5 h-5 text-slate-600" />
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-600 text-white text-xs font-bold rounded-full flex items-center justify-center">
                      {myWorkOrders.length}
                    </span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-80">
                  <div className="p-3 border-b border-slate-200">
                    <h3 className="font-semibold text-slate-900">Moje pracovní příkazy</h3>
                    <p className="text-xs text-slate-500">{myWorkOrders.length} aktivních úkolů</p>
                  </div>
                  <div className="max-h-96 overflow-y-auto">
                    {myWorkOrders.map((order) => {
                      const machine = allMachines.find(m => m.id === order.machine_id);
                      const isOverdue = new Date(order.planned_date) < new Date();
                      
                      return (
                        <DropdownMenuItem
                          key={order.id}
                          className="p-3 cursor-pointer hover:bg-slate-50 focus:bg-slate-50"
                          onClick={() => handleNotificationClick(order)}
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-semibold text-sm text-slate-900">{order.title}</p>
                              {isOverdue && (
                                <Badge variant="destructive" className="text-xs">Po termínu</Badge>
                              )}
                            </div>
                            <p className="text-xs text-slate-600 mb-1">{machine?.name || "Neznámý stroj"}</p>
                            <p className="text-xs text-slate-500">
                              Plánováno: {format(new Date(order.planned_date), "d. M. yyyy", { locale: cs })}
                            </p>
                          </div>
                        </DropdownMenuItem>
                      );
                    })}
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="p-2 rounded-lg hover:bg-slate-100"
            >
              {mobileOpen ? (
                <X className="w-6 h-6 text-slate-600" />
              ) : (
                <Menu className="w-6 h-6 text-slate-600" />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Mobilní menu */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-white">
          <div className="p-6 space-y-4 pt-20">
            {navigationItems.map((item) => (
              <Link
                key={item.title}
                to={item.url}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center justify-between p-4 rounded-xl transition-all ${
                  item.highlight
                    ? "bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg"
                    : location.pathname === item.url
                    ? "bg-blue-50 text-blue-700"
                    : "hover:bg-slate-100"
                }`}
              >
                <div className="flex items-center gap-3">
                  <item.icon className="w-5 h-5" />
                  <span className="font-medium">{item.title}</span>
                </div>
                {item.badge > 0 && (
                  <span className="px-2 py-1 text-xs font-bold bg-red-600 text-white rounded-full">
                    {item.badge}
                  </span>
                )}
              </Link>
            ))}
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 p-4 rounded-xl hover:bg-slate-100 text-red-600"
            >
              <LogOut className="w-5 h-5" />
              <span className="font-medium">Odhlásit se</span>
            </button>
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <div className="hidden lg:flex">
        <SidebarProvider>
          <div className="flex min-h-screen w-full">
            <Sidebar className="border-r border-slate-200 bg-white">
              <SidebarHeader className="border-b border-slate-200 p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl flex items-center justify-center shadow-lg">
                      <span className="text-white font-bold text-2xl">H</span>
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-slate-900">HCMS</h2>
                      <p className="text-sm text-slate-500">Heistech Cloud</p>
                    </div>
                  </div>
                  
                  {/* Notifikace - Desktop */}
                  {myWorkOrders.length > 0 && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="relative p-2 rounded-lg hover:bg-slate-100 transition-colors">
                          <Bell className="w-5 h-5 text-slate-600" />
                          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-600 text-white text-xs font-bold rounded-full flex items-center justify-center">
                            {myWorkOrders.length}
                          </span>
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-80">
                        <div className="p-3 border-b border-slate-200">
                          <h3 className="font-semibold text-slate-900">Moje pracovní příkazy</h3>
                          <p className="text-xs text-slate-500">{myWorkOrders.length} aktivních úkolů</p>
                        </div>
                        <div className="max-h-96 overflow-y-auto">
                          {myWorkOrders.map((order) => {
                            const machine = allMachines.find(m => m.id === order.machine_id);
                            const isOverdue = new Date(order.planned_date) < new Date();
                            
                            return (
                              <DropdownMenuItem
                                key={order.id}
                                className="p-3 cursor-pointer hover:bg-slate-50 focus:bg-slate-50"
                                onClick={() => handleNotificationClick(order)}
                              >
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <p className="font-semibold text-sm text-slate-900">{order.title}</p>
                                    {isOverdue && (
                                      <Badge variant="destructive" className="text-xs">Po termínu</Badge>
                                    )}
                                  </div>
                                  <p className="text-xs text-slate-600 mb-1">{machine?.name || "Neznámý stroj"}</p>
                                  <p className="text-xs text-slate-500">
                                    Plánováno: {format(new Date(order.planned_date), "d. M. yyyy", { locale: cs })}
                                  </p>
                                </div>
                              </DropdownMenuItem>
                            );
                          })}
                        </div>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </SidebarHeader>

              <SidebarContent className="p-4">
                <SidebarGroup>
                  <SidebarGroupLabel className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 py-2">
                    Menu
                  </SidebarGroupLabel>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {navigationItems.map((item) => (
                        <SidebarMenuItem key={item.title}>
                          <SidebarMenuButton
                            asChild
                            className={`hover:bg-slate-100 rounded-xl mb-1 transition-all ${
                              item.highlight
                                ? "bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700"
                                : location.pathname === item.url
                                ? "bg-blue-50 text-blue-700"
                                : ""
                            }`}
                          >
                            <Link to={item.url} className="flex items-center justify-between px-4 py-3">
                              <div className="flex items-center gap-3">
                                <item.icon className="w-5 h-5" />
                                <span className="font-medium">{item.title}</span>
                              </div>
                              {item.badge > 0 && (
                                <span className="px-2 py-1 text-xs font-bold bg-red-600 text-white rounded-full">
                                  {item.badge}
                                </span>
                              )}
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      ))}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>
              </SidebarContent>

              <SidebarFooter className="border-t border-slate-200 p-4">
                <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 mb-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-slate-400 to-slate-500 rounded-full flex items-center justify-center">
                    <span className="text-white font-semibold">
                      {getUserDisplayName(user)?.[0] || "U"}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900 truncate">
                      {getUserDisplayName(user)}
                    </p>
                    <p className="text-xs text-slate-500 truncate">
                      {user?.user_type === "superAdmin"
                        ? "Super Administrátor"
                        : user?.user_type === "admin"
                        ? "Administrátor"
                        : user?.user_type === "manager"
                        ? "Vedoucí"
                        : "Technik"}
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-red-50 text-red-700 hover:bg-red-100 transition-colors font-medium"
                >
                  <LogOut className="w-4 h-4" />
                  Odhlásit se
                </button>
              </SidebarFooter>
            </Sidebar>

            <main className="flex-1 overflow-auto">
              {children}
            </main>
          </div>
        </SidebarProvider>
      </div>

      {/* Main content pro mobilní */}
      <main className="lg:hidden">
        {children}
      </main>
    </div>
  );
}