import { createServerFn } from "@tanstack/react-start";
import { setCookie } from "@tanstack/react-start/server";
import { getAdminAuth } from "@/lib/firebase-admin";
import { z } from "zod";
import { env } from "@/env";

// Session cookies
export const createSessionCookie = createServerFn({ method: "POST" })
  .validator(z.object({ idToken: z.string() }))
  .handler(async ({ data }) => {
    try {
      const expiresIn = 60 * 60 * 24 * 5 * 1000;
      const sessionCookie = await getAdminAuth().createSessionCookie(
        data.idToken,
        { expiresIn },
      );

      setCookie("__session", sessionCookie, {
        maxAge: expiresIn / 1000,
        httpOnly: true,
        secure: env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
      });

      return { success: true };
    } catch (error) {
      console.error("Error creating session cookie:", error);
      throw new Error("Failed to create session");
    }
  });

export const deleteSessionCookie = createServerFn({ method: "POST" }).handler(
  () => {
    setCookie("__session", "", {
      maxAge: 0,
      httpOnly: true,
      secure: env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });

    return { success: true };
  },
);
