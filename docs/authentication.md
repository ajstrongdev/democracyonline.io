# Authentication

This document explains how authentication works in democracyonline.io.

## Overview

Authentication is handled by **Firebase Authentication** (email/password). Firebase
is the source of truth for _identity_ — who you are. Our **Postgres** database is the
source of truth for _application data_ — your `account` and the `politicians` you play
in each nation.

The two are linked by **email**: a Firebase user maps to exactly one `accounts` row
via a case-insensitive email match.

> Identity model: one **account** per person (global), and one **politician** per
> nation that the account plays in. Authentication only ever resolves the account;
> per-nation politician resolution happens at the application layer.

## Pieces

| File                              | Responsibility                                                                                                              |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/firebase.ts`             | Firebase **client** SDK init. Exports `auth` and the email/password helpers used by the browser.                            |
| `src/lib/firebase-admin.ts`       | Firebase **Admin** SDK init (`getAdminApp`, `getAdminAuth`). Used on the server to verify tokens and mint session cookies.  |
| `src/lib/auth-context.tsx`        | React `AuthProvider` + `useAuth()` hook. Tracks the current Firebase user client-side and keeps the session cookie in sync. |
| `src/lib/middleware/auth.ts`      | `authMiddleware` (resolves the user) and `requireAuthMiddleware` (gate that throws if unauthenticated).                     |
| `src/lib/middleware/activity.ts`  | `politicianActivityMiddleware` — per-nation activity tracking (see below).                                                  |
| `src/lib/server/accounts.ts`      | Server functions `createSessionCookie` / `deleteSessionCookie`.                                                             |
| `src/lib/server/account-email.ts` | `normalizeEmail` + `accountEmailEquals` for matching a Firebase email to an `accounts` row.                                 |
| `src/router.tsx`                  | Wires the current user into the router context as `context.auth`.                                                           |

## How a request is authenticated

There are two ways a request proves who the user is, and `authMiddleware` tries them
in order:

1. **Session cookie (`__session`)** — used for SSR / direct navigation. The cookie is
   an HTTP-only Firebase session cookie. `authMiddleware.server` verifies it with
   `verifySessionCookie`.
2. **`Authorization: Bearer <idToken>` header** — used for client-initiated server
   function calls. `authMiddleware.client` attaches the current user's Firebase ID
   token to the outgoing request, and `authMiddleware.server` verifies it with
   `verifyIdToken`.

If neither resolves, the middleware sets `context.user = null` (it does **not**
throw). The resolved context shape is:

```ts
interface AuthContext {
  user: { uid: string; email?: string } | null;
}
```

## Sign-in / sign-out flow

1. The browser signs in with Firebase (`signInWithEmailAndPassword`).
2. `AuthProvider` listens via `onAuthStateChanged`. On sign-in it grabs the user's ID
   token and calls `createSessionCookie`, which mints the `__session` cookie
   (5-day expiry, HTTP-only, `sameSite: lax`, `secure` in production).
3. On sign-out (`authUser === null`) it calls `deleteSessionCookie`, which clears the
   cookie.

This means SSR requests are authenticated by the cookie, while client-side server
function calls are authenticated by the bearer token — both end up resolving the same
Firebase user.

## Protecting server functions

Compose middleware onto a server function:

```ts
import { createServerFn } from "@tanstack/react-start";
import { requireAuthMiddleware } from "@/lib/middleware";

export const doThing = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware]) // throws "Authentication required" if no user
  .handler(async ({ context }) => {
    // context.user is guaranteed non-null here
  });
```

- Use `authMiddleware` when authentication is **optional** (you want `context.user`
  but `null` is acceptable).
- Use `requireAuthMiddleware` when authentication is **required** (it throws on
  `null`).

All middleware is re-exported from `src/lib/middleware/index.ts`.

## Router context

`src/router.tsx` injects an `auth` object into the router context so routes can read
auth state synchronously:

```ts
context: {
  auth: {
    user,                 // Firebase User | null
    loading,              // true on the client until the first onAuthStateChanged fires
  },
}
```

On the client, a `onAuthStateChanged` listener calls `router.update()` whenever auth
state changes, keeping route context current. On the server `loading` starts `false`.

## Activity tracking

Activity is tracked **per nation**, not per account, because a player can go idle in
one game while staying active in others. This lives in its own middleware,
`politicianActivityMiddleware`, separate from the core auth middleware.

How it works:

1. It composes `authMiddleware`, so it only runs for authenticated users.
2. It reads the active nation from the `x-nation-id` request header. With no nation in
   context there is no specific politician to mark active, so it no-ops.
3. It resolves the `accounts` row from the user's email (`accountEmailEquals`).
4. It stamps `lastActiveAt = now()` on the **non-retired** politician matching
   `(accountId, nationId)`.
5. Writes are throttled to once per hour per nation via a `politician_activity_updated_<nationId>`
   cookie, and failures are swallowed so they never break the underlying request.

## Account vs Firebase user data

Fetching the signed-in user's account/politician data through a **route loader** does
not work reliably — the loader returns `null` on SSR when navigating directly, which
breaks user-specific rendering (e.g. "show this only when the user is signed in"). To
work around this, `src/lib/hooks/use-user-data.ts` fetches the data client-side as a
fallback after hydration.

This is a stopgap for that bug, not the long-term approach. The hook still carries v2
assumptions (a single game server / nation) and needs to be rescoped to the current
politician for the current nation.

## Environment variables

Client (Vite, public) — used by `firebase.ts`:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_MEASUREMENT_ID` (optional)

Server (secret) — used by `firebase-admin.ts`:

- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`

All are validated at startup in `src/env.ts`.
