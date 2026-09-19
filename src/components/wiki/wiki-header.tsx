import { Link } from "@tanstack/react-router";
import {
  BookOpen,
  Building2,
  CalendarDays,
  Flag,
  Landmark,
  ScrollText,
  Users,
} from "lucide-react";
import type { ReactNode } from "react";
import { ModeToggle } from "@/components/theme-toggle";
import { UserMenu } from "@/components/auth/user-menu";

const links = [
  { to: "/dashboard/players", label: "Players", icon: Users },
  { to: "/dashboard/bills", label: "Bills", icon: ScrollText },
  { to: "/dashboard/elections", label: "Elections", icon: Landmark },
  { to: "/dashboard/parties", label: "Parties", icon: Flag },
  { to: "/dashboard/government", label: "Government", icon: Building2 },
  { to: "/calendar", label: "Calendar", icon: CalendarDays },
] as const;

export function WikiNavigation() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85">
      <div className="mx-auto flex max-w-7xl items-center border-x">
        <Link
          to="/dashboard"
          className="inline-flex shrink-0 items-center gap-2 border-r px-3 py-3 font-serif text-sm font-bold tracking-wide hover:text-primary sm:px-5"
        >
          <BookOpen className="h-4 w-4 text-primary" />
          <span className="hidden sm:inline">Democracy Online</span>
        </Link>
        <nav className="flex min-w-0 flex-1 overflow-x-auto px-1 sm:px-2">
          {links.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              activeOptions={{ exact: false }}
              activeProps={{ className: "border-primary text-foreground" }}
              className="inline-flex shrink-0 items-center gap-1.5 border-b-2 border-transparent px-2.5 py-3 text-xs font-semibold text-muted-foreground hover:text-foreground sm:px-3"
            >
              <Icon className="h-3.5 w-3.5" /> {label}
            </Link>
          ))}
        </nav>
        <div className="flex shrink-0 items-center border-l px-1 sm:px-2">
          <ModeToggle />
          <UserMenu />
        </div>
      </div>
    </header>
  );
}

export function WikiHeader({
  eyebrow,
  title,
  description,
  status,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  status?: ReactNode;
}) {
  return (
    <header className="wiki-masthead">
      <div className="px-4 py-7 sm:px-8 sm:py-9">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            {eyebrow && <p className="wiki-kicker mb-2">{eyebrow}</p>}
            <h1 className="max-w-5xl font-serif text-3xl font-bold leading-[1.08] tracking-tight sm:text-5xl">
              {title}
            </h1>
          </div>
          {status}
        </div>
        <p className="mt-4 max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base">
          {description}
        </p>
      </div>
    </header>
  );
}

export function PartyMark({
  name,
  color,
}: {
  name: string | null;
  color: string | null;
}) {
  return (
    <span className="inline-flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
      <span
        className="h-2.5 w-2.5 shrink-0 rounded-full border"
        style={{ backgroundColor: color ?? "#64748b" }}
      />
      <span className="truncate">{name ?? "Independent"}</span>
    </span>
  );
}

export function ResultBar({ value }: { value: number }) {
  return (
    <div
      className="h-1.5 w-full overflow-hidden bg-muted"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(Math.max(0, Math.min(100, value)))}
    >
      <div
        className="h-full rounded-full bg-primary"
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}
