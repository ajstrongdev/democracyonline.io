import { Crown } from "lucide-react";
import { cn } from "@/lib/utils";

const SIZE_MAP = {
  small: { container: "size-4", icon: "size-2" },
  medium: { container: "size-6", icon: "size-3" },
  large: { container: "size-8", icon: "size-4" },
  extra_large: { container: "size-12", icon: "size-6" },
} as const;

export function Logo({
  size = "large",
}: Readonly<{ size?: keyof typeof SIZE_MAP }>) {
  const sizes = SIZE_MAP[size];

  return (
    <div
      className={cn(
        "flex aspect-square items-center justify-center rounded-lg bg-gradient-to-br from-[#44efa7] to-[#121510] text-primary-foreground",
        sizes.container,
      )}
    >
      <Crown className={cn("text-white", sizes.icon)} />
    </div>
  );
}
