"use client";


import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { getItem, setItem, KEYS } from "@/lib/storage";

interface ThemeContextValue {
  isDark: boolean;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  isDark: true,
  toggle: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

export default function ThemeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    // Read saved preference; default to dark
    const saved = getItem<boolean>(KEYS.DARK_MODE);
    const dark = saved === null ? true : saved;
    setIsDark(dark);
    applyTheme(dark);
  }, []);

  const toggle = useCallback(() => {
    setIsDark((prev) => {
      const next = !prev;
      applyTheme(next);
      setItem(KEYS.DARK_MODE, next);
      return next;
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ isDark, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

function applyTheme(dark: boolean) {
  if (typeof document === "undefined") return;
  if (dark) {
    document.documentElement.classList.remove("light");
  } else {
    document.documentElement.classList.add("light");
  }
}
