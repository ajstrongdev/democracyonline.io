import * as LucideIcons from "lucide-react";
import { Landmark } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function SocialAccountAvatar({
  account,
  name,
  color,
  logo,
  className,
}: {
  account: "party" | "potro";
  name?: string | null;
  color?: string | null;
  logo?: string | null;
  className?: string;
}) {
  const iconName = logo?.replace(
    /(^|[^a-zA-Z0-9]+)([a-zA-Z0-9])/g,
    (_, _separator: string, letter: string) => letter.toUpperCase(),
  );
  const PartyIcon = iconName
    ? (LucideIcons as unknown as Record<string, LucideIcon>)[iconName]
    : null;
  const initials =
    name
      ?.split(/\s+/)
      .filter((word) => !/^(the|and|of|for)$/i.test(word))
      .map((word) => word[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "P";

  return (
    <span
      role="img"
      aria-label={
        account === "potro"
          ? "POTRO official emblem"
          : `${name ?? "Party"} logo`
      }
      className={cn(
        "inline-flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-full border-[3px] border-background bg-primary text-lg font-bold text-primary-foreground shadow-sm ring-1 ring-border sm:size-16",
        className,
      )}
      style={
        account === "party"
          ? { backgroundColor: color ?? "#64748b" }
          : undefined
      }
    >
      {account === "potro" ? (
        <Landmark className="size-1/2" aria-hidden="true" />
      ) : PartyIcon ? (
        <PartyIcon className="size-1/2" aria-hidden="true" />
      ) : (
        <span aria-hidden="true">{initials}</span>
      )}
    </span>
  );
}
