import React, { createContext, useContext, useEffect, useState } from 'react';

export type Theme = 'dark';

export interface ThemeOption {
  id: Theme;
  name: string;
  color: string;
  iconBg: string;
}

export const THEME_OPTIONS: ThemeOption[] = [
  { id: 'dark', name: 'Dark Slate', color: '#ffffff', iconBg: '#14171d' },
];

interface ThemeContextType {
  theme: Theme;
  cycleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme] = useState<Theme>('dark');

  useEffect(() => {
    const body = document.body;
    body.classList.remove('theme-light', 'theme-blue', 'theme-pink', 'theme-sage');
    body.classList.add('theme-dark');
    localStorage.setItem('duet_theme', 'dark');
  }, []);

  const cycleTheme = () => {};
  const setTheme = () => {};

  return (
    <ThemeContext.Provider value={{ theme, cycleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
