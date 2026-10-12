import React, { useState, useEffect } from "react";
import { Users as UsersIcon, Wrench, Building2, Database, Loader2 } from "lucide-react";
import SectionTabs from "@/components/SectionTabs";
import AdminCompanies from "@/pages/AdminCompanies";
import Users from "@/pages/Users";
import AdminCleanup from "@/pages/AdminCleanup";
import AdminExport from "@/pages/AdminExport";
import { base44 } from "@/api/base44Client";

export default function Admin() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const u = await base44.auth.me();
        setUser(u);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    loadUser();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!user) return null;

  const isManagerOrAdmin = ["manager", "admin", "superAdmin"].includes(user.user_type);
  const sections = [
    { value: "companies", label: "Správa podniků", icon: Building2, component: AdminCompanies },
    ...(isManagerOrAdmin ? [{ value: "users", label: "Uživatelé", icon: UsersIcon, component: Users }] : []),
    ...(user.user_type === "superAdmin" ? [
      { value: "cleanup", label: "Čištění dat", icon: Wrench, component: AdminCleanup },
      { value: "export", label: "Export Dat", icon: Database, component: AdminExport },
    ] : []),
  ];
  return <SectionTabs title="Administrace" sections={sections} />;
}