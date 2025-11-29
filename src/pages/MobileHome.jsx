import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
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
    enabled: !!user?.email,
  });

  // Fetch machines for search
  const { data: machines = [] } = useQuery({
    queryKey: ["machinesMobile"],
    queryFn: () => base44.entities.Machine.list(),
  });

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
    <div className="min-h-screen bg-slate-100 pb-20">
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

        {/* My Tasks */}
        <section>
          <div className="flex justify-between items-center mb-3 px-1">
            <h2 className="text-slate-500 text-sm font-bold uppercase tracking-wider">Moje úkoly</h2>
            <Badge className="bg-blue-600">{myWorkOrders.length}</Badge>
          </div>
          
          <div className="space-y-3">
            {myWorkOrders.length === 0 ? (
              <Card className="bg-white border-dashed border-2 border-slate-200 shadow-none">
                <CardContent className="p-6 text-center">
                  <CheckCircle className="w-10 h-10 text-green-500 mx-auto mb-2" />
                  <p className="text-slate-600 font-medium">Vše hotovo!</p>
                  <p className="text-xs text-slate-400">Nemáte žádné přiřazené úkoly.</p>
                </CardContent>
              </Card>
            ) : (
              myWorkOrders.map(order => {
                const isOverdue = new Date(order.planned_date) < new Date();
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
                            <span className="truncate">Stroj...</span> 
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
          </div>
          
          {myWorkOrders.length > 0 && (
            <Button 
              variant="ghost" 
              className="w-full mt-2 text-blue-600"
              onClick={() => navigate(createPageUrl("WorkOrders"))}
            >
              Zobrazit všechny úkoly
            </Button>
          )}
        </section>

        {/* Bottom Navigation Spacer */}
        <div className="h-16"></div>
      </div>

      {/* Bottom Sticky Nav */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-6 py-3 flex justify-between items-center z-50 pb-safe">
        <button className="flex flex-col items-center gap-1 text-blue-600">
          <div className="w-6 h-6"><ClipboardList /></div>
          <span className="text-[10px] font-medium">Přehled</span>
        </button>
        
        <button 
          className="flex flex-col items-center gap-1 text-slate-400 hover:text-blue-600"
          onClick={() => navigate(createPageUrl("Dashboard"))}
        >
          <div className="w-6 h-6"><Menu /></div>
          <span className="text-[10px] font-medium">Menu</span>
        </button>

        <button 
          className="flex flex-col items-center gap-1 text-slate-400 hover:text-red-600"
          onClick={handleLogout}
        >
          <div className="w-6 h-6"><LogOut /></div>
          <span className="text-[10px] font-medium">Odhlásit</span>
        </button>
      </div>
    </div>
  );
}