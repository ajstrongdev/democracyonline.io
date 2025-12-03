"use client";

import { useEffect } from "react";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth } from "@/lib/firebase";

export function AuthSessionSync() {
  const [user] = useAuthState(auth);

  useEffect(() => {
    const syncSession = async () => {
      if (user) {
        try {
          const idToken = await user.getIdToken();
          await fetch("/api/auth/session", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ idToken }),
          });
        } catch (error) {
          console.error("Error syncing session:", error);
        }
      }
    };

    syncSession();
  }, [user]);

  return null;
}
