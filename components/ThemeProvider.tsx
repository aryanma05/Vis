"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";

export type Theme = "midnight" | "dark" | "light";

type ThemeContextValue = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const STORAGE_KEY = "vis-theme";

function isValidTheme(value: string | null): value is Theme {
  return value === "midnight" || value === "dark" || value === "light";
}

export function ThemeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [theme, setThemeState] = useState<Theme>("midnight");

  useEffect(() => {
    const storedTheme = window.localStorage.getItem(STORAGE_KEY);

    const initialTheme: Theme = isValidTheme(storedTheme)
      ? storedTheme
      : "midnight";

    setThemeState(initialTheme);
    document.documentElement.dataset.theme = initialTheme;
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  function setTheme(nextTheme: Theme) {
    setThemeState(nextTheme);
    window.localStorage.setItem(STORAGE_KEY, nextTheme);
    document.documentElement.dataset.theme = nextTheme;
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }

  return context;
}