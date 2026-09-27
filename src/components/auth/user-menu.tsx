import { Link } from "@tanstack/react-router";
import { LogIn, LogOut, Settings, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { signOutAndRedirect } from "@/lib/auth-utils";
import { Button } from "@/components/ui/button";
import { AccountSettingsDialog } from "@/components/settings/account-settings-dialog";
import { canAccessModerationQueue } from "@/lib/server/moderation";

export function UserMenu() {
  const { user, loading } = useAuth();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [accessLevel, setAccessLevel] = useState<"admin" | "moderator" | null>(null);

  useEffect(() => {
    let active = true;
    if (!user) {
      setAccessLevel(null);
      return;
    }
    void canAccessModerationQueue().then((allowed) => {
      if (active) setAccessLevel(allowed);
    }).catch(() => {
      if (active) setAccessLevel(null);
    });
    return () => { active = false; };
  }, [user]);

  const handleLogout = async () => {
    const result = await signOutAndRedirect();
    if (result.error) {
      toast.error(result.error);
      return;
    }
  };

  if (loading) {
    return <div className="h-9 w-24 bg-muted animate-pulse rounded-md" />;
  }

  if (!user) {
    return (
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/login" aria-label="Sign in">
            <LogIn className="size-4" />
            <span>Sign In</span>
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      {accessLevel === "admin" ? (
        <Button variant="ghost" size="sm" asChild className="gap-2 px-2 sm:px-3">
          <Link to="/dashboard/admin"><ShieldCheck className="size-4" /><span className="hidden sm:inline">Admin</span></Link>
        </Button>
      ) : accessLevel === "moderator" ? (
        <Button variant="ghost" size="sm" asChild className="gap-2 px-2 sm:px-3">
          <Link to="/dashboard/moderation"><ShieldCheck className="size-4" /><span className="hidden sm:inline">Moderation</span></Link>
        </Button>
      ) : null}
      <Button variant="ghost" size="icon" onClick={() => setSettingsOpen(true)} aria-label="Account settings">
          <Settings className="size-4" />
      </Button>
      <AccountSettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
      <Button
        variant="ghost"
        size="icon"
        onClick={handleLogout}
        aria-label="Sign out"
      >
        <LogOut className="size-4" />
      </Button>
    </div>
  );
}
