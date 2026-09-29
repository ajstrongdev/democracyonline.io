import { useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { NavigationFooter, NavigationLinks } from "@/components/wiki/navigation-content";

export function MobileNavigation({ bottomBar = false }: { bottomBar?: boolean }) {
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant={bottomBar ? "outline" : "ghost"}
          size="sm"
          className={bottomBar
            ? "fixed inset-x-0 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 mx-auto size-14 rounded-2xl border bg-card shadow-lg lg:hidden"
            : "h-11 gap-2 px-2 sm:h-9 sm:px-3"}
          aria-label="Open navigation"
          aria-expanded={open}
          title="Open navigation"
        >
          <Menu className="size-5" />
          {!bottomBar && <span className="hidden md:inline">Menu</span>}
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[min(21rem,calc(100vw-2rem))] gap-0 overflow-hidden p-0 motion-reduce:animate-none">
        <SheetHeader className="border-b p-0 text-left">
          <Link to="/dashboard" onClick={() => setOpen(false)} className="block px-5 py-5 pr-14 transition-colors hover:bg-muted/40 focus-visible:outline-2 focus-visible:outline-ring">
            <SheetTitle className="font-serif text-xl">Oscana</SheetTitle>
            <SheetDescription className="mt-1">Navigate your political world</SheetDescription>
          </Link>
        </SheetHeader>
        <NavigationLinks pathname={pathname} onNavigate={() => setOpen(false)} />
        <NavigationFooter />
      </SheetContent>
    </Sheet>
  );
}
