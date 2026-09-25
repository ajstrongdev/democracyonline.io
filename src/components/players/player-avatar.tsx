import { cn } from "@/lib/utils";
import { avatarForUsername, renderAvatar } from "@/lib/avatar";

export function PlayerAvatar({
  username,
  photoUrl,
  className,
}: {
  username: string;
  photoUrl?: string | null;
  className?: string;
}) {
  return (
    <span className={cn("relative inline-flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted font-semibold text-muted-foreground ring-1 ring-border", className)} aria-label={`${username}'s avatar`} role="img">
      <span aria-hidden="true">{username.slice(0, 2).toUpperCase()}</span>
      <img
          src={photoUrl?.startsWith("data:image/svg+xml") ? photoUrl : renderAvatar(avatarForUsername(username))}
          alt=""
          className="absolute inset-0 size-full object-cover"
          referrerPolicy="no-referrer"
          onError={(event) => { event.currentTarget.style.display = "none"; }}
      />
    </span>
  );
}
