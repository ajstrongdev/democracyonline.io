"use client";

import type { LucideIcon } from "lucide-react";
import type React from "react";
import { Spinner } from "@/components/ui/spinner";
import { trpc } from "@/lib/trpc";

export default function PartyLogo({
  party_id,
  size = 40,
}: {
  party_id: number;
  size?: number;
}) {
  // Get party info including logo
  const { data: partyData, isLoading } = trpc.party.getById.useQuery(
    { partyId: party_id },
    { enabled: !!party_id },
  );

  if (isLoading) {
    return <Spinner />;
  }

  if (!partyData) {
    return <div>No party data found</div>;
  }

  const { color = "#888888", logo, name } = partyData;

  const toPascal = (s: string) =>
    s
      .split(/[^a-zA-Z0-9]+/)
      .map((p) => (p ? p[0].toUpperCase() + p.slice(1) : ""))
      .join("");

  let IconComponent: React.ComponentType<LucideIcon> | null = null;
  if (logo && typeof logo === "string") {
    const direct = LucideIcon[logo];
    if (direct) {
      IconComponent = direct;
    } else {
      const pascal = toPascal(logo);
      IconComponent = LucideIcon[pascal] || null;
    }
  }

  const circleStyle: React.CSSProperties = {
    backgroundColor: color || "#888888",
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

  // Fallback: use initials from party name
  const joinWords = new Set([
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

  const initials = name
    ? name
        .split(/\s+/) // Split by whitespace
        .map((word) => word.replace(/[^a-zA-Z]/g, "")) // Remove special characters
        .filter((word) => word.length > 0) // Remove empty strings
        .filter((word) => !joinWords.has(word.toLowerCase())) // Exclude joining words
        .join("") // Join all words together
        .slice(0, 2) // Take first two letters
        .toUpperCase()
    : "P";

  return (
    <div
      role="img"
      style={circleStyle}
      aria-label={name || "Party logo"}
      title={name || "Party"}
    >
      {IconComponent ? (
        // lucide icons use currentColor for stroke/fill, so they inherit the
        // white color from the container. Mark as decorative with aria-hidden.
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
