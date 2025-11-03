# Admin Page Documentation

## Overview

The admin page is a server-rendered component that allows authorized administrators to manage Firebase Authentication users.

## Access Control

Only users with the following email addresses can access the admin page:

- <jenewland1999@gmail.com>
- <ajstrongdev@pm.me>
- <robertjenner5@outlook.com>
- <spam@hpsaucii.dev>

## Features

### User Management

- **View All Users**: Lists all Firebase Authentication users with their details
- **User Information Displayed**:
  - Display Name / Email
  - User ID (UID)
  - Email verification status
  - Account disabled status
  - Account creation date
  - Last sign-in date

### User Actions

- **Disable User**: Prevent a user from signing in
- **Enable User**: Re-enable a previously disabled user
- **Refresh List**: Reload the user list from Firebase

## Technical Architecture

### Server Components

- **`/src/app/admin/page.tsx`**: Main server component that fetches users server-side
- Uses Firebase Admin SDK to list all users on initial page load

### Client Components

- **`AdminAuthWrapper`**: Handles client-side authentication checks
- **`UserList`**: Interactive user management interface with enable/disable functionality

### API Routes

1. **`/api/admin/list-users`** (POST)

   - Lists all Firebase users
   - Requires admin email verification

2. **`/api/admin/toggle-user-status`** (POST)

   - Enables or disables a user account
   - Requires admin email verification

3. **`/api/auth/session`** (POST)
   - Verifies Firebase ID tokens
   - Used for session validation

## Environment Setup

Required environment variables in `.env.local`:

```env
# Firebase Admin SDK
FIREBASE_ADMIN_PROJECT_ID=your-project-id
FIREBASE_ADMIN_CLIENT_EMAIL=your-service-account-email
FIREBASE_ADMIN_PRIVATE_KEY="your-private-key"
```

To get these values:

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Go to **Project Settings** → **Service Accounts**
4. Click **Generate New Private Key**
5. Extract values from the downloaded JSON file

## Security Features

- Email-based authorization (hardcoded allowed emails)
- Firebase ID token verification
- Server-side user list fetching
- Client-side authentication state verification

## Usage

1. Sign in with an authorized admin email
2. Navigate to `/admin`
3. View the list of all users
4. Click "Disable User" or "Enable User" to toggle account status
5. Click "Refresh" to reload the user list

## Files Structure

```
src/
├── app/
│   ├── admin/
│   │   └── page.tsx                    # Main admin page (server component)
│   └── api/
│       ├── admin/
│       │   ├── list-users/route.ts     # List all users API
│       │   └── toggle-user-status/route.ts  # Enable/disable users API
│       └── auth/
│           └── session/route.ts         # Session verification API
├── components/
│   └── admin/
│       ├── AdminAuthWrapper.tsx         # Auth wrapper component
│       └── UserList.tsx                 # User management UI
└── lib/
    ├── firebase-admin.ts                # Firebase Admin SDK setup
    └── serverAuth.ts                    # Server-side auth helpers
```
