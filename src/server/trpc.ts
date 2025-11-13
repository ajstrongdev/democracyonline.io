import 'server-only';

import { initTRPC, TRPCError } from '@trpc/server';
import superjson from 'superjson';
import { query } from '@/lib/db';

export type AuthUser = { uid: string; email: string | null } | null;

export type TRPCContext = {
  authUser: AuthUser;
  dbUserId: number | null;
  dbUser: any | null;
  query: typeof query;
};

export const createTRPCContext = async (opts: {
  req: Request;
  authUser: AuthUser;
}): Promise<TRPCContext> => {
  let dbUser: any | null = null;
  let dbUserId: number | null = null;

  if (opts.authUser?.email) {
    try {
      const res = await query(
        'SELECT * FROM users WHERE LOWER(email) = LOWER($1)',
        [opts.authUser.email],
      );
      if (res.rows.length > 0) {
        dbUser = res.rows[0];
        dbUserId = Number(dbUser.id);
      }
    } catch (e) {
      // Ignore; unauthenticated context is fine for public procedures
    }
  }

  return {
    authUser: opts.authUser,
    dbUserId,
    dbUser,
    query,
  };
};

const t = initTRPC.context<TRPCContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

export const authedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.authUser?.uid || !ctx.dbUserId) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not signed in' });
  }
  return next();
});

export const adminProcedure = authedProcedure.use(async ({ ctx, next }) => {
  const raw = process.env.ADMIN_EMAILS ?? "";
  const adminEmails = raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  if (adminEmails.length === 0) {
    console.error("ADMIN_EMAILS is empty or not set. Admin routes disabled.");
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin only" });
  }

  const email = ctx.authUser?.email?.toLowerCase();
  if (!email || !adminEmails.includes(email)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin only" });
  }

  return next();
});
