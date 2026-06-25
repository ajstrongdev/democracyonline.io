// File is commented out as it is not currently used, but will be necessary in the future when we need to actually fetch data client-side. Will need to figure out a way to scope this correctly to the current politician for the current nation as this was imported from v2 when there was only one game server / nation.

// import { useEffect, useState } from "react";
// import { useAuth } from "@/lib/auth-context";
// import { getCurrentUserInfo } from "@/lib/server/users";

// // Hack: Fetch user data client-side since loader returns null on SSR when navigating directly. I am deeply ashamed about this.
// export function useUserData(
//   loaderUserData: Awaited<ReturnType<typeof getCurrentUserInfo>>,
// ) {
//   const { user } = useAuth();
//   const [userData, setUserData] = useState(loaderUserData);

//   useEffect(() => {
//     setUserData(loaderUserData);
//   }, [loaderUserData]);

//   useEffect(() => {
//     if (user && !userData) {
//       getCurrentUserInfo().then((data) => {
//         if (data) setUserData(data);
//       });
//     }
//   }, [user, userData]);

//   return userData;
// }
