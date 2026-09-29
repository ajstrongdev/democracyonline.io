import {
  BookOpen,
  Flag,
  History,
  Home,
  Landmark,
  MessageSquareText,
  ScrollText,
  UserRound,
  UsersRound,
  Vote,
} from "lucide-react";

// Every destination belongs to the game. Keep one order and one icon family
// across the permanent desktop sidebar and the small-screen drawer.
export const navigationItems = [
  { label: "Dashboard", to: "/dashboard", icon: Home },
  { label: "Bills & voting", to: "/dashboard/bills", icon: ScrollText },
  { label: "Elections", to: "/dashboard/elections", icon: Vote },
  { label: "Parties", to: "/dashboard/parties", icon: UsersRound },
  { label: "Presidential primaries", to: "/dashboard/parties/primaries", icon: Landmark },
  { label: "Z.com", to: "/dashboard/social", icon: MessageSquareText },
  { label: "Players", to: "/dashboard/players", icon: UserRound },
  { label: "Nation", to: "/dashboard/nation", icon: Flag },
  { label: "Government history", to: "/dashboard/government", icon: History },
  { label: "Player guide", to: "/dashboard/guide", icon: BookOpen },
] as const;

export const navigationGroups = [
  { label: "Political activity", items: navigationItems.slice(0, 5) },
  { label: "People & news", items: navigationItems.slice(5, 7) },
  { label: "Nation & reference", items: navigationItems.slice(7) },
] as const;

export function isActiveDestination(pathname: string, to: string) {
  if (to === "/dashboard") return pathname === to || pathname === `${to}/`;
  return (pathname === to || pathname.startsWith(`${to}/`)) &&
    !(to === "/dashboard/parties" && pathname.startsWith("/dashboard/parties/primaries"));
}
