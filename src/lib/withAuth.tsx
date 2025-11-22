import React, { useEffect } from "react";
import { auth } from "./firebase";
import { useAuthState } from "react-firebase-hooks/auth";
import { useRouter } from "next/navigation";
import GenericSkeleton from "@/components/genericskeleton";

export default function withAuth<T extends object>(
  WrappedComponent: React.ComponentType<T>
) {
  function ProtectedRoute(props: T) {
    const [user, loading] = useAuthState(auth);
    const router = useRouter();

    useEffect(() => {
      if (!loading && !user) {
        router.push("/sign-in");
      }
    }, [user, loading, router]);

    useEffect(() => {
      const getCookie = (name: string) => {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop()?.split(";").shift();
        return null;
      };

      const setCookie = (name: string, value: string, minutes: number) => {
        const expires = new Date(
          Date.now() + minutes * 60 * 1000
        ).toUTCString();
        document.cookie = `${name}=${value}; expires=${expires}; path=/; SameSite=Strict`;
      };

      const resetLastActivity = async () => {
        if (!user?.email) return;

        const cookieName = `activity_reset_${user.email.replace(
          /[^a-zA-Z0-9]/g,
          "_"
        )}`;
        const lastReset = getCookie(cookieName);
        const now = Date.now();

        // Only reset if we haven't done it recently, or if it's been more than 1 hour
        if (lastReset && now - parseInt(lastReset) < 60 * 60 * 1000) {
          return;
        }

        try {
          await fetch("/api/reset-user-activity", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ email: user.email }),
          });

          // Store the timestamp of this reset (expires in 6 hours)
          setCookie(cookieName, now.toString(), 360);
        } catch (error) {
          console.error("Error resetting last activity:", error);
        }
      };
      if (user) {
        resetLastActivity();
      }
    }, [user]);

    if (loading) {
      return <GenericSkeleton />;
    }

    if (!user) {
      return null;
    }

    return <WrappedComponent {...props} />;
  }

  return ProtectedRoute;
}
