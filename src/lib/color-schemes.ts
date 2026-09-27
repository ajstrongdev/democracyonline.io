import { z } from "zod";

export const selectedColorSchemeCookie = "_selected-color-scheme";

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a six-digit hex colour");

export const colorSchemeInput = z
  .object({
    name: z
      .string()
      .trim()
      .min(2)
      .max(60)
      .regex(/^[^\p{Cc}\p{Cf}]+$/u, "Use a visible theme name"),
    mode: z.enum(["light", "dark"]),
    background: hex,
    foreground: hex,
    primary: hex,
    accent: hex,
    isPublished: z.boolean(),
  })
  .refine((colors) => contrast(colors.background, colors.foreground) >= 7, {
    message: "Background and text need at least 7:1 contrast for readability",
    path: ["foreground"],
  })
  .refine((colors) => contrast(colors.background, colors.primary) >= 4.5, {
    message:
      "Primary colour needs at least 4.5:1 contrast against the background",
    path: ["primary"],
  });

export type ColorSchemeColors = Pick<
  z.infer<typeof colorSchemeInput>,
  "mode" | "background" | "foreground" | "primary" | "accent"
>;

function luminance(color: string) {
  const channels = [1, 3, 5].map((index) => {
    const value = parseInt(color.slice(index, index + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

export function contrast(first: string, second: string) {
  const a = luminance(first);
  const b = luminance(second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

function readableText(background: string) {
  return contrast(background, "#ffffff") > contrast(background, "#000000")
    ? "#ffffff"
    : "#000000";
}

// Only validated hex strings reach these CSS declarations. No player-written
// CSS, URLs or arbitrary variable names are ever injected into the page.
export function colorSchemeStyle(
  colors: Omit<ColorSchemeColors, "mode">,
): Record<string, string> {
  const { background, foreground, primary, accent } = colors;
  const surface = `color-mix(in srgb, ${background} 97%, ${foreground})`;
  const subtle = `color-mix(in srgb, ${background} 90%, ${foreground})`;
  const border = `color-mix(in srgb, ${background} 75%, ${foreground})`;
  const accentSurface = `color-mix(in srgb, ${background} 72%, ${accent})`;
  return {
    "--background": background,
    "--foreground": foreground,
    "--card": surface,
    "--card-foreground": foreground,
    "--popover": surface,
    "--popover-foreground": foreground,
    "--primary": primary,
    "--primary-foreground": readableText(primary),
    "--secondary": subtle,
    "--secondary-foreground": foreground,
    "--muted": subtle,
    "--muted-foreground": `color-mix(in srgb, ${foreground} 80%, ${background})`,
    "--accent": accentSurface,
    "--accent-foreground": foreground,
    "--border": border,
    "--input": border,
    "--ring": primary,
    "--chart-1": primary,
    "--chart-2": accent,
    "--chart-3": `color-mix(in srgb, ${primary} 70%, ${accent})`,
    "--chart-4": `color-mix(in srgb, ${primary} 40%, ${accent})`,
    "--chart-5": `color-mix(in srgb, ${foreground} 50%, ${primary})`,
    "--sidebar": surface,
    "--sidebar-foreground": foreground,
    "--sidebar-primary": primary,
    "--sidebar-primary-foreground": readableText(primary),
    "--sidebar-accent": accentSurface,
    "--sidebar-accent-foreground": foreground,
    "--sidebar-border": border,
    "--sidebar-ring": primary,
  };
}

export const colorSchemeCssVariables = Object.keys(
  colorSchemeStyle({
    background: "#000000",
    foreground: "#ffffff",
    primary: "#ffffff",
    accent: "#ffffff",
  }),
);
