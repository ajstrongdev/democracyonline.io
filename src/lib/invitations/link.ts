export function createInviteLink(origin: string, token: string): string {
  const url = new URL("/register", origin);
  url.searchParams.set("invite", token);
  return url.toString();
}
