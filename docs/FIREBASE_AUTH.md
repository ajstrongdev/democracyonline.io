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

4. **Environment Variables**

   ```
   # Client-side Firebase config
   VITE_FIREBASE_API_KEY=your-api-key
   VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=your-project-id
   VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
   VITE_FIREBASE_APP_ID=your-app-id

   # Server-side Firebase Admin SDK (for token verification)
   FIREBASE_PROJECT_ID=your-project-id
   FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
   FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
   ```

5. **Get Firebase Admin Credentials**
   - In Firebase Console, go to Project Settings > Service Accounts
   - Click "Generate new private key"
   - Use the values from the downloaded JSON file for the server-side environment variables

## Features

- Email/Password Authentication
- User Sign Up with optional display name
- User Sign In
- User Sign Out
- Password Reset
- Protected Routes
- Auth Context with React hooks
- User Menu Component
- Server-Side Token Verification (Firebase Admin SDK)
- Authentication Middleware for Server Functions

## Usage

### Authentication Components

```tsx
import {
  LoginForm,
  SignupForm,
  UserMenu,
  ProtectedRoute,
} from "@/components/auth";
```

### Auth Hooks

```tsx
import { useAuth } from "@/lib/auth-context";

function MyComponent() {
  const { user, loading } = useAuth();

  if (loading) return <div>Loading...</div>;
  if (!user) return <div>Please sign in</div>;

  return <div>Hello, {user.email}</div>;
}
```

### Auth Utilities

```tsx
import { signIn, signUp, logOut, resetPassword } from "@/lib/auth-utils";

// Sign in
const { user, error } = await signIn({ email, password });

// Sign up
const { user, error } = await signUp({ email, password, displayName });

// Sign out
await logOut();

// Reset password
await resetPassword(email);
```

### Protected Routes

```tsx
import { ProtectedRoute } from "@/components/auth";

function ProtectedPage() {
  return (
    <ProtectedRoute>
      <YourProtectedContent />
    </ProtectedRoute>
  );
}
```

### Server Function Authentication

Server functions can be protected using authentication middleware. The middleware uses `getRequest()` from TanStack Start to access the Authorization header and verifies tokens using Firebase Admin SDK.

```tsx
import { createServerFn } from "@tanstack/react-start";
import { requireAuthMiddleware } from "@/middleware";

// This function requires authentication
export const updateUserProfile = createServerFn()
  .middleware([requireAuthMiddleware])
  .validator(schema)
  .handler(async ({ data, context }) => {
    // context.user contains { uid, email }
    const { uid, email } = context.user;

    // Verify the user is performing action on their own data
    // ... your logic here
  });
```

Two middleware options are available:

- `authMiddleware`: Optional auth - sets `context.user` to the authenticated user or `null` if not authenticated
- `requireAuthMiddleware`: Required auth - throws `Error('Authentication required')` if not authenticated

## Routes

- `/` - Home page with user menu
- `/login` - Login page
- `/register` - Sign up page
- `/profile` - Protected profile page (requires authentication)
