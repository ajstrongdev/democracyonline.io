import type { UserRecord } from "firebase-admin/auth";

/** Never serialize Firebase's password hash, salt, tokens, or provider internals. */
export function publicFirebaseUser(user: UserRecord) {
  return {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    photoURL: user.photoURL,
    disabled: user.disabled,
    emailVerified: user.emailVerified,
    creationTime: user.metadata.creationTime,
    lastSignInTime: user.metadata.lastSignInTime,
  };
}
