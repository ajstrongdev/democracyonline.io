import type { Preview, Decorator } from "@storybook/react-vite";
import React from "react";
import "../src/styles.css";

/** Theme name -> the class that activates it in `src/styles.css`. */
const THEMES: Record<string, string> = {
  light: "",
  dark: "dark",
  t3: "t3",
  dracula: "dracula",
  "rose-pine": "rose-pine",
  "catppuccin-dark": "catppuccin-dark",
  nord: "nord",
  solarized: "solarized",
  "solarized-light": "solarized-light",
};

/**
 * Wrap every story in a full-bleed surface that pulls its background and text
 * colour straight from the design tokens in `styles.css`, scoped by the theme
 * class selected in the toolbar.
 */
const withTheme: Decorator = (Story, context) => {
  const theme = (context.globals.theme as string) ?? "dark";
  const themeClass = THEMES[theme] ?? "";

  return (
    <div
      className={`${themeClass} bg-background text-foreground`}
      style={{
        minHeight: "100vh",
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem",
      }}
    >
      <Story />
    </div>
  );
};

const preview: Preview = {
  globalTypes: {
    theme: {
      description: "Colour theme (from styles.css)",
      defaultValue: "dark",
      toolbar: {
        title: "Theme",
        icon: "paintbrush",
        items: Object.keys(THEMES).map((value) => ({ value, title: value })),
        dynamicTitle: true,
      },
    },
  },
  decorators: [withTheme],
  parameters: {
    layout: "fullscreen",
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
};

export default preview;
