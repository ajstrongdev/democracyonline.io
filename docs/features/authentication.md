# Authentication

## Overview

The application uses Firebase Authentication for user management, providing secure email/password-based authentication with protected routes and persistent sessions.

## Technical Implementation

### Core Technologies

- **Firebase Authentication**: Email/password authentication provider
- **Firebase Admin SDK**: Server-side authentication verification
- **React Context API**: Client-side authentication state management
- **TanStack Router**: Protected route handling

### Architecture

#### Client-Side Authentication

The authentication system is built around a React Context provider that manages the authentication state throughout the application:

**Location**: [src/lib/auth-context.tsx](../src/lib/auth-context.tsx)

```typescript
- AuthContext: Provides authentication state (user, loading)
- AuthProvider: Wrapper component that listens to Firebase auth changes
- useAuth: Custom hook for accessing authentication context
```

**Key Features**:

- Real-time authentication state updates via `onAuthStateChanged`
- Automatic token refresh
- Loading state management during authentication checks
- Global user object availability

#### Firebase Configuration

**Location**: [src/lib/firebase.ts](../src/lib/firebase.ts)

Configuration is managed through environment variables validated by T3 Env:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

#### Protected Routes

**Location**: [src/components/auth/protected-route.tsx](../src/components/auth/protected-route.tsx)

The `ProtectedRoute` component wraps routes that require authentication:

- Checks authentication state
- Redirects to login page if not authenticated
- Passes user information to child components
- Displays loading state during authentication checks

### User Registration Flow

**Location**: [src/components/auth/signup-form.tsx](../src/components/auth/signup-form.tsx)

1. User submits email, username, and password
2. Firebase creates authentication account
3. User record created in PostgreSQL database via server function
4. Automatic sign-in after successful registration
5. Redirect to home page

**Database Integration**:

- User data stored in `users` table with email, username, and additional profile fields
- Server-side validation using Zod schemas
- Automatic timestamp tracking

### User Login Flow

**Route**: [src/routes/login.tsx](../src/routes/login.tsx)

1. User submits email and password
2. Firebase validates credentials
3. Authentication state updated globally
4. User redirected to dashboard

### User Menu Component

**Location**: [src/components/auth/user-menu.tsx](../src/components/auth/user-menu.tsx)

Provides:

- User profile display
- Sign out functionality
- Theme toggle integration
- Mobile-responsive sidebar integration

## Database Schema

### Users Table

**Location**: [src/db/schema.ts](../src/db/schema.ts)

```typescript
users {
  id: serial (Primary Key)
  email: varchar (Unique, Not Null)
  username: varchar (Unique, Not Null)
  bio: text
  politicalLeaning: varchar
  role: varchar (Default: 'Representative')
  partyId: integer (Foreign Key to parties)
  createdAt: timestamp
  isActive: boolean
  lastActivity: bigint
}
```

## API Integration

### Server Functions

**Location**: [src/lib/server/users.ts](../src/lib/server/users.ts)

- `getUserByEmail`: Fetch user data by email address
- `createUser`: Create new user record in database
- `updateUser`: Update user profile information
- `getUserById`: Fetch user data by user ID

### Authentication Utilities

**Location**: [src/lib/auth-utils.ts](../src/lib/auth-utils.ts)

Helper functions for:

- Token verification
- Session management
- User data extraction from Firebase tokens

## Security Features

1. **Environment Variable Validation**: T3 Env ensures all required Firebase credentials are present
2. **Server-Side Verification**: Firebase Admin SDK verifies tokens on the server
3. **Password Requirements**: Firebase enforces minimum password complexity
4. **Protected Routes**: Unauthorized access automatically redirects to login
5. **Secure Token Storage**: Firebase handles token storage and refresh automatically

## Error Handling

- Firebase authentication errors are caught and displayed to users
- Network errors are handled gracefully with retry mechanisms
- Database errors are logged server-side without exposing sensitive information

## Integration Points

### Router Integration

**Location**: [src/router.tsx](../src/router.tsx)

The router context includes authentication state:

```typescript
context: {
  auth: {
    user: FirebaseUser | null,
    loading: boolean
  }
}
```

This allows any route to access authentication state without prop drilling.

### TanStack Query Integration

Authentication state is integrated with TanStack Query to:

- Invalidate queries on sign out
- Refetch user-specific data on sign in
- Provide loading states during authentication changes

## Usage Examples

### Accessing Authentication State in Components

```tsx
import { useAuth } from '@/lib/auth-context'

function MyComponent() {
  const { user, loading } = useAuth()

  if (loading) return <Spinner />
  if (!user) return <LoginPrompt />

  return <div>Welcome {user.email}</div>
}
```

### Creating Protected Routes

```tsx
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/protected-page')({
  beforeLoad: ({ context }) => {
    if (!context.auth.user) {
      throw redirect({ to: '/login' })
    }
  },
})
```

## Future Enhancements

- Social authentication providers (Google, GitHub)
- Multi-factor authentication (MFA)
- Email verification requirement
- Password reset flow
- Session timeout management
- Remember me functionality
