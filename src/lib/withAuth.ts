// Firebase
import { auth } from "@/lib/firebase";
import { useAuthState } from "react-firebase-hooks/auth";

// Other
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function withAuth<T extends object>(
  WrappedComponent: React.ComponentType<T>
) {
  function ProtectedRoute(props: T) {
    const [isLoading, setIsLoading] = useState(true);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [user] = useAuthState(auth);
    const router = useRouter();

    useEffect(() => {
      if (user) {
        setIsAuthenticated(true);
        setIsLoading(false);
      } else {
        setIsAuthenticated(false);
        setIsLoading(false);
        router.push("/");
      }
    }, [user, router]);

    if (isLoading) {
      return <div>Loading...</div>;
    }

    if (!isAuthenticated) {
      return null;
    }

    return <WrappedComponent {...props} />;
  }

  return ProtectedRoute;
}
