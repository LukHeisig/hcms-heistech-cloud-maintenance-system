import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, Check, Webhook } from "lucide-react";

const WEBHOOK_URL = "https://demip-sprava-mazacich-planu-76f2ef4a.base44.app/functions/opcUaWebhook";

const EXAMPLE = `{
  "unit_id": "VSE-01",
  "unit_name": "Čerpadlo P1",
  "timestamp": "2026-09-18T05:30:00Z",
  "values": [
    { "node_id": "ns=2;s=Ch1.vRMS", "name": "v-RMS Ch1", "value": 1.23, "unit": "mm/s" },
    { "node_id": "ns=2;s=Temp", "name": "Teplota", "value": 41.5, "unit": "°C" }
  ]
}`;

export default function VseWebhookInfo() {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(WEBHOOK_URL);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-slate-800 text-base">
          <Webhook className="w-5 h-5 text-teal-600" /> Nastavení OPC UA bridge
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div>
          <p className="text-xs font-semibold text-slate-500 mb-1">Webhook URL (POST)</p>
          <div className="flex gap-2">
            <code className="flex-1 bg-slate-100 px-3 py-2 rounded text-xs break-all">{WEBHOOK_URL}</code>
            <Button size="sm" variant="outline" onClick={copy}>
              {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
            </Button>
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold text-slate-500 mb-1">Autentizace</p>
          <code className="block bg-slate-100 px-3 py-2 rounded text-xs">Authorization: Bearer &lt;OPC_UA_WEBHOOK_TOKEN&gt;</code>
          <p className="text-xs text-slate-500 mt-1">Token je uložen v tajných proměnných aplikace (OPC_UA_WEBHOOK_TOKEN).</p>
        </div>
        <div>
          <p className="text-xs font-semibold text-slate-500 mb-1">Formát payloadu (JSON)</p>
          <pre className="bg-slate-900 text-green-300 px-3 py-2 rounded text-xs overflow-x-auto">{EXAMPLE}</pre>
        </div>
      </CardContent>
    </Card>
  );
}