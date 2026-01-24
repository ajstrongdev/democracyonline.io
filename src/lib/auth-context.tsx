import React, { createContext, useContext, useEffect, useState } from "react";
import { auth, onAuthStateChanged } from "./firebase";
import type { User } from "./firebase";
import { createSessionCookie, deleteSessionCookie } from "./server/users";

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
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      setLoading(false);

      if (user) {
        try {
          const idToken = await user.getIdToken();
          await createSessionCookie({ data: { idToken } });
        } catch (error) {
          console.error("Failed to create session cookie:", error);
        }
      } else {
        try {
          await deleteSessionCookie();
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
