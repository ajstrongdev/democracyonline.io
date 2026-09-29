import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { auth, onAuthStateChanged } from "./firebase";
import type { User } from "./firebase";
import { createSessionCookie, deleteSessionCookie } from "@/lib/server/auth/session";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  sessionReady: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  sessionReady: false,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const previousUid = useRef(auth.currentUser?.uid ?? null);
  const [user, setUser] = useState<User | null>(() => auth.currentUser ?? null);
  const [loading, setLoading] = useState(() => !auth.currentUser);
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (authUser) => {
      if (previousUid.current && previousUid.current !== authUser?.uid) {
        queryClient.clear();
      }
      previousUid.current = authUser?.uid ?? null;
      console.log("[AuthProvider] onAuthStateChanged:", authUser?.email);
      setUser(authUser);
      setLoading(false);
      setSessionReady(false);

      if (authUser) {
        try {
          const idToken = await authUser.getIdToken();
          console.log("[AuthProvider] Creating session cookie...");
          await createSessionCookie({ data: { idToken } });
          console.log("[AuthProvider] Session cookie created successfully");
          if (auth.currentUser?.uid === authUser.uid) setSessionReady(true);
        } catch (error) {
          console.error("Failed to create session cookie:", error);
        }
      } else {
        try {
          console.log("[AuthProvider] Deleting session cookie...");
          await deleteSessionCookie();
          console.log("[AuthProvider] Session cookie deleted");
        } catch (error) {
          console.error("Failed to delete session cookie:", error);
        }
      }
    });

    return unsubscribe;
  }, [queryClient]);

  return (
    <AuthContext.Provider value={{ user, loading, sessionReady }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
