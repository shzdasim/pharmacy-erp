import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  // Initialize theme state - check localStorage first, default to 'light'
  const [theme, setTheme] = useState(() => {
    if (typeof window === 'undefined') return 'light';
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark' || savedTheme === 'light') {
      return savedTheme;
    }
    return 'light';
  });

  // Apply theme to document
  const applyTheme = useCallback((themeToApply) => {
    if (typeof window === 'undefined') return;
    
    const root = document.documentElement;
    if (themeToApply === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, []);

  // Apply theme whenever it changes
  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem('theme', theme);
    console.log('ThemeContext: Applied theme:', theme);
  }, [theme, applyTheme]);

  const toggleTheme = useCallback(() => {
    setTheme(prev => {
      const newTheme = prev === 'light' ? 'dark' : 'light';
      console.log('ThemeContext: Toggling from', prev, 'to', newTheme);
      return newTheme;
    });
  }, []);

  const setLightTheme = useCallback(() => {
    console.log('ThemeContext: Setting light theme');
    setTheme('light');
  }, []);

  const setDarkTheme = useCallback(() => {
    console.log('ThemeContext: Setting dark theme');
    setTheme('dark');
  }, []);

  const value = {
    theme,
    toggleTheme,
    setLightTheme,
    setDarkTheme,
    isDark: theme === 'dark'
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

