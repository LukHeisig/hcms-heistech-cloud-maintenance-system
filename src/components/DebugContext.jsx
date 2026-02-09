import React, { createContext, useContext, useState, useEffect } from 'react';

const DebugContext = createContext();

export const useDebug = () => useContext(DebugContext);

export const DebugProvider = ({ children }) => {
  const [logs, setLogs] = useState([]);

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
      setLogs(prev => {
        // Keep last 1000 logs to prevent memory issues
        const newLogs = [...prev, { 
          type, 
          message, 
          timestamp: new Date().toISOString(),
          id: Date.now() + Math.random()
        }];
        return newLogs.slice(-1000);
      });
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