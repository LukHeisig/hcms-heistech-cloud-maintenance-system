import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import {
  LayoutDashboard,
  Factory,
  Settings,
  Users,
  AlertTriangle,
  LogOut,
  Menu,
  X
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

export default function Layout({ children }) {
  const location = useLocation();
  const [user, setUser] = useState(null);
  const [pendingIssuesCount, setPendingIssuesCount] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    loadUser();
    loadPendingIssues();
  }, []);

  const loadUser = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
    } catch (error) {
      console.error("Error loading user:", error);
    }
  };

  const loadPendingIssues = async () => {
    try {
      const issues = await base44.entities.Issue.filter({ status: "pending_approval" });
      setPendingIssuesCount(issues.length);
    } catch (error) {
      console.error("Error loading issues:", error);
    }
  };

  const handleLogout = async () => {
    await base44.auth.logout();
  };

  const navigationItems = [
    {
      title: "Dashboard",
      url: createPageUrl("Dashboard"),
      icon: LayoutDashboard,
    },
    {
      title: "Linky a stroje",
      url: createPageUrl("Lines"),
      icon: Factory,
    },
    ...(user?.user_type === "manager" || user?.user_type === "admin"
      ? [
          {
            title: "Závady ke schválení",
            url: createPageUrl("IssueApproval"),
            icon: AlertTriangle,
            badge: pendingIssuesCount,
          },
        ]
      : []),
    ...(user?.user_type === "admin"
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
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header pro mobilní */}
      <header className="lg:hidden bg-white border-b border-slate-200 px-4 py-3 sticky top-0 z-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-red-600 to-red-700 rounded-lg flex items-center justify-center shadow-lg">
              <Factory className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900">DEMIP</h1>
              <p className="text-xs text-slate-500">Správa mazání</p>
            </div>
          </div>
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
                  location.pathname === item.url
                    ? "bg-red-50 text-red-700"
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
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-red-600 to-red-700 rounded-xl flex items-center justify-center shadow-lg">
                    <Factory className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">DEMIP</h2>
                    <p className="text-sm text-slate-500">Správa mazání</p>
                  </div>
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
                              location.pathname === item.url
                                ? "bg-red-50 text-red-700"
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
                      {user?.full_name?.[0] || "U"}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900 truncate">
                      {user?.full_name || "Uživatel"}
                    </p>
                    <p className="text-xs text-slate-500 truncate">
                      {user?.user_type === "admin"
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