import { useState } from "react";
import { useRouterState } from "@tanstack/react-router";
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

export function MobileNavigation() {
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="sm" className="h-11 gap-2 px-2 sm:h-9 sm:px-3" aria-label="Open navigation" aria-expanded={open}>
          <Menu className="size-5" />
          <span className="hidden md:inline">Menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[min(21rem,calc(100vw-2rem))] gap-0 overflow-hidden p-0 motion-reduce:animate-none">
        <SheetHeader className="border-b px-5 py-5 pr-14 text-left">
          <SheetTitle className="font-serif text-xl">Oscana</SheetTitle>
          <SheetDescription>Navigate your political world</SheetDescription>
        </SheetHeader>
        <NavigationLinks pathname={pathname} onNavigate={() => setOpen(false)} />
        <NavigationFooter />
      </SheetContent>
    </Sheet>
  );
}
