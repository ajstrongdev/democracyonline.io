import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { getCurrentUserInfo } from "@/lib/server/users";

// Hack: Fetch user data client-side since loader returns null on SSR when navigating directly. I am deeply ashamed about this.
export function useUserData(
  loaderUserData: Awaited<ReturnType<typeof getCurrentUserInfo>>,
) {
  const { user } = useAuth();
  const [userData, setUserData] = useState(loaderUserData);

  useEffect(() => {
    setUserData(loaderUserData);
  }, [loaderUserData]);

  useEffect(() => {
    if (user && !userData) {
      getCurrentUserInfo().then((data) => {
        if (data) setUserData(data);
      });
    }
  }, [user, userData]);

  return userData;
}
