import {
  auth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  updateProfile,
} from './firebase'

export interface SignUpData {
  email: string
  password: string
  displayName?: string
}

export interface SignInData {
  email: string
  password: string
}

/**
 * Sign up a new user with email and password
 */
export async function signUp({ email, password, displayName }: SignUpData) {
  try {
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      email,
      password,
    )

    if (displayName && userCredential.user) {
      await updateProfile(userCredential.user, { displayName })
    }

    return { user: userCredential.user, error: null }
  } catch (error: any) {
    return { user: null, error: error.message || 'Failed to sign up' }
  }
}

/**
 * Sign in an existing user with email and password
 */
export async function signIn({ email, password }: SignInData) {
  try {
    const userCredential = await signInWithEmailAndPassword(
      auth,
      email,
      password,
    )
    return { user: userCredential.user, error: null }
  } catch (error: any) {
    return { user: null, error: error.message || 'Failed to sign in' }
  }
}

/**
 * Sign out the current user
 */
export async function logOut() {
  try {
    await signOut(auth)
    return { error: null }
  } catch (error: any) {
    return { error: error.message || 'Failed to sign out' }
  }
}

/**
 * Send a password reset email
 */
export async function resetPassword(email: string) {
  try {
    await sendPasswordResetEmail(auth, email)
    return { error: null }
  } catch (error: any) {
    return { error: error.message || 'Failed to send password reset email' }
  }
}

/**
 * Get the current authenticated user
 */
export function getCurrentUserEmail(): string | null {
  return auth.currentUser ? auth.currentUser.email : null
}
