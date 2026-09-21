import { Check, Palette } from "lucide-react";
import { useState } from "react";
import { useTheme } from "@ajstrongdev/start-themes";
import { themes } from "@/lib/server/theme";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export function ModeToggle() {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="shrink-0 gap-2">
          <Palette className="h-4 w-4" />
          <span className="hidden sm:inline">Theme</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-52 p-1.5">
        <p className="px-2.5 py-1.5 text-xs font-medium text-muted-foreground">
          Choose a theme
        </p>
        {themes.map((t) => (
          <button
            key={t.id}
            onClick={() => {
              setTheme(t.id);
              setOpen(false);
            }}
            className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors hover:bg-accent hover:text-accent-foreground ${
              theme === t.id
                ? "bg-accent text-accent-foreground font-medium"
                : "text-popover-foreground"
            }`}
          >
            <span
              className="h-4 w-4 shrink-0 rounded-full border border-border/50"
              style={{ backgroundColor: t.swatch }}
            />
            <span className="flex-1 text-left">{t.label}</span>
            {theme === t.id && (
              <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
            )}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
