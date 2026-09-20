import { Link } from "@tanstack/react-router";
import { LogIn, LogOut, Settings, User } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { logOut } from "@/lib/auth-utils";
import { Button } from "@/components/ui/button";

export function UserMenu() {
  const { user, loading } = useAuth();

  const handleLogout = async () => {
    await logOut();
  };

  if (loading) {
    return <div className="h-9 w-24 bg-muted animate-pulse rounded-md" />;
  }

  if (!user) {
    return (
      <div className="flex items-center gap-1 lg:gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/login" aria-label="Sign in">
            <LogIn className="size-4" />
            <span className="hidden lg:inline">Sign In</span>
          </Link>
        </Button>
        <Button className="hidden lg:inline-flex" asChild>
          <Link to="/register">Sign Up</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex min-w-0 items-center gap-1 sm:gap-2">
      <div className="hidden min-w-0 items-center gap-2 md:flex">
        <User className="size-4" />
        <span className="max-w-32 truncate text-sm font-medium">
          {user.displayName || user.email}
        </span>
      </div>
      <Button variant="ghost" size="icon" asChild>
        <Link to="/settings" aria-label="Account settings">
          <Settings className="size-4" />
        </Link>
      </Button>
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
