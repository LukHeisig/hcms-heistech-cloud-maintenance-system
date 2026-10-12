import React from "react";
import { Activity, Cpu, Gauge, Bell } from "lucide-react";
import SectionTabs from "@/components/SectionTabs";
import AdminVibrations from "@/pages/AdminVibrations";
import AdminBearings from "@/pages/AdminBearings";
import AlertRecipients from "@/pages/AlertRecipients";
import AdminThermo from "@/pages/AdminThermo";
import MqttSensors from "@/pages/MqttSensors";
import VseUnits from "@/pages/VseUnits";

const sections = [
  { value: "vibration", label: "Vibrodiagnostika", icon: Activity, component: AdminVibrations },
  { value: "bearings", label: "Typy ložisek", icon: Gauge, component: AdminBearings },
  { value: "alerts", label: "Notifikace alarmů", icon: Bell, component: AlertRecipients },
  { value: "thermo", label: "Termodiagnostika", icon: Activity, component: AdminThermo },
  { value: "mqtt", label: "MQTT Senzory", icon: Cpu, component: MqttSensors },
  { value: "vse", label: "VSE jednotky", icon: Cpu, component: VseUnits },
];

export default function Settings() {
  return <SectionTabs title="Nastavení" description="Konfigurace systému a číselníků" sections={sections} />;
}