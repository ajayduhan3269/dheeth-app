import React, { createContext, useContext, useState } from 'react';

const AppModeContext = createContext();

export const useAppMode = () => {
  const context = useContext(AppModeContext);
  if (!context) throw new Error('useAppMode must be used within AppModeProvider');
  return context;
};

export const AppModeProvider = ({ children }) => {
  const [mode, setMode] = useState(() => {
    return localStorage.getItem('dheeth_mode') || 'tech';
  });

  const toggleMode = (newMode) => {
    setMode(newMode);
    localStorage.setItem('dheeth_mode', newMode);
  };

  return (
    <AppModeContext.Provider value={{ mode, toggleMode }}>
      {children}
    </AppModeContext.Provider>
  );
};