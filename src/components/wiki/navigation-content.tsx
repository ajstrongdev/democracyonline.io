import { Link } from "@tanstack/react-router";
import { ModeToggle } from "@/components/theme-toggle";
import { UserMenu } from "@/components/auth/user-menu";
import { QuickNavigation } from "@/components/wiki/quick-navigation";
import { isActiveDestination, mobileDrawerGroups, navigationGroups } from "@/components/wiki/navigation-items";

export function NavigationLinks({ pathname, onNavigate, mobile = false }: { pathname: string; onNavigate?: () => void; mobile?: boolean }) {
  return (
    <nav aria-label="Main navigation" className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-3 pb-5 pt-3">
      {(mobile ? mobileDrawerGroups : navigationGroups).map((group) => (
        <div key={group.label}>
          <p className="wiki-kicker px-3 pb-1.5 pt-1">{group.label}</p>
          <div className="space-y-0.5">
            {group.items.map(({ label, to, icon: Icon }) => {
              const active = isActiveDestination(pathname, to);
              return (
                <Link
                  key={to}
                  to={to}
                  search={to === "/dashboard/social" ? { postId: undefined, commentId: undefined } : undefined}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring ${active ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted"}`}
                >
                  <Icon className="size-4 shrink-0" />
                  {label}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

export function NavigationFooter() {
  return (
    <div className="shrink-0 border-t px-3 py-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div className="flex flex-wrap items-center justify-around gap-1 [&_[data-slot=button]]:size-11">
        <QuickNavigation keyboardShortcut={false} iconOnly />
        <ModeToggle />
        <UserMenu iconOnly />
      </div>
    </div>
  );
}
