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

  const saveAction = (action) => {
    const newQueue = [...pendingActions, { ...action, id: Date.now(), timestamp: new Date().toISOString() }];
    setPendingActions(newQueue);
    localStorage.setItem("offline_action_queue", JSON.stringify(newQueue));
    toast({
      title: "Uloženo offline",
      description: "Data budou synchronizována po obnovení připojení.",
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
            // Note: Uploading photos offline is complex, sending null for photo if offline
            await base44.entities.Issue.create(action.payload);
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
        <div className="fixed bottom-16 left-4 right-4 z-50 bg-slate-800 text-white px-4 py-2 rounded-lg shadow-lg flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <WifiOff className="w-4 h-4" />
            <span>Offline režim</span>
          </div>
          {pendingActions.length > 0 && (
            <span className="bg-white/20 px-2 py-0.5 rounded text-xs">
              {pendingActions.length} k odeslání
            </span>
          )}
        </div>
      )}
      {isOnline && pendingActions.length > 0 && (
        <div className="fixed bottom-16 left-4 right-4 z-50 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <RefreshCw className={`w-4 h-4 ${isSyncing ? "animate-spin" : ""}`} />
            <span>{isSyncing ? "Synchronizuji data..." : "Čeká na synchronizaci"}</span>
          </div>
        </div>
      )}
    </OfflineContext.Provider>
  );
}