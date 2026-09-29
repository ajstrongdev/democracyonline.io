import { useRouterState } from "@tanstack/react-router";
import { NavigationFooter, NavigationLinks } from "@/components/wiki/navigation-content";

export function DesktopNavigation() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  if (["/login", "/register", "/banned"].includes(pathname)) return null;

  return (
    <aside className="sticky top-0 hidden h-dvh w-72 shrink-0 flex-col border-r bg-background lg:flex" aria-label="Game navigation">
      <div className="border-b px-5 py-5 pr-14 text-left">
        <h2 className="font-serif text-xl font-semibold">Oscana</h2>
        <p className="mt-1 text-sm text-muted-foreground">Navigate your political world</p>
      </div>
      <NavigationLinks pathname={pathname} />
      <NavigationFooter />
    </aside>
  );
}
