import React, { createContext, useContext, useState, useEffect } from 'react';

const ViewModeContext = createContext();

export const useViewMode = () => {
  const context = useContext(ViewModeContext);
  if (!context) {
    throw new Error('useViewMode must be used within ViewModeProvider');
  }
  return context;
};

export const ViewModeProvider = ({ children }) => {
  const [viewMode, setViewMode] = useState(() => {
    if (typeof window === 'undefined') return 'maintenance';
    try {
      const saved = localStorage.getItem('hcms_view_mode');
      return saved || 'maintenance';
    } catch {
      return 'maintenance';
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('hcms_view_mode', viewMode);
    } catch (e) {
      console.warn('Failed to save view mode', e);
    }
  }, [viewMode]);

  const toggleViewMode = () => {
    setViewMode(prev => prev === 'maintenance' ? 'demip' : 'maintenance');
  };

  return (
    <ViewModeContext.Provider value={{ viewMode, setViewMode, toggleViewMode }}>
      {children}
    </ViewModeContext.Provider>
  );
};