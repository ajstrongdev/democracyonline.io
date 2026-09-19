import { Link } from "@tanstack/react-router";
import { LogOut, Settings, User } from "lucide-react";
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
      <div className="hidden items-center gap-2 lg:flex">
        <Button variant="ghost" asChild>
          <Link to="/login">Sign In</Link>
        </Button>
        <Button asChild>
          <Link to="/register">Sign Up</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2">
        <User className="size-4" />
        <span className="text-sm font-medium">
          {user.displayName || user.email}
        </span>
      </div>
      <Button variant="ghost" size="icon" asChild>
        <Link to="/settings" aria-label="Account settings">
          <Settings className="size-4" />
        </Link>
      </Button>
      <Button variant="ghost" size="icon" onClick={handleLogout}>
        <LogOut className="size-4" />
      </Button>
    </div>
  );
}
