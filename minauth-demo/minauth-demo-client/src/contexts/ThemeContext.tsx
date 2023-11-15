'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import { DefaultTheme } from 'styled-components';

interface ThemeContextProps {
  theme: DefaultTheme;
  toggleTheme: () => void;
}

interface ThemeProviderProps {
  children: React.ReactNode;
}

const ThemeContext = createContext<ThemeContextProps | undefined>(undefined);

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [theme, setTheme] = useState<DefaultTheme>({ mode: 'light' });

  useEffect(() => {
    // This will only run on the client side, after the initial render
    const initialTheme = {
      mode: localStorage.getItem('theme-mode') || 'dark'
    } as DefaultTheme;
    setTheme(initialTheme);
  }, []);

  const toggleTheme = () => {
    const newThemeMode = theme.mode === 'light' ? 'dark' : 'light';

    setTheme(() => ({
      mode: newThemeMode
    }));
    localStorage.setItem('theme-mode', newThemeMode);
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
