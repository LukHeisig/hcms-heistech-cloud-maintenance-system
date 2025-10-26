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

  useEffect(() => {
    loadUser();
    checkData();
  }, []);

  // DARK MODE LOGIC - aplikace tématu na HTML element
  useEffect(() => {
    if (!user) return;

    const root = window.document.documentElement;
    const themePreference = user.theme_preference || 'system';

    const applyTheme = (theme) => {
      if (theme === 'dark') {
        root.classList.add('dark');
      } else if (theme === 'light') {
        root.classList.remove('dark');
      } else { // 'system'
        if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
          root.classList.add('dark');
        } else {
          root.classList.remove('dark');
        }
      }
    };

    applyTheme(themePreference);

    // Sledování změn systémové preference pro 'system' režim
    if (themePreference === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = () => applyTheme('system');
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [user]);

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

  const pendingWorkOrdersCount = React.useMemo(() => {
    return myWorkOrders.length;
  }, [myWorkOrders]);

  const checkData = async () => {
    try {
      const currentUser = await base44.auth.me();
      if (currentUser.user_type === "admin" || currentUser.user_type === "superAdmin") {
        setHasData(true);
        return;
      }

      const allLines = await base44.entities.Line.list();
      const userLines = allLines.filter(l => l.company_id === currentUser.company_id);
      
      if (userLines.length === 0) {
        setHasData(false);
        return;
      }

      const allMachines = await base44.entities.Machine.list();
      const userMachines = allMachines.filter(m => 
        userLines.some(l => l.id === m.line_id)
      );

      if (userMachines.length === 0) {
        setHasData(false);
        return;
      }

      const allControlPoints = await base44.entities.ControlPoint.list();
      const userControlPoints = allControlPoints.filter(cp =>
        userMachines.some(m => m.id === cp.machine_id)
      );

      setHasData(userControlPoints.length > 0);
    } catch (error) {
      console.error("Error checking data:", error);
      setHasData(true);
    }
  };

  const handleLogout = async () => {
    await base44.auth.logout();
  };

  const isActive = (path) => {
    return location.pathname === path;
  };

  const isAdminOrSuperAdmin = user?.user_type === "admin" || user?.user_type === "superAdmin";

  const sidebarContent = (
    <div className="flex flex-col h-full">
      <SidebarHeader className="border-b border-slate-200 dark:border-slate-700 pb-4">
        <div className="flex items-center gap-2 px-2">
          <div className="w-8 h-8 bg-gradient-to-br from-red-600 to-red-700 rounded-lg flex items-center justify-center">
            <Factory className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="font-bold text-lg text-slate-900 dark:text-white">DEMIP</h2>
            <p className="text-xs text-slate-600 dark:text-slate-400">Digitální Evidence</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="flex-1">
        {!hasData && !isAdminOrSuperAdmin && (
          <div className="p-4 mb-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg mx-4 mt-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-yellow-900 dark:text-yellow-200 mb-1">
                  Žádná data k zobrazení
                </p>
                <p className="text-xs text-yellow-700 dark:text-yellow-300">
                  Kontaktujte prosím správce pro nastavení linek, strojů a kontrolních bodů.
                </p>
              </div>
            </div>
          </div>
        )}

        <SidebarGroup>
          <SidebarGroupLabel className="text-slate-600 dark:text-slate-400">Hlavní menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isActive(createPageUrl("Dashboard"))}
                  className="data-[active=true]:bg-red-50 dark:data-[active=true]:bg-red-900/20 data-[active=true]:text-red-700 dark:data-[active=true]:text-red-400"
                >
                  <Link to={createPageUrl("Dashboard")}>
                    <LayoutDashboard className="w-5 h-5" />
                    <span>Přehled</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {!isAdminOrSuperAdmin && (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(createPageUrl("Lines"))}
                    className="data-[active=true]:bg-red-50 dark:data-[active=true]:bg-red-900/20 data-[active=true]:text-red-700 dark:data-[active=true]:text-red-400"
                  >
                    <Link to={createPageUrl("Lines")}>
                      <Factory className="w-5 h-5" />
                      <span>Linky</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}

              {(user?.user_type === "manager" || user?.user_type === "admin" || user?.user_type === "superAdmin") && (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(createPageUrl("IssueApproval"))}
                    className="data-[active=true]:bg-red-50 dark:data-[active=true]:bg-red-900/20 data-[active=true]:text-red-700 dark:data-[active=true]:text-red-400"
                  >
                    <Link to={createPageUrl("IssueApproval")}>
                      <AlertTriangle className="w-5 h-5" />
                      <span>Schválení závad</span>
                      {pendingIssuesCount > 0 && (
                        <Badge className="ml-auto bg-red-600 text-white">
                          {pendingIssuesCount}
                        </Badge>
                      )}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}

              {pendingWorkOrdersCount > 0 && (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    className="data-[active=true]:bg-red-50 dark:data-[active=true]:bg-red-900/20 data-[active=true]:text-red-700 dark:data-[active=true]:text-red-400"
                  >
                    <Link to={createPageUrl("Dashboard")}>
                      <Bell className="w-5 h-5" />
                      <span>Pracovní příkazy</span>
                      <Badge className="ml-auto bg-blue-600 text-white">
                        {pendingWorkOrdersCount}
                      </Badge>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {(user?.user_type === "admin" || user?.user_type === "superAdmin") && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-slate-600 dark:text-slate-400">Administrace</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(createPageUrl("Admin"))}
                    className="data-[active=true]:bg-red-50 dark:data-[active=true]:bg-red-900/20 data-[active=true]:text-red-700 dark:data-[active=true]:text-red-400"
                  >
                    <Link to={createPageUrl("Admin")}>
                      <Settings className="w-5 h-5" />
                      <span>Správa systému</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>

                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(createPageUrl("Users"))}
                    className="data-[active=true]:bg-red-50 dark:data-[active=true]:bg-red-900/20 data-[active=true]:text-red-700 dark:data-[active=true]:text-red-400"
                  >
                    <Link to={createPageUrl("Users")}>
                      <Users className="w-5 h-5" />
                      <span>Uživatelé</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-slate-200 dark:border-slate-700 pt-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton className="w-full">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className="w-8 h-8 bg-gradient-to-br from-slate-600 to-slate-700 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-white text-sm font-medium">
                        {user?.full_name?.charAt(0) || user?.email?.charAt(0) || "U"}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                        {getUserDisplayName(user)}
                      </p>
                      <p className="text-xs text-slate-600 dark:text-slate-400 truncate">
                        {user?.email}
                      </p>
                    </div>
                  </div>
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="end" className="w-56">
                <DropdownMenuItem onClick={handleLogout} className="text-red-600 dark:text-red-400">
                  <LogOut className="w-4 h-4 mr-2" />
                  Odhlásit se
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </div>
  );

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-slate-50 dark:bg-slate-900">
        <Sidebar className="hidden md:flex border-r border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
          {sidebarContent}
        </Sidebar>

        {mobileOpen && (
          <div className="fixed inset-0 z-50 md:hidden">
            <div 
              className="absolute inset-0 bg-black/50" 
              onClick={() => setMobileOpen(false)}
            />
            <div className="absolute top-0 left-0 bottom-0 w-72 bg-white dark:bg-slate-800 shadow-xl overflow-y-auto">
              <div className="flex justify-between items-center p-4 border-b border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-2">
                  <Factory className="w-6 h-6 text-red-600 dark:text-red-400" />
                  <h2 className="font-bold text-lg text-slate-900 dark:text-white">DEMIP</h2>
                </div>
                <button 
                  onClick={() => setMobileOpen(false)}
                  className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
                >
                  <X className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                </button>
              </div>
              {sidebarContent}
            </div>
          </div>
        )}

        <div className="flex-1 flex flex-col min-w-0">
          <header className="md:hidden flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
            <button
              onClick={() => setMobileOpen(true)}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
            >
              <Menu className="w-6 h-6 text-slate-600 dark:text-slate-400" />
            </button>
            <div className="flex items-center gap-2">
              <Factory className="w-6 h-6 text-red-600 dark:text-red-400" />
              <h1 className="font-bold text-lg text-slate-900 dark:text-white">DEMIP</h1>
            </div>
            <div className="w-10" />
          </header>

          <main className="flex-1 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}