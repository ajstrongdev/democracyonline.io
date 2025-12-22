# Firebase Authentication Setup

This project uses Firebase Authentication with email/password sign-in.

## Setup Instructions

1. **Create a Firebase Project**
   - Go to [Firebase Console](https://console.firebase.google.com/)
   - Create a new project or select an existing one
   - Enable Authentication > Sign-in method > Email/Password

2. **Get Firebase Configuration**
   - In your Firebase project, go to Project Settings
   - Scroll to "Your apps" section
   - Click on the web icon (</>) to add a web app
   - Copy the configuration values

3. **Configure Environment Variables**
   - Copy `.env.local.example` to `.env.local`
   - Fill in your Firebase configuration values:
     ```bash
     cp .env.local.example .env.local
     ```

4. **Environment Variables**
   ```
   VITE_FIREBASE_API_KEY=your-api-key
   VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=your-project-id
   VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
   VITE_FIREBASE_APP_ID=your-app-id
   ```

## Features

- ✅ Email/Password Authentication
- ✅ User Sign Up with optional display name
- ✅ User Sign In
- ✅ User Sign Out
- ✅ Password Reset
- ✅ Protected Routes
- ✅ Auth Context with React hooks
- ✅ User Menu Component

## Usage

### Authentication Components

```tsx
import {
  LoginForm,
  SignupForm,
  UserMenu,
  ProtectedRoute,
} from '@/components/auth'
```

### Auth Hooks

```tsx
import { useAuth } from '@/lib/auth-context'

function MyComponent() {
  const { user, loading } = useAuth()

  if (loading) return <div>Loading...</div>
  if (!user) return <div>Please sign in</div>

  return <div>Hello, {user.email}</div>
}
```

### Auth Utilities

```tsx
import { signIn, signUp, logOut, resetPassword } from '@/lib/auth-utils'

// Sign in
const { user, error } = await signIn({ email, password })

// Sign up
const { user, error } = await signUp({ email, password, displayName })

// Sign out
await logOut()

// Reset password
await resetPassword(email)
```

### Protected Routes

```tsx
import { ProtectedRoute } from '@/components/auth'

function ProtectedPage() {
  return (
    <ProtectedRoute>
      <YourProtectedContent />
    </ProtectedRoute>
  )
}
```

## Routes

- `/` - Home page with user menu
- `/login` - Login page
- `/signup` - Sign up page
- `/profile` - Protected profile page (requires authentication)

## Security Notes

- Never commit `.env.local` to version control (it's in .gitignore)
- Firebase API keys are safe to expose in client code, but set up Firebase Security Rules
- Enable email verification in Firebase Console for production
- Consider adding rate limiting and other security measures
