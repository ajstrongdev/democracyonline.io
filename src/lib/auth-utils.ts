import {
  auth,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from "./firebase";
import { deleteSessionCookie } from "@/lib/server/auth/session";
import { disableBrowserPush } from "@/lib/notifications/browser-push";

export interface SignUpData {
  email: string;
  password: string;
  displayName?: string;
}

export interface SignInData {
  email: string;
  password: string;
}

export async function signUp({ email, password, displayName }: SignUpData) {
  try {
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      email,
      password,
    );

    if (displayName && userCredential.user) {
      await updateProfile(userCredential.user, { displayName });
    }

    return { user: userCredential.user, error: null };
  } catch (error: any) {
    return { user: null, error: error.message || "Failed to sign up" };
  }
}

export async function signIn({ email, password }: SignInData) {
  try {
    const userCredential = await signInWithEmailAndPassword(
      auth,
      email,
      password,
    );
    return { user: userCredential.user, error: null };
  } catch (error: any) {
    return { user: null, error: error.message || "Failed to sign in" };
  }
}

export async function logOut() {
  try {
    // A shared browser must stop receiving the previous player's push messages.
    await disableBrowserPush(true).catch((error: unknown) => {
      console.error("Could not remove push subscription during sign-out", error);
    });
    await signOut(auth);
    return { error: null };
  } catch (error: any) {
    return { error: error.message || "Failed to sign out" };
  }
}

export async function signOutAndRedirect() {
  const result = await logOut();
  if (result.error) return result;
  try {
    await deleteSessionCookie();
  } finally {
    window.location.assign("/login");
  }
  return { error: null };
}

export async function resetPassword(email: string) {
  try {
    await sendPasswordResetEmail(auth, email);
    return { error: null };
  } catch (error: any) {
    return { error: error.message || "Failed to send password reset email" };
  }
}
