import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, FileText, Cpu, Gauge, Bell } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function Settings() {
  const navigate = useNavigate();

  return (
    <div className="p-4 md:p-8 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Nastavení</h1>
        <p className="text-slate-500 mb-8">Konfigurace systému a číselníků</p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
           {/* Vibrodiagnostika */}
           <div className="group">
             <Card 
               className="hover:shadow-lg transition-all cursor-pointer border-2 border-transparent hover:border-purple-500 h-full"
               onClick={() => navigate(createPageUrl("AdminVibrations"))}
             >
               <CardHeader>
                 <CardTitle className="flex items-center gap-3 text-slate-800">
                   <div className="p-2 bg-purple-100 rounded-lg">
                     <Activity className="w-6 h-6 text-purple-600" />
                   </div>
                   Vibrodiagnostika
                 </CardTitle>
               </CardHeader>
               <CardContent>
                 <p className="text-sm text-slate-600">
                   Definice norem vibrací (ČSN), limitů (A-D) a schémat měřících bodů pro stroje.
                 </p>
               </CardContent>
             </Card>
             {/* Podložka: Typy ložisek */}
             <Card 
               className="mt-3 hover:shadow-lg transition-all cursor-pointer border-2 border-transparent hover:border-purple-400 bg-slate-50"
               onClick={() => navigate(createPageUrl("AdminBearings"))}
             >
               <CardContent className="p-4 flex items-center gap-3">
                 <div className="p-2 bg-purple-50 rounded-lg">
                   <Gauge className="w-4 h-4 text-purple-500" />
                 </div>
                 <div>
                   <p className="text-sm font-semibold text-slate-700">Typy ložisek</p>
                   <p className="text-xs text-slate-500">Katalog a parametry ložisek</p>
                 </div>
               </CardContent>
             </Card>
             {/* Podložka: Notifikace alarmů */}
             <Card 
               className="mt-3 hover:shadow-lg transition-all cursor-pointer border-2 border-transparent hover:border-red-400 bg-slate-50"
               onClick={() => navigate(createPageUrl("AlertRecipients"))}
             >
               <CardContent className="p-4 flex items-center gap-3">
                 <div className="p-2 bg-red-50 rounded-lg">
                   <Bell className="w-4 h-4 text-red-500" />
                 </div>
                 <div>
                   <p className="text-sm font-semibold text-slate-700">Notifikace alarmů</p>
                   <p className="text-xs text-slate-500">Příjemci e-mailů při alarmu C/D</p>
                 </div>
               </CardContent>
             </Card>
             </div>

          {/* Termodiagnostika */}
          <Card 
            className="hover:shadow-lg transition-all cursor-pointer border-2 border-transparent hover:border-orange-500"
            onClick={() => navigate(createPageUrl("AdminThermo"))}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-slate-800">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <Activity className="w-6 h-6 text-orange-600" />
                </div>
                Termodiagnostika
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-600">
                Nastavení výchozích hodnot pro termodiagnostiku (diagnostik, kamera, kalibrace).
              </p>
            </CardContent>
          </Card>

          {/* MQTT Senzory AISSENS */}
          <Card 
            className="hover:shadow-lg transition-all cursor-pointer border-2 border-transparent hover:border-blue-500"
            onClick={() => navigate(createPageUrl("MqttSensors"))}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-slate-800">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Cpu className="w-6 h-6 text-blue-600" />
                </div>
                MQTT Senzory
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-600">
                Správa vibračních senzorů AISSENS připojených přes MQTT webhook. Přehled stavu, baterie, signálu a příjmu dat.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}