"use client";

import React from "react";
import * as LucideIcons from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { getCoalitionById } from "@/lib/server/coalitions";

interface CoalitionLogoProps {
  coalition_id: number;
  size?: number;
  color?: string | null;
  logo?: string | null;
  name?: string | null;
}

export default function CoalitionLogo({
  coalition_id,
  size = 40,
  color: colorProp,
  logo: logoProp,
  name: nameProp,
}: CoalitionLogoProps): React.ReactElement {
  const hasOverrides =
    colorProp !== undefined || logoProp !== undefined || nameProp !== undefined;

  const [data, setData] = React.useState<Awaited<
    ReturnType<typeof getCoalitionById>
  > | null>(null);

  React.useEffect(() => {
    if (!hasOverrides) {
      getCoalitionById({ data: { coalitionId: coalition_id } }).then(setData);
    }
  }, [coalition_id, hasOverrides]);

  if (!hasOverrides && !data) {
    return (
      <div
        style={{
          width: size,
          height: size,
          minWidth: size,
          minHeight: size,
          borderRadius: "50%",
          backgroundColor: "#e5e7eb",
        }}
      />
    );
  }

  const color = hasOverrides ? (colorProp ?? "#888888") : data!.color;
  const logo = hasOverrides ? logoProp : data!.logo;
  const name = hasOverrides ? (nameProp ?? "Coalition") : data!.name;

  const toPascal = (s: string): string =>
    s
      .split(/[^a-zA-Z0-9]+/)
      .map((p) => (p ? p[0].toUpperCase() + p.slice(1) : ""))
      .join("");

  let IconComponent: LucideIcon | null = null;
  if (logo && typeof logo === "string") {
    const iconsMap = LucideIcons as unknown as Record<string, LucideIcon>;
    const direct = iconsMap[logo];
    if (direct) {
      IconComponent = direct;
    } else {
      const pascal = toPascal(logo);
      IconComponent = iconsMap[pascal] || null;
    }
  }

  const circleStyle: React.CSSProperties = {
    backgroundColor: color ?? "#888888",
    width: size,
    height: size,
    minWidth: size,
    minHeight: size,
    borderRadius: "50%",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    color: "white",
    flexShrink: 0,
  };

  const joinWords = new Set<string>([
    "and",
    "the",
    "of",
    "for",
    "in",
    "on",
    "at",
    "to",
    "a",
    "an",
  ]);

  const initials: string = name
    ? name
        .split(/\s+/)
        .map((word) => word.replace(/[^a-zA-Z]/g, ""))
        .filter((word) => word.length > 0)
        .filter((word) => !joinWords.has(word.toLowerCase()))
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "C";

  return (
    <div
      style={circleStyle}
      aria-label={name || "Coalition logo"}
      title={name || "Coalition"}
    >
      {IconComponent ? (
        <IconComponent
          size={Math.floor(size * 0.6)}
          aria-hidden="true"
          focusable={false}
        />
      ) : (
        <span style={{ fontSize: Math.floor(size * 0.45), fontWeight: 700 }}>
          {initials}
        </span>
      )}
    </div>
  );
}
