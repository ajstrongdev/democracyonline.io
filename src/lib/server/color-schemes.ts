import { createServerFn } from "@tanstack/react-start";
import { getCookie, setCookie } from "@tanstack/react-start/server";
import { and, desc, eq, lt, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { colorSchemes, users } from "@/db/schema";
import {
  colorSchemeInput,
  selectedColorSchemeCookie,
} from "@/lib/color-schemes";
import { getCurrentDatabaseUser } from "@/lib/server/current-user";
import { themeConfig } from "@/lib/server/theme";
import { authMiddleware, requireAuthMiddleware } from "@/middleware";

const maxSchemesPerPlayer = 8;
const databaseId = z.number().int().min(1).max(2_147_483_647);
const idSchema = z.object({ id: databaseId });

function writeSelectedCookie(id: number | null) {
  setCookie(selectedColorSchemeCookie, id === null ? "" : String(id), {
    maxAge: id === null ? 0 : themeConfig.cookieMaxAge,
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
}

export const getSelectedColorScheme = createServerFn()
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const raw = getCookie(selectedColorSchemeCookie);
    if (!raw || !/^[1-9]\d{0,9}$/.test(raw)) return null;
    const id = Number(raw);
    if (id > 2_147_483_647) return null;
    const player = context.user
      ? await getCurrentDatabaseUser(context.user)
      : null;
    const [row] = await db
      .select({ scheme: colorSchemes })
      .from(colorSchemes)
      .innerJoin(users, eq(users.id, colorSchemes.ownerId))
      .where(
        and(
          eq(colorSchemes.id, id),
          player
            ? or(
                and(
                  eq(colorSchemes.isPublished, true),
                  eq(users.isActive, true),
                ),
                eq(colorSchemes.ownerId, player.id),
              )
            : and(eq(colorSchemes.isPublished, true), eq(users.isActive, true)),
        ),
      )
      .limit(1);
    return row?.scheme ?? null;
  });

export const getColorSchemeCatalog = createServerFn()
  .middleware([authMiddleware])
  .inputValidator(
    z.object({ beforeId: databaseId.optional() }),
  )
  .handler(async ({ context, data }) => {
    const player = context.user
      ? await getCurrentDatabaseUser(context.user)
      : null;
    const [publicRows, ownSchemes] = await Promise.all([
      db
        .select({
          id: colorSchemes.id,
          ownerId: colorSchemes.ownerId,
          ownerName: users.username,
          name: colorSchemes.name,
          mode: colorSchemes.mode,
          background: colorSchemes.background,
          foreground: colorSchemes.foreground,
          primary: colorSchemes.primary,
          accent: colorSchemes.accent,
          isPublished: colorSchemes.isPublished,
        })
        .from(colorSchemes)
        .innerJoin(users, eq(users.id, colorSchemes.ownerId))
        .where(
          and(
            eq(colorSchemes.isPublished, true),
            eq(users.isActive, true),
            data.beforeId ? lt(colorSchemes.id, data.beforeId) : undefined,
          ),
        )
        .orderBy(desc(colorSchemes.id))
        .limit(26),
      player
        ? db
            .select()
            .from(colorSchemes)
            .where(eq(colorSchemes.ownerId, player.id))
            .orderBy(desc(colorSchemes.id))
            .limit(maxSchemesPerPlayer)
        : Promise.resolve([]),
    ]);
    return {
      publicSchemes: publicRows.slice(0, 25),
      hasMore: publicRows.length > 25,
      ownSchemes,
      playerId: player?.id ?? null,
    };
  });

export const saveColorScheme = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .inputValidator(
    z.object({
      id: databaseId.optional(),
      scheme: colorSchemeInput,
    }),
  )
  .handler(async ({ context, data }) => {
    if (!context.user) throw new Error("Sign in to save a theme");
    const player = await getCurrentDatabaseUser(context.user);
    if (!player)
      throw new Error("Create a player profile before saving themes");
    return db.transaction(async (tx) => {
      // Lock the owner row so simultaneous saves cannot bypass the per-player cap.
      await tx
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, player.id))
        .for("update");
      if (data.id) {
        const [updated] = await tx
          .update(colorSchemes)
          .set({ ...data.scheme, updatedAt: new Date() })
          .where(
            and(
              eq(colorSchemes.id, data.id),
              eq(colorSchemes.ownerId, player.id),
            ),
          )
          .returning();
        if (!updated) throw new Error("Theme not found or not yours");
        return updated;
      }
      const [count] = await tx
        .select({ value: sql<number>`count(*)::int` })
        .from(colorSchemes)
        .where(eq(colorSchemes.ownerId, player.id));
      if (count.value >= maxSchemesPerPlayer)
        throw new Error(
          "You can save up to 8 themes. Delete one to make space.",
        );
      const [created] = await tx
        .insert(colorSchemes)
        .values({ ...data.scheme, ownerId: player.id })
        .returning();
      return created;
    });
  });

export const deleteColorScheme = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .inputValidator(idSchema)
  .handler(async ({ context, data }) => {
    if (!context.user) throw new Error("Sign in to delete a theme");
    const player = await getCurrentDatabaseUser(context.user);
    if (!player) throw new Error("Player profile not found");
    const deleted = await db
      .delete(colorSchemes)
      .where(
        and(eq(colorSchemes.id, data.id), eq(colorSchemes.ownerId, player.id)),
      )
      .returning({ id: colorSchemes.id });
    if (!deleted.length) throw new Error("Theme not found or not yours");
    if (getCookie(selectedColorSchemeCookie) === String(data.id))
      writeSelectedCookie(null);
  });

export const selectColorScheme = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .inputValidator(idSchema)
  .handler(async ({ context, data }) => {
    if (!context.user) throw new Error("Sign in to use a shared theme");
    const player = await getCurrentDatabaseUser(context.user);
    if (!player) throw new Error("Player profile not found");
    const [row] = await db
      .select({ scheme: colorSchemes })
      .from(colorSchemes)
      .innerJoin(users, eq(users.id, colorSchemes.ownerId))
      .where(
        and(
          eq(colorSchemes.id, data.id),
          or(
            and(eq(colorSchemes.isPublished, true), eq(users.isActive, true)),
            eq(colorSchemes.ownerId, player.id),
          ),
        ),
      )
      .limit(1);
    const scheme = row?.scheme;
    if (!scheme) throw new Error("Theme is no longer shared or available");
    setCookie(themeConfig.cookieKey, scheme.mode, {
      maxAge: themeConfig.cookieMaxAge,
    });
    writeSelectedCookie(scheme.id);
    return scheme;
  });
