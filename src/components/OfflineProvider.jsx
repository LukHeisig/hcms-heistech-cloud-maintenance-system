import React, { createContext, useContext, useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import { Wifi, WifiOff, RefreshCw } from "lucide-react";

const OfflineContext = createContext();

export function useOffline() {
  return useContext(OfflineContext);
}

export function OfflineProvider({ children }) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingActions, setPendingActions] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("offline_action_queue") || "[]");
    } catch {
      return [];
    }
  });
  const { toast } = useToast();

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    if (isOnline && pendingActions.length > 0) {
      syncData();
    }
  }, [isOnline, pendingActions]);

  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = error => reject(error);
    });
  };

  const base64ToFile = async (base64String, fileName) => {
    const res = await fetch(base64String);
    const blob = await res.blob();
    return new File([blob], fileName, { type: blob.type });
  };

  const saveAction = async (action) => {
    const processedPayload = { ...action.payload };
    
    // Handle file serialization (for photos)
    if (processedPayload.photo instanceof File) {
      try {
        processedPayload.photo = {
          _isOfflineFile: true,
          name: processedPayload.photo.name,
          content: await fileToBase64(processedPayload.photo)
        };
      } catch (e) {
        console.error("Failed to serialize offline file", e);
        processedPayload.photo = null;
      }
    }

    const newQueue = [...pendingActions, { ...action, payload: processedPayload, id: Date.now(), timestamp: new Date().toISOString() }];
    setPendingActions(newQueue);
    try {
      localStorage.setItem("offline_action_queue", JSON.stringify(newQueue));
    } catch (e) {
      console.error("LocalStorage quota exceeded", e);
      toast({ title: "Chyba ukládání", description: "Nedostatek místa pro offline data.", variant: "destructive" });
      return;
    }

    toast({
      title: "Uloženo offline",
      description: "Data a fotografie budou nahrány po obnovení připojení.",
      variant: "default",
    });
  };

  const syncData = async () => {
    if (isSyncing || pendingActions.length === 0) return;

    setIsSyncing(true);
    let syncedCount = 0;
    const failedActions = [];

    for (const action of pendingActions) {
      try {
        switch (action.type) {
          case "create_control_record":
            await base44.entities.ControlRecord.create(action.payload);
            break;
          case "create_issue":
            let issuePayload = { ...action.payload };
            
            // Handle offline photo upload if present
            if (issuePayload.photo && issuePayload.photo._isOfflineFile) {
              try {
                const file = await base64ToFile(issuePayload.photo.content, issuePayload.photo.name);
                const { file_url } = await base44.integrations.Core.UploadFile({ file });
                issuePayload.photo_url = file_url;
              } catch (uploadError) {
                console.error("Failed to upload offline photo:", uploadError);
                // Continue creating issue but without photo if upload fails
              }
              delete issuePayload.photo; // Remove the temporary file object
            }

            await base44.entities.Issue.create(issuePayload);
            break;
          case "update_control_point":
            await base44.entities.ControlPoint.update(action.payload.id, action.payload.data);
            break;
          default:
            console.warn("Unknown offline action type:", action.type);
        }
        syncedCount++;
      } catch (error) {
        console.error("Sync failed for action:", action, error);
        failedActions.push(action);
      }
    }

    setPendingActions(failedActions);
    localStorage.setItem("offline_action_queue", JSON.stringify(failedActions));
    setIsSyncing(false);

    if (syncedCount > 0) {
      toast({
        title: "Synchronizace dokončena",
        description: `Úspěšně nahráno ${syncedCount} položek.`,
        variant: "success",
      });
      // Refresh pages/queries via window reload or query invalidation if possible
      // Simple approach: 
      // queryClient.invalidateQueries() would be ideal but we don't have access to it here directly easily without passing it
    }
  };

  // Data Caching Helpers
  const getCachedData = (key) => {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : undefined;
    } catch {
      return undefined;
    }
  };

  const setCachedData = (key, data) => {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
      console.warn("Failed to cache data (quota exceeded?)", e);
    }
  };

  return (
    <OfflineContext.Provider value={{ isOnline, saveAction, getCachedData, setCachedData, pendingActions }}>
      {children}
      {!isOnline && (
        <div className="fixed bottom-20 left-4 right-4 z-50 bg-slate-900/95 backdrop-blur text-white px-4 py-3 rounded-xl shadow-2xl flex items-center justify-between border border-slate-700 animate-in slide-in-from-bottom-10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-slate-700 rounded-full flex items-center justify-center">
              <WifiOff className="w-4 h-4 text-slate-300" />
            </div>
            <div>
              <p className="text-sm font-bold">Jste offline</p>
              <p className="text-xs text-slate-400">Změny se uloží lokálně</p>
            </div>
          </div>
          {pendingActions.length > 0 && (
            <div className="bg-orange-500/20 text-orange-300 px-3 py-1 rounded-full text-xs font-bold border border-orange-500/30">
              {pendingActions.length} k odeslání
            </div>
          )}
        </div>
      )}
      {isOnline && pendingActions.length > 0 && (
        <div className="fixed bottom-20 left-4 right-4 z-50 bg-blue-600/95 backdrop-blur text-white px-4 py-3 rounded-xl shadow-2xl flex items-center justify-between border border-blue-500 animate-in slide-in-from-bottom-10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
              <RefreshCw className={`w-4 h-4 ${isSyncing ? "animate-spin" : ""}`} />
            </div>
            <div>
              <p className="text-sm font-bold">{isSyncing ? "Synchronizuji..." : "Připojeno"}</p>
              <p className="text-xs text-blue-100">{isSyncing ? "Nahrávám uložená data" : "Čeká na synchronizaci"}</p>
            </div>
          </div>
          <div className="bg-blue-500/30 text-white px-3 py-1 rounded-full text-xs font-bold border border-blue-400/30">
            {pendingActions.length} zbývá
          </div>
        </div>
      )}
    </OfflineContext.Provider>
  );
}