import { Crown } from "lucide-react";

export function Logo({ size = 8 }: { size?: number }) {
  return (
    <div
      className={`flex aspect-square size-${size} items-center justify-center rounded-lg bg-gradient-to-br from-red-500 to-blue-500 text-primary-foreground`}
    >
      <Crown className={`size-${size === 8 ? 4 : size / 2} text-white`} />
    </div>
  );
}
