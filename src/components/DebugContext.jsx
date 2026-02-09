import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { base44 } from "@/api/base44Client";

const DebugContext = createContext();

export const useDebug = () => useContext(DebugContext);

export const DebugProvider = ({ children }) => {
  const [logs, setLogs] = useState([]);
  const logBufferRef = useRef([]);
  const isFlushingRef = useRef(false);

  // Flush logs to DB every 5 seconds
  useEffect(() => {
    const flushLogs = async () => {
      if (logBufferRef.current.length === 0 || isFlushingRef.current) return;
      
      isFlushingRef.current = true;
      const logsToFlush = [...logBufferRef.current];
      logBufferRef.current = [];

      try {
        // Prepare data for bulk create
        // Limit to 50 logs per batch to avoid payload issues
        const batch = logsToFlush.slice(0, 50);
        const remaining = logsToFlush.slice(50);
        
        if (remaining.length > 0) {
          logBufferRef.current = [...remaining, ...logBufferRef.current];
        }

        if (batch.length > 0) {
          await base44.entities.SystemLog.bulkCreate(batch.map(log => ({
            type: log.type,
            message: log.message,
            timestamp: log.timestamp,
            device_info: navigator.userAgent,
            url: window.location.href
          })));
        }
      } catch (error) {
        console.error("Failed to flush logs to DB", error);
        // Put logs back in buffer if failed? 
        // No, let's discard to prevent infinite loop of error logging -> flush -> error -> flush
      } finally {
        isFlushingRef.current = false;
      }
    };

    const interval = setInterval(flushLogs, 5000);
    
    // Also flush on visibility change (user leaves tab)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        flushLogs();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    // Store original console methods
    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;
    const originalInfo = console.info;

    // Helper to format logs
    const formatLog = (args) => {
      return args.map(arg => {
        if (arg === null) return 'null';
        if (arg === undefined) return 'undefined';
        if (typeof arg === 'object') {
          try {
            return JSON.stringify(arg, null, 2);
          } catch (e) {
            return String(arg);
          }
        }
        return String(arg);
      }).join(' ');
    };

    const addLog = (type, args) => {
      const message = formatLog(args);
      const timestamp = new Date().toISOString();
      const logEntry = { 
        type, 
        message, 
        timestamp,
        id: Date.now() + Math.random()
      };

      setLogs(prev => {
        const newLogs = [...prev, logEntry];
        return newLogs.slice(-1000);
      });

      // Add to buffer for DB upload
      // Ignore 'SystemLog' writes to prevent infinite loops if we log the logging
      if (!message.includes('SystemLog')) {
        logBufferRef.current.push(logEntry);
      }
    };

    // Override console methods
    console.log = (...args) => {
      addLog('log', args);
      originalLog.apply(console, args);
    };

    console.error = (...args) => {
      addLog('error', args);
      originalError.apply(console, args);
    };

    console.warn = (...args) => {
      addLog('warn', args);
      originalWarn.apply(console, args);
    };

    console.info = (...args) => {
      addLog('info', args);
      originalInfo.apply(console, args);
    };

    return () => {
      // Restore original methods on cleanup
      console.log = originalLog;
      console.error = originalError;
      console.warn = originalWarn;
      console.info = originalInfo;
    };
  }, []);

  return (
    <DebugContext.Provider value={{ logs, clearLogs: () => setLogs([]) }}>
      {children}
    </DebugContext.Provider>
  );
};