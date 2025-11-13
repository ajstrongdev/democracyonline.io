import { trpc } from "@/lib/trpc";

/**
 * Check if a Firebase Auth user account is disabled
 * @param uid - The Firebase user ID
 * @returns Promise containing the user status
 */
export async function checkUserDisabled(uid: string): Promise<{
  disabled: boolean;
  email?: string;
  emailVerified?: boolean;
}> {
  return trpc.user.checkUserDisabled.fetch({ uid });
}
