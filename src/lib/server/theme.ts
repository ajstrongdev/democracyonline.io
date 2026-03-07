import { createServerFn } from "@tanstack/react-start";
import { getCookie, setCookie } from "@tanstack/react-start/server";
import { defineThemes } from "@ajstrongdev/start-themes";

export const themeConfig = defineThemes({
  themes: [
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
  ],
  defaultTheme: "dark",
  cookieKey: "_preferred-theme",
});

export const { themes } = themeConfig;
export type ThemeId = (typeof themeConfig)["themeIds"][number];

export const getThemeServerFn = createServerFn().handler(() =>
  themeConfig.resolveTheme(getCookie(themeConfig.cookieKey)),
);

export const setThemeServerFn = createServerFn({ method: "POST" })
  .inputValidator(themeConfig.validateTheme)
  .handler(({ data }) =>
    setCookie(themeConfig.cookieKey, data, {
      maxAge: themeConfig.cookieMaxAge,
    }),
  );

export const getThemeClasses = themeConfig.getClasses;
