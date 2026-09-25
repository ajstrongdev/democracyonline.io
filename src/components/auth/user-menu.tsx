import { Link } from "@tanstack/react-router";
import { LogIn, LogOut, Settings } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { logOut } from "@/lib/auth-utils";
import { Button } from "@/components/ui/button";
import { AccountSettingsDialog } from "@/components/settings/account-settings-dialog";

export function UserMenu() {
  const { user, loading } = useAuth();
  const [settingsOpen, setSettingsOpen] = useState(false);

  const handleLogout = async () => {
    await logOut();
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
