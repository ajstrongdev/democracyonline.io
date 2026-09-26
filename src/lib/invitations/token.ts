import { createHash, randomBytes } from "node:crypto";

export const INVITATION_PREFIX_LENGTH = 10;

export function hashInvitationToken(token: string): string {
  return createHash("sha256").update(token.trim(), "utf8").digest("hex");
}

export function invitationTokenPrefix(token: string): string {
  return token.trim().slice(0, INVITATION_PREFIX_LENGTH);
}

export function generateInvitationToken(): string {
  return `doi_${randomBytes(24).toString("base64url")}`;
}
