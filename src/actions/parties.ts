"use server";

import { query } from "@/lib/db";

interface PartyMember {
  id: number;
  username: string;
  party_id: number;
}

export type Party = {
  id: number;
  leader_id: number | null;
  name: string;
  color: string;
  bio: string;
  manifesto_url: string;
};

export async function getPartyMembers(partyId: number): Promise<PartyMember[]> {
  const result = await query(
    "SELECT id, username, bio, political_leaning, role, party_id, created_at FROM users WHERE party_id = $1 AND username NOT LIKE 'Banned User%'",
    [partyId]
  );
  return result.rows as PartyMember[];
}

export async function getParties(): Promise<Party[]> {
  const res = await query("SELECT * FROM parties");
  return res.rows as Party[];
}
