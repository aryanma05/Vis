"use client";

import React, { createContext, useCallback, useContext, useSyncExternalStore } from "react";

export type Theme = "midnight" | "dark" | "light";

type ThemeContextValue = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const STORAGE_KEY = "vis-theme";
const CHANGE_EVENT = "vis-theme-change";

export function isValidTheme(value: string | null | undefined): value is Theme {
  return value === "midnight" || value === "dark" || value === "light";
}

// Temaet leses fra data-theme på <html>, som settes av et lite skript i
// app/layout.tsx før siden tegnes. Da blinker ikke siden i feil farge.
function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function readTheme(): Theme {
  const theme = document.documentElement.dataset.theme;
  return isValidTheme(theme) ? theme : "midnight";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useSyncExternalStore(subscribe, readTheme, () => "midnight" as Theme);

  const setTheme = useCallback((nextTheme: Theme) => {
    document.documentElement.dataset.theme = nextTheme;
    try {
      window.localStorage.setItem(STORAGE_KEY, nextTheme);
    } catch {
      // Privat nettleservindu: temaet gjelder bare for denne økten.
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }

  return context;
}
