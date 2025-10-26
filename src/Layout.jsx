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
  Bell
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
  const [currentTheme, setCurrentTheme] = useState('system');

  useEffect(() => {
    loadUser();
    checkData();
  }, []);

  useEffect(() => {
    if (user) {
      setCurrentTheme(user.theme_preference || 'system');
    }
  }, [user]);

  useEffect(() => {
    const root = window.document.documentElement;

    const applyTheme = (theme) => {
      if (theme === 'dark') {
        root.classList.add('dark');
      } else if (theme === 'light') {
        root.classList.remove('dark');
      } else {
        if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
          root.classList.add('dark');
        } else {
          root.classList.remove('dark');
        }
      }
    };

    applyTheme(currentTheme);

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      if (currentTheme === 'system') {
        applyTheme('system');
      }
    };
    mediaQuery.addEventListener('change', handleChange);

    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [currentTheme]);

  const loadUser = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
    } catch (error) {
      console.error("Error loading user:", error);
    }
  };

  const { data: allReportedIssues = [] } = useQuery({
    queryKey: ["reportedIssues"],
    queryFn: () => base44.entities.Issue.filter({ status: "reported" }),
    enabled: !!user,
  });

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
    refetchInterval: 30000,
  });

  const { data: allMachines = [] } = useQuery({
    queryKey: ["allMachinesForNotifications"],
    queryFn: () => base44.entities.Machine.list(),
    enabled: myWorkOrders.length > 0,
  });

  const pendingIssuesCount = React.useMemo(() => {
    if (!user) return 0;
    if (user.user_type === "admin" || user.user_type === "superAdmin") return allReportedIssues.length;

    const companyLineIds = lines.map(l => l.id);
    const companyMachines = machines.filter(m => companyLineIds.includes(m.line_id));
    const companyMachineIds = companyMachines.map(m => m.id);
    const companyControlPoints = controlPoints.filter(cp => companyMachineIds.includes(cp.machine_id));
    const companyControlPointIds = companyControlPoints.map(cp => cp.id);
    
    return allReportedIssues.filter(issue => 
      companyControlPointIds.includes(issue.control_point_id)
    ).length;
  }, [user, allReportedIssues, lines, machines, controlPoints]);

  const checkData = async () => {
    try {
      const currentUser = await base44.auth.me();
      if (!currentUser.company_id && currentUser.user_type !== "admin" && currentUser.user_type !== "superAdmin") {
        setHasData(false);
        return;
      }
      
      if (currentUser.user_type === "admin" || currentUser.user_type === "superAdmin") {
        setHasData(true);
        return;
      }

      const userLines = await base44.entities.Line.filter({ 
        company_id: currentUser.company_id 
      });
      
      setHasData(userLines.length > 0);
    } catch (error) {
      console.error("Error checking data:", error);
    }
  };

  const handleLogout = async () => {
    await base44.auth.logout();
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-red-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600 dark:text-slate-400">Načítání...</p>
        </div>
      </div>
    );
  }

  const isAdminOrSuperAdmin = user.user_type === "admin" || user.user_type === "superAdmin";
  const navItems = isAdminOrSuperAdmin
    ? [
        { name: "Dashboard", path: "Dashboard", icon: LayoutDashboard },
        { name: "Administrace", path: "Admin", icon: Settings },
        { name: "Uživatelé", path: "Users", icon: Users },
        { name: "Závady", path: "IssueApproval", icon: AlertTriangle },
      ]
    : hasData
    ? [
        { name: "Dashboard", path: "Dashboard", icon: LayoutDashboard },
        { name: "Linky", path: "Lines", icon: Factory },
        ...(user.user_type !== "technician" ? [{ name: "Závady", path: "IssueApproval", icon: AlertTriangle }] : []),
      ]
    : [
        { name: "Nastavení", path: "Setup", icon: Rocket },
      ];

  const sidebarContent = (
    <>
      <SidebarHeader className="border-b border-slate-200 dark:border-slate-700 p-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-red-600 to-red-700 rounded-xl flex items-center justify-center shadow-lg">
            <Factory className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white truncate">DEMIP</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
              {user.user_type === "superAdmin" ? "Super Admin" : 
               user.user_type === "admin" ? "Administrátor" : 
               user.user_type === "manager" ? "Vedoucí" : "Technik"}
            </p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-3 py-4">
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-3 mb-2">
            Navigace
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const isActive = location.pathname === createPageUrl(item.path);
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      asChild
                      className={`${
                        isActive
                          ? "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 font-semibold"
                          : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                      } transition-colors duration-200`}
                    >
                      <Link to={createPageUrl(item.path)} className="flex items-center gap-3 px-3 py-2.5 rounded-lg">
                        <item.icon className={`w-5 h-5 ${isActive ? "text-red-600 dark:text-red-400" : ""}`} />
                        <span>{item.name}</span>
                        {item.name === "Závady" && pendingIssuesCount > 0 && (
                          <Badge variant="destructive" className="ml-auto">
                            {pendingIssuesCount}
                          </Badge>
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {myWorkOrders.length > 0 && (
          <SidebarGroup className="mt-6">
            <SidebarGroupLabel className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-3 mb-2 flex items-center gap-2">
              <Bell className="w-4 h-4" />
              Přiřazené úkoly ({myWorkOrders.length})
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <div className="space-y-2 max-h-[300px] overflow-y-auto px-3">
                  {myWorkOrders.slice(0, 5).map((order) => {
                    const machine = allMachines.find(m => m.id === order.machine_id);
                    const isOverdue = new Date(order.planned_date) < new Date();
                    
                    return (
                      <Link
                        key={order.id}
                        to={createPageUrl(`Machine?id=${order.machine_id}`)}
                        className="block p-3 rounded-lg bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors border border-slate-200 dark:border-slate-700"
                      >
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <p className="text-sm font-medium text-slate-900 dark:text-white line-clamp-1">
                            {order.title}
                          </p>
                          {isOverdue && (
                            <Badge variant="destructive" className="text-xs flex-shrink-0">
                              Po termínu
                            </Badge>
                          )}
                        </div>
                        {machine && (
                          <p className="text-xs text-slate-600 dark:text-slate-400 mb-1 line-clamp-1">
                            {machine.name}
                          </p>
                        )}
                        <p className="text-xs text-slate-500 dark:text-slate-500">
                          {format(new Date(order.planned_date), "d. M. yyyy", { locale: cs })}
                        </p>
                      </Link>
                    );
                  })}
                </div>
                {myWorkOrders.length > 5 && (
                  <p className="text-xs text-center text-slate-500 dark:text-slate-400 mt-2 px-3">
                    + další {myWorkOrders.length - 5} úkolů
                  </p>
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-slate-200 dark:border-slate-700 p-4">
        <DropdownMenu>
          <DropdownMenuTrigger className="w-full">
            <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer">
              <div className="w-10 h-10 bg-gradient-to-br from-slate-600 to-slate-700 rounded-full flex items-center justify-center shadow-md flex-shrink-0">
                <span className="text-white font-semibold text-sm">
                  {getUserDisplayName(user).charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                  {getUserDisplayName(user)}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{user.email}</p>
              </div>
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem onClick={() => navigate(createPageUrl("AppSettings"))}>
              <Settings className="w-4 h-4 mr-2" />
              Nastavení vzhledu
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleLogout} className="text-red-600 dark:text-red-400">
              <LogOut className="w-4 h-4 mr-2" />
              Odhlásit se
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </>
  );

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-slate-50 dark:bg-slate-900">
        <div className="hidden md:block">
          <Sidebar className="border-r border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
            {sidebarContent}
          </Sidebar>
        </div>

        {mobileOpen && (
          <div className="fixed inset-0 z-50 md:hidden">
            <div
              className="absolute inset-0 bg-black/50"
              onClick={() => setMobileOpen(false)}
            />
            <div className="absolute left-0 top-0 bottom-0 w-72 bg-white dark:bg-slate-800 shadow-xl">
              <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">Menu</h2>
                <button
                  onClick={() => setMobileOpen(false)}
                  className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                >
                  <X className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                </button>
              </div>
              <div className="overflow-y-auto h-[calc(100vh-73px)]">
                {sidebarContent}
              </div>
            </div>
          </div>
        )}

        <div className="flex-1 flex flex-col min-w-0">
          <header className="md:hidden sticky top-0 z-40 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 py-3">
            <div className="flex items-center justify-between">
              <button
                onClick={() => setMobileOpen(true)}
                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              >
                <Menu className="w-6 h-6 text-slate-600 dark:text-slate-400" />
              </button>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-br from-red-600 to-red-700 rounded-lg flex items-center justify-center shadow-md">
                  <Factory className="w-5 h-5 text-white" />
                </div>
                <h1 className="text-lg font-bold text-slate-900 dark:text-white">DEMIP</h1>
              </div>
              <div className="w-10" />
            </div>
          </header>

          <main className="flex-1 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}