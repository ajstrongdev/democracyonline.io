import { camel, mapKeys } from "radash";
import { z } from "zod";
import type { Party, User } from "./types";
import { PartySchema, UserSchema } from "./types";

export function transformUserDbRow(row: User) {
  return UserSchema.parse({
    id: Number(row.id),
    email: row.email ?? undefined,
    username: row.username,
    bio: row.bio,
    political_leaning: row.political_leaning,
    role: row.role ?? null,
    party_id:
      row.party_id === null || row.party_id === undefined
        ? null
        : Number(row.party_id),
    created_at: row.created_at,
  });
}

export function transformPartyDbRow(row: Party) {
  return PartySchema.parse({
    id: Number(row.id),
    name: row.name,
    color: row.color ?? null,
    bio: row.bio ?? null,
    leaning: row.leaning,
    manifesto_url: row.manifesto_url ?? null,
    leader_id:
      row.leader_id === null || row.leader_id === undefined
        ? null
        : Number(row.leader_id),
    created_at: row.created_at,
    logo: row.logo ?? null,
    discord: row.discord ?? null,
  });
}

export const camelCaseSchemaDef = <T extends z.ZodType>(schema: T) =>
  z
    .record(z.string(), z.unknown())
    .transform((x): unknown => mapKeys(x, camel))
    .pipe(schema);
