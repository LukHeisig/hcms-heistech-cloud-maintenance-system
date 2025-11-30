import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useOffline } from "@/components/OfflineProvider";
import { format } from "date-fns";
import { cs } from "date-fns/locale";
import {
  ClipboardList,
  QrCode,
  AlertTriangle,
  Search,
  ChevronRight,
  Clock,
  MapPin,
  Camera,
  LogOut,
  User,
  CheckCircle,
  Menu
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export default function MobileHome() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    const currentUser = await base44.auth.me();
    setUser(currentUser);
  };

  const { getCachedData, setCachedData, isOnline } = useOffline();
  
  const location = useLocation();
  
  // Persist active tab with URL support
  const [activeTab, setActiveTab] = useState(() => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get("tab") || localStorage.getItem("mobile_active_tab") || "checklist";
  });

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tabParam = urlParams.get("tab");
    if (tabParam && tabParam !== activeTab) {
      setActiveTab(tabParam);
    }
  }, [location.search]);

  useEffect(() => {
    localStorage.setItem("mobile_active_tab", activeTab);
  }, [activeTab]);

  // Fetch assignments
  const { data: myWorkOrders = [] } = useQuery({
    queryKey: ["myWorkOrdersMobile", user?.email],
    queryFn: async () => {
      if (!user?.email) return [];
      return base44.entities.PlannedMaintenance.filter({
        assigned_to: user.email,
        status: "assigned"
      }, "planned_date");
    },
    enabled: !!user?.email && isOnline,
    initialData: () => getCachedData(`myWorkOrdersMobile_${user?.email}`) || [],
    onSuccess: (data) => setCachedData(`myWorkOrdersMobile_${user?.email}`, data),
  });

  // Fetch machines for search and checklist
  const { data: machines = [] } = useQuery({
    queryKey: ["machinesMobile"],
    queryFn: () => base44.entities.Machine.list(),
    enabled: isOnline,
    initialData: () => getCachedData("machinesMobile") || [],
    onSuccess: (data) => setCachedData("machinesMobile", data),
  });

  // Fetch lines responsible by user
  const { data: myLines = [] } = useQuery({
    queryKey: ["myLinesMobile", user?.email],
    queryFn: () => base44.entities.Line.filter({ responsible_person_email: user?.email }),
    enabled: !!user?.email && isOnline,
    initialData: () => getCachedData(`myLinesMobile_${user?.email}`) || [],
    onSuccess: (data) => setCachedData(`myLinesMobile_${user?.email}`, data),
  });

  // Fetch prevention points
  const { data: preventionPoints = [] } = useQuery({
    queryKey: ["preventionPointsMobile"],
    queryFn: () => base44.entities.ControlPoint.filter({ type: "prevention" }),
    enabled: isOnline,
    initialData: () => getCachedData("preventionPointsMobile") || [],
    onSuccess: (data) => setCachedData("preventionPointsMobile", data),
  });

  const myPreventionMachines = React.useMemo(() => {
    if (myLines.length === 0) return [];
    const myLineIds = myLines.map(l => l.id);
    const machinesInMyLines = machines.filter(m => myLineIds.includes(m.line_id));
    
    // Filter machines that have prevention points
    return machinesInMyLines.filter(m => 
      preventionPoints.some(cp => cp.machine_id === m.id)
    );
  }, [myLines, machines, preventionPoints]);

  useEffect(() => {
    if (searchQuery.trim().length > 1) {
      const filtered = machines.filter(m => 
        m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (m.inventory_number && m.inventory_number.toLowerCase().includes(searchQuery.toLowerCase()))
      );
      setSearchResults(filtered.slice(0, 5));
    } else {
      setSearchResults([]);
    }
  }, [searchQuery, machines]);

  const handleLogout = async () => {
    await base44.auth.logout();
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Mobile Header */}
      <div className="bg-blue-600 text-white p-6 rounded-b-3xl shadow-lg sticky top-0 z-10">
        <div className="flex justify-between items-start mb-4">
          <div>
            <p className="text-blue-100 text-sm font-medium">Vítejte zpět,</p>
            <h1 className="text-2xl font-bold">{user.full_name?.split(' ')[0] || 'Techniku'}</h1>
          </div>
          <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center border-2 border-blue-400">
            <User className="w-6 h-6 text-white" />
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-3 w-5 h-5 text-blue-300" />
          <Input 
            className="pl-10 bg-white/10 border-blue-500 text-white placeholder:text-blue-200 focus:bg-white/20 rounded-xl h-12"
            placeholder="Hledat stroj nebo kód..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          
          {/* Search Results Dropdown */}
          {searchResults.length > 0 && (
            <div className="absolute top-14 left-0 right-0 bg-white rounded-xl shadow-xl z-20 overflow-hidden border border-slate-100">
              {searchResults.map(machine => (
                <div 
                  key={machine.id}
                  className="p-3 border-b border-slate-100 last:border-0 hover:bg-slate-50 active:bg-slate-100 flex justify-between items-center"
                  onClick={() => navigate(createPageUrl(`Machine?id=${machine.id}`))}
                >
                  <div>
                    <p className="font-semibold text-slate-800">{machine.name}</p>
                    <p className="text-xs text-slate-500">{machine.inventory_number || "Bez inv. čísla"}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* Quick Actions Grid */}
        <section>
          <h2 className="text-slate-500 text-sm font-bold uppercase tracking-wider mb-3 px-1">Rychlé akce</h2>
          <div className="grid grid-cols-2 gap-3">
            <Card 
              className="bg-white border-none shadow-sm active:scale-95 transition-transform cursor-pointer"
              onClick={() => document.querySelector('input[placeholder="Hledat stroj nebo kód..."]').focus()}
            >
              <CardContent className="p-4 flex flex-col items-center text-center gap-2">
                <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-2xl flex items-center justify-center mb-1">
                  <QrCode className="w-6 h-6" />
                </div>
                <span className="font-semibold text-slate-700 text-sm">Najít stroj</span>
              </CardContent>
            </Card>

            <Card 
              className="bg-white border-none shadow-sm active:scale-95 transition-transform cursor-pointer"
              onClick={() => navigate(createPageUrl("IssueApproval?action=report"))}
            >
              <CardContent className="p-4 flex flex-col items-center text-center gap-2">
                <div className="w-12 h-12 bg-orange-100 text-orange-600 rounded-2xl flex items-center justify-center mb-1">
                  <Camera className="w-6 h-6" />
                </div>
                <span className="font-semibold text-slate-700 text-sm">Nahlásit závadu</span>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Tabs: Orders vs Checklist */}
        <section>
          <div className="flex bg-slate-200 p-1 rounded-xl mb-4">
            <button
              onClick={() => setActiveTab("orders")}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                activeTab === "orders" 
                  ? "bg-white text-blue-600 shadow-sm" 
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Moje pracovní příkazy
              {myWorkOrders.length > 0 && (
                <span className="ml-2 bg-blue-100 text-blue-700 text-[10px] px-1.5 py-0.5 rounded-full">
                  {myWorkOrders.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab("checklist")}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                activeTab === "checklist" 
                  ? "bg-white text-purple-600 shadow-sm" 
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Můj check list
              {myPreventionMachines.length > 0 && (
                <span className="ml-2 bg-purple-100 text-purple-700 text-[10px] px-1.5 py-0.5 rounded-full">
                  {myPreventionMachines.length}
                </span>
              )}
            </button>
          </div>

          {activeTab === "orders" && (
            <div className="space-y-3">
              {myWorkOrders.length === 0 ? (
                <Card className="bg-white border-dashed border-2 border-slate-200 shadow-none">
                  <CardContent className="p-6 text-center">
                    <CheckCircle className="w-10 h-10 text-green-500 mx-auto mb-2" />
                    <p className="text-slate-600 font-medium">Vše hotovo!</p>
                    <p className="text-xs text-slate-400">Nemáte žádné přiřazené pracovní příkazy.</p>
                  </CardContent>
                </Card>
              ) : (
                myWorkOrders.map(order => {
                  const isOverdue = new Date(order.planned_date) < new Date();
                  const machine = machines.find(m => m.id === order.machine_id);
                  return (
                    <Card 
                      key={order.id} 
                      className="bg-white border-none shadow-sm active:bg-slate-50 transition-colors cursor-pointer"
                      onClick={() => navigate(createPageUrl(`Machine?id=${order.machine_id}#maintenance`))}
                    >
                      <CardContent className="p-4 flex items-center gap-4">
                        <div className={`w-2 h-12 rounded-full flex-shrink-0 ${isOverdue ? 'bg-red-500' : 'bg-blue-500'}`} />
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start mb-1">
                            <h3 className="font-bold text-slate-800 truncate pr-2">{order.title}</h3>
                            {isOverdue && <Badge variant="destructive" className="text-[10px] px-1 h-5">Po termínu</Badge>}
                          </div>
                          
                          <div className="flex items-center gap-3 text-xs text-slate-500">
                            <div className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              <span>{format(new Date(order.planned_date), "d.M.", { locale: cs })}</span>
                            </div>
                            <div className="flex items-center gap-1 truncate">
                              <MapPin className="w-3 h-3" />
                              <span className="truncate">{machine?.name || "Stroj..."}</span> 
                            </div>
                          </div>
                        </div>
                        
                        <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center flex-shrink-0">
                          <ChevronRight className="w-5 h-5 text-slate-400" />
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
              
              {myWorkOrders.length > 0 && (
                <Button 
                  variant="ghost" 
                  className="w-full mt-2 text-blue-600"
                  onClick={() => navigate(createPageUrl("WorkOrders"))}
                >
                  Zobrazit všechny příkazy
                </Button>
              )}
            </div>
          )}

          {activeTab === "checklist" && (
            <div className="space-y-3">
              {myPreventionMachines.length === 0 ? (
                <Card className="bg-white border-dashed border-2 border-slate-200 shadow-none">
                  <CardContent className="p-6 text-center">
                    <ClipboardList className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                    <p className="text-slate-600 font-medium">Žádné stroje k prevenci</p>
                    <p className="text-xs text-slate-400">Nejste zodpovědný za žádnou linku nebo stroje nemají nastavenou prevenci.</p>
                  </CardContent>
                </Card>
              ) : (
                myPreventionMachines.map(machine => {
                  const pointsCount = preventionPoints.filter(p => p.machine_id === machine.id).length;
                  return (
                    <Card 
                      key={machine.id} 
                      className="bg-white border-none shadow-sm active:bg-slate-50 transition-colors cursor-pointer"
                      onClick={() => navigate(createPageUrl(`Machine?id=${machine.id}&tab=control-points&subtab=prevention`))}
                    >
                      <CardContent className="p-4 flex items-center gap-4">
                        <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                          <ClipboardList className="w-5 h-5 text-purple-600" />
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-slate-800 truncate">{machine.name}</h3>
                          <p className="text-xs text-slate-500">{pointsCount} bodů prevence</p>
                        </div>
                        
                        <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center flex-shrink-0">
                          <ChevronRight className="w-5 h-5 text-slate-400" />
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          )}
        </section>

      </div>
    </div>
  );
}