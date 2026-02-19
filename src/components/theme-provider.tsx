import { useRouter } from "@tanstack/react-router";
import { createContext, use } from "react";
import type { PropsWithChildren } from "react";
import type { ThemeId } from "@/lib/server/theme";
import { setThemeServerFn } from "@/lib/server/theme";

type ThemeContextVal = { theme: ThemeId; setTheme: (val: ThemeId) => void };
type Props = PropsWithChildren<{ theme: ThemeId }>;

const ThemeContext = createContext<ThemeContextVal | null>(null);

export function ThemeProvider({ children, theme }: Props) {
  const router = useRouter();

  function setTheme(val: ThemeId) {
    setThemeServerFn({ data: val }).then(() => router.invalidate());
  }

  return <ThemeContext value={{ theme, setTheme }}>{children}</ThemeContext>;
}

export function useTheme() {
  const val = use(ThemeContext);
  if (!val) throw new Error("useTheme called outside of ThemeProvider!");
  return val;
}
