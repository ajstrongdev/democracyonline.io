import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { ThemeId } from "@/lib/server/theme";
import { getThemeClasses, setThemeServerFn, themes } from "@/lib/server/theme";

const ThemeContext = createContext<{
  theme: ThemeId;
  setTheme: (theme: ThemeId) => void;
} | null>(null);

function applyTheme(theme: ThemeId) {
  const root = document.documentElement;
  root.classList.remove(...themes.flatMap((item) => getThemeClasses(item.id).split(" ").filter(Boolean)));
  root.classList.add(...getThemeClasses(theme).split(" ").filter(Boolean));
}

export function AppThemeProvider({ initialTheme, children }: { initialTheme: ThemeId; children: ReactNode }) {
  const [theme, setCurrentTheme] = useState(initialTheme);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const setTheme = (next: ThemeId) => {
    setCurrentTheme(next);
    applyTheme(next);
    void setThemeServerFn({ data: next }).catch((error: unknown) => console.error("Could not save theme", error));
  };

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

export function useAppTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("Theme provider missing");
  return context;
}
