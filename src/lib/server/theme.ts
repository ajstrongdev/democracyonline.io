import { createServerFn } from "@tanstack/react-start";
import { getCookie, setCookie } from "@tanstack/react-start/server";
import * as z from "zod";

export const themes = [
  {
    id: "light",
    label: "Default (Light)",
    isDark: false,
    swatch: "oklch(0.55 0.09 145)",
  },
  {
    id: "dark",
    label: "Default (Dark)",
    isDark: true,
    swatch: "oklch(0.58 0.07 150)",
  },
  {
    id: "dracula",
    label: "Dracula",
    isDark: true,
    swatch: "oklch(0.7 0.16 310)",
  },
  {
    id: "rose-pine",
    label: "Rosé Pine",
    isDark: true,
    swatch: "oklch(0.68 0.14 350)",
  },
  {
    id: "catppuccin-dark",
    label: "Catppuccin",
    isDark: true,
    swatch: "oklch(0.7 0.15 310)",
  },
  {
    id: "t3",
    label: "t3",
    isDark: true,
    swatch: "oklch(0.55 0.15 355)",
  },
  {
    id: "nord",
    label: "Nord",
    isDark: true,
    swatch: "oklch(0.68 0.06 240)",
  },
  {
    id: "solarized-light",
    label: "Solarized (Light)",
    isDark: false,
    swatch: "oklch(0.62 0.1 230)",
  },
  {
    id: "solarized",
    label: "Solarized",
    isDark: true,
    swatch: "oklch(0.62 0.1 230)",
  },
];

export type ThemeId = (typeof themes)[number]["id"];

const postThemeValidator = z.enum(
  themes.map((t) => t.id) as [ThemeId, ...ThemeId[]],
);
export type T = z.infer<typeof postThemeValidator>;
const storageKey = "_preferred-theme";

export const getThemeServerFn = createServerFn().handler(
  () => (getCookie(storageKey) || "dark") as T,
);

export const setThemeServerFn = createServerFn({ method: "POST" })
  .inputValidator(postThemeValidator)
  .handler(({ data }) => setCookie(storageKey, data));

export function getThemeClasses(themeId: ThemeId): string {
  const theme = themes.find((t) => t.id === themeId);
  if (!theme) return "dark";
  const classes = [themeId];
  if (theme.isDark) classes.push("dark");
  return classes.join(" ");
}
