import React, { useState, useEffect, useMemo, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { useQuery } from '@tanstack/react-query';
import { ViewModeProvider, useViewMode } from "@/components/ViewModeContext";
import { OfflineProvider } from "@/components/OfflineProvider";
import { DebugProvider } from "@/components/DebugContext";
import UpdateBanner from "@/components/UpdateBanner";
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
  Smartphone,
  Sparkles,
  Bell,
  Info,
  Code,
  Wrench,
  Droplet,
  Activity,
  Building2,
  ClipboardList,
  ChevronRight,
  Loader2,
  Terminal,
  Radio,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { cs } from "date-fns/locale";

function LayoutContent({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [hasData, setHasData] = useState(true);
  const { viewMode, toggleViewMode } = useViewMode();
  const lastActivityUpdateRef = useRef(null);
  const idleTimerRef = useRef(null);
  
  const [showNfcScanDialog, setShowNfcScanDialog] = useState(false);
  const [isNfcScanning, setIsNfcScanning] = useState(false);
  const [nfcSupported, setNfcSupported] = useState(false);
  const [nfcLogs, setNfcLogs] = useState([]);
  const nfcLogsRef = useRef([]); // Pro přístup k logům v callbacku
  const userRef = useRef(null); // Pro přístup k user v NFC callbacku (closure fix)

  useEffect(() => {
    loadUser();
    checkData();
    if ('NDEFReader' in window) {
      setNfcSupported(true);
    }
  }, []);

  const handleNfcQuickScan = async () => {
    if (!nfcSupported) {
      alert("NFC není podporováno v tomto prohlížeči. Použijte prosím Chrome na Androidu.");
      return;
    }

    setShowNfcScanDialog(true);
    setIsNfcScanning(true);
    
    // Reset logs
    nfcLogsRef.current = ["Připraveno ke skenování..."];
    setNfcLogs(nfcLogsRef.current);

    const log = (msg) => {
      console.log("[NFC Log]", msg);
      nfcLogsRef.current = [...nfcLogsRef.current, msg];
      setNfcLogs(nfcLogsRef.current);
    };

    const saveNfcLogToDb = async (chipId, result) => {
      try {
        await base44.entities.NfcLog.create({
          chip_id: chipId || "unknown",
          scanned_at: new Date().toISOString(),
          scanned_by: user?.email || "unknown",
          result: result,
          log_content: nfcLogsRef.current.join("\n"),
          device_info: navigator.userAgent
        });
        console.log("NFC log saved to DB");
      } catch (e) {
        console.error("Failed to save NFC log to DB", e);
      }
    };

    try {
      const ndef = new window.NDEFReader();
      const abortController = new AbortController();
      
      await ndef.scan({ signal: abortController.signal });
      log("Skenování spuštěno, přiložte čip.");

      const timeoutId = setTimeout(() => {
        abortController.abort();
        log("Časový limit vypršel (10s).");
        setIsNfcScanning(false);
        saveNfcLogToDb("timeout", "timeout");
      }, 10000);

      ndef.addEventListener("reading", async ({ serialNumber }) => {
        clearTimeout(timeoutId);
        abortController.abort();
        
        const timestamp = new Date().toLocaleTimeString();
        log(`[${timestamp}] Čip načten: ${serialNumber}`);

        try {
          log(`Hledám kontrolní body pro ID: ${serialNumber}`);
          
          // Najít všechny kontrolní body s tímto NFC ID
          const points = await base44.entities.ControlPoint.filter({ nfc_chip_id: serialNumber }, null, 1000);
          log(`Nalezeno bodů v DB: ${points.length}`);

          let validPointFound = false;

          // Projít všechny nalezené body a najít ten, který má platnou vazbu na stroj a linku
          for (const point of points) {
              log(`Kontrola bodu: ${point.name} (ID: ${point.id})`);
              const machines = await base44.entities.Machine.filter({ id: point.machine_id }, null, 1000);
              const machine = machines[0];

              if (!machine) {
                  log(`❌ Stroj nenalezen (ID: ${point.machine_id})`);
                  continue;
              }

              const lines = await base44.entities.Line.filter({ id: machine.line_id }, null, 1000);
              const line = lines[0];

              if (!line) {
                  log(`⚠️ Linka nenalezena (ID: ${machine.line_id}) - přeskakuji sirotka`);
                  continue;
              }

              // Check permissions for non-admins
              const currentUser = userRef.current;
              if (currentUser?.user_type !== "admin" && currentUser?.user_type !== "superAdmin") {
                  if (line.company_id !== currentUser?.company_id) {
                      log(`⛔ Nemáte oprávnění k této lince (Jiné ID podniku)`);
                      continue;
                  }
              }

              log(`✅ Validní vazba: Stroj ${machine.name}, Linka ${line.name}`);

              // Našli jsme platný bod s existujícím strojem a linkou
              let url;
              if (currentUser?.user_type === "admin" || currentUser?.user_type === "superAdmin") {
                  const companyId = line?.company_id;
                  url = `Dashboard?company=${companyId}&line=${line?.id}&machine=${machine.id}&point=${point.id}&nfc_scanned=true`;
              } else {
                  url = `Dashboard?line=${line?.id}&machine=${machine.id}&point=${point.id}&nfc_scanned=true`;
              }
              
              log(`Přesměrování...`);
              await saveNfcLogToDb(serialNumber, "success");
              navigate(createPageUrl(url));
              validPointFound = true;
              setShowNfcScanDialog(false);
              break; // Ukončit hledání po prvním platném nálezu
          }

          if (!validPointFound) {
              setIsNfcScanning(false);
              if (points.length > 0) {
                  log(`❌ Žádný z nalezených bodů nemá platnou vazbu na stroj/linku.`);
                  log(`Může se jednat o "sirotka" (smazaný stroj/linka).`);
                  await saveNfcLogToDb(serialNumber, "not_found_orphan");
              } else {
                  log(`❌ Žádný kontrolní bod s tímto čipem nebyl nalezen.`);
                  log(`Tip: Zkontrolujte přiřazení čipu v administraci.`);
                  await saveNfcLogToDb(serialNumber, "not_found");
              }
          }
        } catch (err) {
          console.error("Error processing NFC tag:", err);
          setIsNfcScanning(false);
          log(`Chyba při zpracování: ${err.message}`);
          await saveNfcLogToDb(serialNumber, "error");
        }
      }, { signal: abortController.signal });

      ndef.addEventListener("readingerror", async (event) => {
        clearTimeout(timeoutId);
        console.error("NFC reading error:", event);
        log(`Chyba čtení NFC (ReadingError)`);
        setIsNfcScanning(false);
        abortController.abort();
        await saveNfcLogToDb("error", "reading_error");
      }, { signal: abortController.signal });

    } catch (error) {
      console.error("NFC scan initiation error:", error);
      if (error.name === "NotAllowedError" || error.message?.includes("permission")) {
        log(`⛔ NFC oprávnění odmítnuto. Povolte NFC v nastavení prohlížeče a zkuste znovu.`);
      } else {
        log(`Chyba inicializace: ${error.message}`);
      }
      setIsNfcScanning(false);
      await saveNfcLogToDb("init_error", "init_error");
    }
  };

  useEffect(() => {
    if (!user) return;

    const trackActivity = async () => {
      const now = Date.now();
      const lastUpdate = lastActivityUpdateRef.current || 0;
      
      // Omezení na 30 sekund - bohatě stačí pro určení "Online" statusu (do 5 minut)
      if (now - lastUpdate < 30000) {
        return;
      }
      
      lastActivityUpdateRef.current = now;
      
      try {
        const res = await base44.functions.invoke('logUserActivity', {});
        if (res.data && res.data.error) {
           console.error("Backend logUserActivity error:", res.data.error);
        }
      } catch (error) {
        console.error("Error logging activity:", error);
        // Nepíšeme do SystemLogu při každém výpadku sítě, zbytečně to spamuje
      }
    };

    // Vždy zapíšeme aktivitu ihned po načtení
    trackActivity();

    // Přímé napojení bez setTimeout (řeší problém, kdy uživatel zavře appku dřív, než timeout vyprší)
    window.addEventListener('click', trackActivity, { passive: true });
    window.addEventListener('keydown', trackActivity, { passive: true });
    window.addEventListener('touchstart', trackActivity, { passive: true });
    window.addEventListener('scroll', trackActivity, { passive: true });
    window.addEventListener('mousemove', trackActivity, { passive: true });

    return () => {
      window.removeEventListener('click', trackActivity);
      window.removeEventListener('keydown', trackActivity);
      window.removeEventListener('touchstart', trackActivity);
      window.removeEventListener('scroll', trackActivity);
      window.removeEventListener('mousemove', trackActivity);
    };
  }, [user]);

  // Auto-logout logic
  useEffect(() => {
    if (!user?.auto_logout_enabled || !user?.auto_logout_minutes) {
      return;
    }

    const logoutTime = user.auto_logout_minutes * 60 * 1000;

    const logoutUser = () => {
      base44.auth.logout();
    };

    const resetIdleTimer = () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      idleTimerRef.current = setTimeout(logoutUser, logoutTime);
    };

    // Initial timer
    resetIdleTimer();

    // Listeners for activity
    window.addEventListener('mousemove', resetIdleTimer);
    window.addEventListener('keydown', resetIdleTimer);
    window.addEventListener('click', resetIdleTimer);
    window.addEventListener('scroll', resetIdleTimer);
    window.addEventListener('touchstart', resetIdleTimer);

    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      window.removeEventListener('mousemove', resetIdleTimer);
      window.removeEventListener('keydown', resetIdleTimer);
      window.removeEventListener('click', resetIdleTimer);
      window.removeEventListener('scroll', resetIdleTimer);
      window.removeEventListener('touchstart', resetIdleTimer);
    };
  }, [user]);

  const loadUser = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
      userRef.current = currentUser; // Sync ref pro NFC callback
    } catch (error) {
      console.error("Error loading user:", error);
    }
  };

  const { data: allReportedIssues = [] } = useQuery({
    queryKey: ["reportedIssues"],
    queryFn: () => base44.entities.Issue.filter({ status: "reported" }),
    enabled: !!user,
  });

  // Fetch minimal data needed for notifications/badges
  // Use same keys as Dashboard to share cache and avoid 429s
  const { data: lines = [] } = useQuery({
    queryKey: ["allLines"],
    queryFn: () => base44.entities.Line.list(null, 1000),
    enabled: !!user,
    staleTime: 300000, // 5 minutes
  });

  const { data: machines = [] } = useQuery({
    queryKey: ["allMachines"],
    queryFn: () => base44.entities.Machine.list(null, 1000),
    enabled: !!user,
    staleTime: 300000, // 5 minutes
  });

  const { data: controlPoints = [] } = useQuery({
    queryKey: ["allControlPoints"],
    queryFn: () => base44.entities.ControlPoint.list(null, 1000),
    enabled: !!user,
    staleTime: 300000, // 5 minutes
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
    queryFn: () => base44.entities.Machine.list(null, 1000),
    enabled: myWorkOrders.length > 0,
  });

  const { data: userCompany } = useQuery({
    queryKey: ["userCompany", user?.company_id],
    queryFn: async () => {
      if (!user?.company_id) return null;
      const companies = await base44.entities.Company.filter({ id: user.company_id });
      return companies[0] || null;
    },
    enabled: !!user?.company_id,
  });

  // Force DEMIP mode for technicians on mobile if configured
  useEffect(() => {
    if (user?.user_type === 'technician' && userCompany?.force_technician_demip_mobile) {
      const checkAndForceDemip = () => {
        const isMobile = window.matchMedia('(max-width: 1024px)').matches;
        if (isMobile && viewMode !== 'demip') {
          toggleViewMode();
          navigate(createPageUrl("Dashboard"), { replace: true });
        }
      };

      checkAndForceDemip();
      
      const handleResize = () => checkAndForceDemip();
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }
  }, [user, userCompany, viewMode, toggleViewMode, navigate]);

  const pendingIssuesCount = useMemo(() => {
    if (!user) return 0;

    // Filter issues based on visibility
    const visibleIssues = allReportedIssues.filter(issue => {
      // Find issue location
      let companyId = null;
      if (issue.control_point_id) {
        const cp = controlPoints.find(p => p.id === issue.control_point_id);
        if (cp) {
          const m = machines.find(mac => mac.id === cp.machine_id);
          if (m) {
            const l = lines.find(lin => lin.id === m.line_id);
            if (l) companyId = l.company_id;
          }
        }
      } else if (issue.machine_id) {
        const m = machines.find(mac => mac.id === issue.machine_id);
        if (m) {
          const l = lines.find(lin => lin.id === m.line_id);
          if (l) companyId = l.company_id;
        }
      }

      if (!companyId) return false; // Orphan issue or unknown location

      if (user.user_type === "superAdmin") return true;

      if (user.user_type === "admin") {
        return user.assigned_company_ids?.includes(companyId);
      }
      
      return user.company_id === companyId;
    });

    return visibleIssues.length;
  }, [allReportedIssues, user, lines, machines, controlPoints]);

  const checkData = async () => {
    try {
      const linesData = await base44.entities.Line.list();
      setHasData(linesData.length > 0);
    } catch (err) {
      console.error("Error checking data:", err);
      setHasData(true); // Don't show Setup link on error
    }
  };

  const handleLogout = async () => {
    await base44.auth.logout();
  };

  const handleNotificationClick = (workOrder) => {
    navigate(createPageUrl(`Machine?id=${workOrder.machine_id}#maintenance`));
  };

  const getUserDisplayName = (userObj) => {
    if (!userObj) return "Neznámý";
    return userObj.custom_display_name || userObj.full_name || userObj.email;
  };

  const navigationItems = [
    {
      title: "Dashboard",
      url: createPageUrl("Dashboard"),
      icon: LayoutDashboard,
    },
    {
      title: "Pracovní příkazy",
      url: createPageUrl("WorkOrders"),
      icon: ClipboardList,
      badge: myWorkOrders.length > 0 && user?.user_type === "technician" ? myWorkOrders.length : 0,
    },
    {
      title: "Vibrace online",
      url: createPageUrl("VibrationOnline"),
      icon: Radio,
    },
    ...(user?.user_type === "superAdmin" || user?.user_type === "admin"
      ? [
          {
            title: "Typy ložisek",
            url: createPageUrl("AdminBearings"),
            icon: Settings,
          },
        ]
      : []),
    ...(user?.user_type === "manager" || user?.user_type === "admin" || user?.user_type === "superAdmin"
      ? [
          {
            title: "Správa závad",
            url: createPageUrl("IssueApproval"),
            icon: AlertTriangle,
            badge: pendingIssuesCount,
          },
          {
            title: "Audit Log",
            url: createPageUrl("AuditLog"),
            icon: Activity,
          },
        ]
      : []),
    ...(user?.user_type === "superAdmin" || user?.user_type === "admin" || user?.user_type === "manager"
      ? [
          {
            title: "Administrace",
            url: createPageUrl("Admin"),
            icon: Building2,
          },
        ]
      : []),
    ...(user?.user_type === "superAdmin" || user?.user_type === "admin" || user?.user_type === "manager"
      ? [
          {
            title: "Uživatelé",
            url: createPageUrl("Users"),
            icon: Users,
          },
        ]
      : []),
    ...(user?.user_type === "superAdmin" || user?.user_type === "admin"
      ? [
          {
            title: "Nastavení",
            url: createPageUrl("Settings"),
            icon: Settings,
          },
        ]
      : []),
    {
      title: "Novinky",
      url: createPageUrl("Changelog"),
      icon: Sparkles,
    },
    {
      title: "O aplikaci",
      url: createPageUrl("About"),
      icon: Info,
    },
    ...(user?.user_type === "superAdmin"
      ? [
          {
            title: "API Dokumentace",
            url: createPageUrl("ApiDocumentation"),
            icon: Code,
          },
          {
            title: "Log ladění",
            url: createPageUrl("DebugLog"),
            icon: Terminal,
          },
        ]
      : []),
  ];

  const ViewModeToggle = () => (
    <Button
      onClick={() => {
        toggleViewMode();
        setTimeout(() => {
          navigate(createPageUrl("Dashboard"), { replace: true });
        }, 0);
      }}
      variant="outline"
      size="sm"
      className="gap-2 border-2 w-full justify-start"
      style={{
        borderColor: viewMode === 'demip' ? '#2150D8' : '#64748b',
        backgroundColor: viewMode === 'demip' ? '#eff6ff' : 'white',
      }}
    >
      {viewMode === 'demip' ? (
        <>
          <Droplet className="w-4 h-4" style={{ color: '#2150D8' }} />
          <span className="font-semibold" style={{ color: '#2150D8' }}>Režim DEMIP</span>
        </>
      ) : (
        <>
          <Wrench className="w-4 h-4 text-slate-600" />
          <span className="font-semibold text-slate-700">Režim Údržba</span>
        </>
      )}
    </Button>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <UpdateBanner />
      <style>{`
        :root {
          --heistech-blue: #2150D8;
          --heistech-blue-dark: #1a40b0;
          --heistech-blue-light: #4d73e5;
          --heistech-orange: #FF8C00;
          --heistech-orange-dark: #cc7000;
        }
      `}</style>

      {/* Mobile Header */}
      <header className="lg:hidden bg-white border-b border-slate-200 px-4 py-3 sticky top-0 z-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center shadow-lg" style={{ background: 'linear-gradient(135deg, #2150D8 0%, #1a40b0 100%)' }}>
              <span className="text-white font-bold text-lg">H</span>
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900">HCMS</h1>
              <p className="text-xs text-slate-500">Heistech Cloud Maintenance System</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {myWorkOrders.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="relative p-2 rounded-lg hover:bg-slate-100 transition-colors">
                    <Bell className="w-5 h-5 text-slate-600" />
                    <span className="absolute -top-1 -right-1 w-5 h-5 text-white text-xs font-bold rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--heistech-orange)' }}>
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

      {/* Mobile Menu */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-white overflow-auto">
          <div className="p-6 space-y-4 pt-24">
            {/* Hide Toggle for Technicians if forced DEMIP */}
            {!(user?.user_type === 'technician' && userCompany?.force_technician_demip_mobile) && (
            <div className="mb-6">
               <Button
                 onClick={() => {
                   toggleViewMode();
                   setMobileOpen(false);
                   setTimeout(() => {
                     navigate(createPageUrl("Dashboard"), { replace: true });
                   }, 0);
                 }}
                 variant="outline"
                 size="sm"
                 className="gap-2 border-2 w-full justify-start"
                 style={{
                   borderColor: viewMode === 'demip' ? '#2150D8' : '#64748b',
                   backgroundColor: viewMode === 'demip' ? '#eff6ff' : 'white',
                 }}
               >
                 {viewMode === 'demip' ? (
                   <>
                     <Droplet className="w-4 h-4" style={{ color: '#2150D8' }} />
                     <span className="font-semibold" style={{ color: '#2150D8' }}>Režim DEMIP</span>
                   </>
                 ) : (
                   <>
                     <Wrench className="w-4 h-4 text-slate-600" />
                     <span className="font-semibold text-slate-700">Režim Údržba</span>
                   </>
                 )}
               </Button>
            </div>
            )}
            {navigationItems.map((item) => (
              <Link
                key={item.title}
                to={item.url}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center justify-between p-4 rounded-xl transition-all ${
                  item.highlight
                    ? "text-white shadow-lg"
                    : location.pathname === item.url
                    ? "text-white shadow-lg"
                    : "hover:bg-slate-100"
                }`}
                style={item.highlight || location.pathname === item.url ? {
                  background: 'linear-gradient(135deg, #2150D8 0%, #1a40b0 100%)'
                } : {}}
              >
                <div className="flex items-center gap-3">
                  <item.icon className="w-5 h-5" />
                  <span className="font-medium">{item.title}</span>
                </div>
                {item.badge > 0 && (
                  <span className="px-2 py-1 text-xs font-bold bg-orange-600 text-white rounded-full">
                    {item.badge}
                  </span>
                )}
              </Link>
            ))}
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 p-4 rounded-xl hover:bg-slate-100 text-red-600 mt-6"
            >
              <LogOut className="w-5 h-5" />
              <span className="font-medium">Odhlásit se</span>
            </button>
          </div>
        </div>
      )}

      {/* Desktop Sidebar */}
      <div className="hidden lg:flex fixed inset-y-0 left-0 z-30 w-72 flex-col bg-white border-r border-slate-200">
        {/* Sidebar Header */}
        <div className="p-6 border-b border-slate-100">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-xl flex-shrink-0" style={{ background: 'linear-gradient(135deg, #2150D8 0%, #1a40b0 100%)' }}>
              <span className="text-white font-bold text-xl">H</span>
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">HCMS</h2>
              <p className="text-xs text-slate-500 leading-tight">Heistech Cloud Maintenance System</p>
            </div>
          </div>
          
          <ViewModeToggle />
        </div>

        {/* Sidebar Navigation */}
        <div className="flex-1 overflow-y-auto p-4 space-y-1">
           <p className="px-4 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
             Menu
           </p>
           {navigationItems.map((item) => (
             <Link
               key={item.title}
               to={item.url}
               className={`flex items-center justify-between px-4 py-3 rounded-xl transition-all group ${
                 item.highlight
                   ? "text-white shadow-md mb-2"
                   : location.pathname === item.url
                   ? "text-white shadow-md"
                   : "text-slate-600 hover:bg-slate-50"
               }`}
               style={item.highlight || location.pathname === item.url ? {
                 background: 'linear-gradient(135deg, #2150D8 0%, #1a40b0 100%)'
               } : {}}
             >
               <div className="flex items-center gap-3">
                 <item.icon className={`w-5 h-5 ${(!item.highlight && location.pathname !== item.url) ? "text-slate-400 group-hover:text-slate-600" : ""}`} />
                 <span className="font-medium">{item.title}</span>
               </div>
               {item.badge > 0 && (
                 <span className="px-2 py-0.5 text-xs font-bold bg-orange-600 text-white rounded-full">
                   {item.badge}
                 </span>
               )}
             </Link>
           ))}
        </div>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-white border border-slate-100 shadow-sm mb-3">
            <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'linear-gradient(135deg, #2150D8 0%, #1a40b0 100%)' }}>
              <span className="text-white font-semibold text-sm">
                {getUserDisplayName(user)?.[0]?.toUpperCase() || "U"}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm text-slate-900 truncate">
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
            className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Odhlásit se
          </button>
        </div>
      </div>

      {/* Main Content Wrapper */}
      <div className="lg:pl-72">
        {/* Desktop Header (optional, for notifications etc) */}
        <div className="hidden lg:flex h-16 items-center justify-end px-8 bg-white/50 backdrop-blur-sm border-b border-slate-200 sticky top-0 z-20">
           {myWorkOrders.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="relative p-2 rounded-lg hover:bg-slate-100 transition-colors">
                    <Bell className="w-5 h-5 text-slate-600" />
                    <span className="absolute -top-1 -right-1 w-4 h-4 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-sm" style={{ backgroundColor: 'var(--heistech-orange)' }}>
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

        {/* Page Content */}
        <main className={`p-0 ${viewMode === 'demip' ? 'pb-20 lg:pb-0' : ''}`}>
          {children}
        </main>

        {/* Mobile Bottom Bar - DEMIP Mode Only */}
        {viewMode === 'demip' && (
          <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-2 py-3 grid grid-cols-5 gap-1 items-center z-50 pb-safe shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
            {nfcSupported ? (
              <button 
                className="flex flex-col items-center gap-1 text-blue-600 hover:text-blue-700 active:scale-95 transition-transform"
                onClick={handleNfcQuickScan}
              >
                <div className="w-6 h-6 flex items-center justify-center bg-blue-50 rounded-full border border-blue-200">
                    <Activity className="w-4 h-4" />
                </div>
                <span className="text-[10px] font-medium truncate w-full text-center">Skenovat</span>
              </button>
            ) : (
                <div className="w-full"></div> // Placeholder if NFC not supported
            )}

            <button 
              className={`flex flex-col items-center gap-1 ${location.pathname.includes('Dashboard') ? 'text-blue-600' : 'text-slate-400 hover:text-blue-600'}`}
              onClick={() => navigate(createPageUrl("Dashboard"))}
            >
              <div className="w-6 h-6"><ClipboardList className="w-6 h-6" /></div>
              <span className="text-[10px] font-medium truncate w-full text-center">Přehled</span>
            </button>

            <button 
              className={`flex flex-col items-center gap-1 ${location.pathname.includes('MobileHome') && location.search.includes('tab=orders') ? 'text-blue-600' : 'text-slate-400 hover:text-blue-600'}`}
              onClick={() => navigate(createPageUrl("MobileHome?tab=orders"))}
            >
              <div className="w-6 h-6"><Wrench className="w-6 h-6" /></div>
              <span className="text-[10px] font-medium truncate w-full text-center">Příkazy</span>
            </button>
            
            <button 
              className="flex flex-col items-center gap-1 text-slate-400 hover:text-blue-600"
              onClick={() => setMobileOpen(true)}
            >
              <div className="w-6 h-6"><Menu className="w-6 h-6" /></div>
              <span className="text-[10px] font-medium truncate w-full text-center">Menu</span>
            </button>

            <button 
              className="flex flex-col items-center gap-1 text-slate-400 hover:text-red-600"
              onClick={handleLogout}
            >
              <div className="w-6 h-6"><LogOut className="w-6 h-6" /></div>
              <span className="text-[10px] font-medium truncate w-full text-center">Odhlásit</span>
            </button>
          </div>
        )}

        <Dialog open={showNfcScanDialog} onOpenChange={setShowNfcScanDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-blue-700">
                <Activity className="w-6 h-6" />
                Skenování NFC čipu
              </DialogTitle>
              <DialogDescription>
                Přiložte NFC čip k zařízení pro identifikaci kontrolního bodu.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 text-center">
              {isNfcScanning && (
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Activity className="w-8 h-8 text-blue-600 animate-pulse" />
                </div>
              )}
              {!isNfcScanning && nfcLogs.length > 0 && (
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <AlertTriangle className="w-8 h-8 text-slate-500" />
                </div>
              )}
              
              <p className="text-lg font-semibold text-slate-900 mb-2">
                {isNfcScanning ? "Přiložte NFC čip k zařízení" : "Skenování dokončeno"}
              </p>
              
              <div className="mt-4 bg-slate-900 text-green-400 p-3 rounded-md text-left text-xs font-mono h-48 overflow-y-auto whitespace-pre-wrap">
                {nfcLogs.map((log, i) => (
                  <div key={i} className="mb-1 border-b border-slate-800 pb-1 last:border-0">{log}</div>
                ))}
                {nfcLogs.length === 0 && <span className="text-slate-500">Čekám na logy...</span>}
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowNfcScanDialog(false);
                  setIsNfcScanning(false);
                }}
              >
                Zrušit
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

export default function Layout({ children }) {
  return (
    <DebugProvider>
      <ViewModeProvider>
        <OfflineProvider>
          <LayoutContent>{children}</LayoutContent>
        </OfflineProvider>
      </ViewModeProvider>
    </DebugProvider>
  );
}