import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { ThemeId } from "@/lib/server/settings/theme";
import { colorSchemeCssVariables, colorSchemeStyle } from "@/lib/color-schemes";
import { selectColorScheme } from "@/lib/server/settings/color-schemes";
import { getThemeClasses, setThemeServerFn, themes } from "@/lib/server/settings/theme";

export type ActiveColorScheme = {
  id: number;
  name: string;
  mode: string;
  background: string;
  foreground: string;
  primary: string;
  accent: string;
};

const ThemeContext = createContext<{
  theme: ThemeId;
  customScheme: ActiveColorScheme | null;
  setTheme: (theme: ThemeId) => void;
  chooseColorScheme: (id: number) => Promise<void>;
} | null>(null);

function applyTheme(theme: ThemeId, customScheme: ActiveColorScheme | null) {
  const root = document.documentElement;
  root.classList.remove(
    ...themes.flatMap((item) =>
      getThemeClasses(item.id).split(" ").filter(Boolean),
    ),
  );
  root.classList.add(...getThemeClasses(theme).split(" ").filter(Boolean));
  for (const key of colorSchemeCssVariables) root.style.removeProperty(key);
  if (customScheme) {
    for (const [key, value] of Object.entries(colorSchemeStyle(customScheme)))
      root.style.setProperty(key, value);
  }
}

export function AppThemeProvider({
  initialTheme,
  initialColorScheme,
  children,
}: {
  initialTheme: ThemeId;
  initialColorScheme: ActiveColorScheme | null;
  children: ReactNode;
}) {
  const [theme, setCurrentTheme] = useState(initialTheme);
  const [customScheme, setCustomScheme] = useState(initialColorScheme);

  useEffect(() => {
    applyTheme(theme, customScheme);
  }, [theme, customScheme]);

  const setTheme = (next: ThemeId) => {
    setCurrentTheme(next);
    setCustomScheme(null);
    applyTheme(next, null);
    void setThemeServerFn({ data: next }).catch((error: unknown) =>
      console.error("Could not save theme", error),
    );
  };

  const chooseColorScheme = async (id: number) => {
    const selected = await selectColorScheme({ data: { id } });
    const baseTheme = selected.mode === "dark" ? "dark" : "light";
    setCurrentTheme(baseTheme);
    setCustomScheme(selected);
    applyTheme(baseTheme, selected);
  };

  return (
    <ThemeContext.Provider
      value={{ theme, customScheme, setTheme, chooseColorScheme }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useAppTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("Theme provider missing");
  return context;
}
