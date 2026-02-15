import React, { createContext, useContext, useEffect, useState } from "react";
import { auth, onAuthStateChanged } from "./firebase";
import { createSessionCookie, deleteSessionCookie } from "./server/users";
import type { User } from "./firebase";

interface AuthContextType {
  user: User | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (authUser) => {
      console.log("[AuthProvider] onAuthStateChanged:", authUser?.email);
      setUser(authUser);
      setLoading(false);

      if (authUser) {
        try {
          const idToken = await authUser.getIdToken();
          console.log("[AuthProvider] Creating session cookie...");
          await createSessionCookie({ data: { idToken } });
          console.log("[AuthProvider] Session cookie created successfully");
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
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading }}>
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
