import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const getSessionUser = createServerFn().handler(async () => {
  const [{ getCookie }, { getAdminAuth }] = await Promise.all([
    import("@tanstack/react-start/server"),
    import("@/lib/firebase-admin"),
  ]);
  const sessionCookie = getCookie("__session");

  if (!sessionCookie) return null;

  try {
    const decoded = await getAdminAuth().verifySessionCookie(
      sessionCookie,
      true,
    );
    return { email: decoded.email ?? null };
  } catch {
    return null;
  }
});

export const createSessionCookie = createServerFn({ method: "POST" })
  .inputValidator(z.object({ idToken: z.string() }))
  .handler(async ({ data }) => {
    const [{ setCookie }, { getAdminAuth }, { env }] = await Promise.all([
      import("@tanstack/react-start/server"),
      import("@/lib/firebase-admin"),
      import("@/env"),
    ]);
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
  });

export const deleteSessionCookie = createServerFn({ method: "POST" }).handler(
  async () => {
    const [{ setCookie }, { env }] = await Promise.all([
      import("@tanstack/react-start/server"),
      import("@/env"),
    ]);

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
