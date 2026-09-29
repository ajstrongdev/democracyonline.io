export type MastheadArtwork =
  | "bills"
  | "cabinet"
  | "house"
  | "senate"
  | "president"
  | "elections"
  | "parties"
  | "nation"
  | "social"
  | "players"
  | "guide"
  | "revisions";

export type FeaturedOffice = "President" | "Senator" | "Representative";

export function featuredOffice(role: string | null | undefined): FeaturedOffice | undefined {
  if (role === "President" || role === "Senator" || role === "Representative") return role;
  return undefined;
}

export function officeArtwork(role: string | null | undefined): MastheadArtwork {
  if (role === "President") return "president";
  if (role === "Senator") return "senate";
  if (role === "Representative") return "house";
  return "nation";
}

export function pageArtwork(pathname: string): MastheadArtwork {
  if (pathname.startsWith("/dashboard/bills")) return "bills";
  if (pathname.startsWith("/dashboard/elections")) return "elections";
  if (pathname.startsWith("/dashboard/parties")) return "parties";
  if (pathname.startsWith("/dashboard/players")) return "players";
  if (pathname.startsWith("/dashboard/social")) return "social";
  if (pathname.startsWith("/dashboard/government")) return "cabinet";
  if (pathname.startsWith("/dashboard/guide")) return "guide";
  if (pathname.startsWith("/dashboard/revisions") || pathname === "/changelog") return "revisions";
  return "nation";
}
