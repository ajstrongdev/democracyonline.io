import { Search } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function WikiPage({
  children,
  className,
}: {
  children: ReactNode;
  width?: "article" | "wide";
  className?: string;
}) {
  return (
    <main
      className={cn(
        "wiki-page mx-auto w-full max-w-7xl space-y-6 px-3 py-5 sm:px-6 sm:py-8",
        className,
      )}
    >
      {children}
    </main>
  );
}

export function WikiSection({
  title,
  description,
  icon: Icon,
  aside,
  children,
  className,
}: {
  title: string;
  description?: string;
  icon?: LucideIcon;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("wiki-section", className)}>
      <header className="wiki-section-header">
        <div className="min-w-0">
          <h2 className="wiki-section-title">
            {Icon && <Icon className="h-4 w-4 text-primary" />}
            {title}
          </h2>
          {description && (
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
              {description}
            </p>
          )}
        </div>
        {aside}
      </header>
      <div className="wiki-section-content">{children}</div>
    </section>
  );
}

export function WikiStatGrid({ children }: { children: ReactNode }) {
  return (
    <dl className="grid divide-y border-y bg-card sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-flow-col lg:auto-cols-fr">
      {children}
    </dl>
  );
}

export function WikiStat({
  label,
  value,
  detail,
}: {
  label: string;
  value: ReactNode;
  detail?: string;
}) {
  return (
    <div className="px-4 py-4 sm:px-5">
      <dt className="wiki-kicker">{label}</dt>
      <dd className="mt-1 font-serif text-xl font-semibold text-foreground">
        {value}
      </dd>
      {detail && <p className="mt-1 text-xs text-muted-foreground">{detail}</p>}
    </div>
  );
}

export function WikiSearch({
  value,
  onChange,
  placeholder,
  resultCount,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  resultCount: number;
}) {
  return (
    <div className="flex flex-col gap-2 border-y bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <label className="relative block w-full max-w-xl">
        <span className="sr-only">Search the archive</span>
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="h-10 rounded-sm border-0 bg-muted/50 pl-9 shadow-none focus-visible:ring-1"
        />
      </label>
      <span className="shrink-0 font-mono text-xs text-muted-foreground">
        {resultCount} {resultCount === 1 ? "record" : "records"}
      </span>
    </div>
  );
}

export function WikiEmpty({ children }: { children: ReactNode }) {
  return (
    <div className="border border-dashed px-5 py-10 text-center text-sm text-muted-foreground">
      {children}
    </div>
  );
}

export function WikiInfobox({
  title,
  accent,
  children,
}: {
  title: string;
  accent?: string | null;
  children: ReactNode;
}) {
  return (
    <aside
      className="wiki-infobox"
      style={accent ? { borderTopColor: accent } : undefined}
    >
      <h2 className="border-b bg-muted/40 px-4 py-3 text-center font-serif text-lg font-bold">
        {title}
      </h2>
      <dl>{children}</dl>
    </aside>
  );
}

export function WikiInfoboxRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[6.5rem_1fr] gap-3 border-b px-4 py-2.5 text-sm last:border-b-0">
      <dt className="font-semibold text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right">{children}</dd>
    </div>
  );
}
