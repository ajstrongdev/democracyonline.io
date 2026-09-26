import { useEffect, useState } from "react";
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
  const [updatedPhoto, setUpdatedPhoto] = useState<string | null>(null);
  useEffect(() => {
    const onUpdate = (event: Event) => {
      const detail = (event as CustomEvent<{ username: string; photoUrl: string }>).detail;
      if (detail.username === username) setUpdatedPhoto(detail.photoUrl);
    };
    window.addEventListener("player-avatar-updated", onUpdate);
    return () => window.removeEventListener("player-avatar-updated", onUpdate);
  }, [username]);
  const avatarUrl = updatedPhoto ?? photoUrl;
  return (
    <span className={cn("relative inline-flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted font-semibold text-muted-foreground ring-1 ring-border", className)} aria-label={`${username}'s avatar`} role="img">
      <span aria-hidden="true">{username.slice(0, 2).toUpperCase()}</span>
      <img
          src={avatarUrl?.startsWith("data:image/svg+xml") ? avatarUrl : renderAvatar(avatarForUsername(username))}
          alt=""
          className="absolute inset-0 size-full object-cover"
          referrerPolicy="no-referrer"
          onError={(event) => { event.currentTarget.style.display = "none"; }}
      />
    </span>
  );
}
