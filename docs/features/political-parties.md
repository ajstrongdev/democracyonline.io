# Political Parties

## Overview

The political parties system allows users to form, join, and manage political organizations. Parties have leaders, members, stances on political issues, and can merge with other parties to form new coalitions.

## Technical Implementation

### Core Technologies

- **Drizzle ORM**: Database queries and type-safe operations
- **TanStack Router**: Route-based data loading
- **TanStack Query**: Client-side data caching and mutations
- **TanStack Form**: Form state management and validation
- **Zod**: Schema validation for party data

### Architecture

#### Database Schema

**Location**: [src/db/schema.ts](../src/db/schema.ts)

**Parties Table**:

```typescript
parties {
  id: serial (Primary Key)
  leaderId: integer (Foreign Key to users)
  name: varchar (Unique, Not Null)
  color: varchar (Hex color code)
  bio: text
  politicalLeaning: varchar
  createdAt: timestamp
  leaning: varchar
  logo: varchar (Logo identifier)
  discord: varchar (Discord server link)
}
```

**Party Stances Table** (Many-to-Many with political_stances):

```typescript
partyStances {
  partyId: integer (Foreign Key to parties)
  stanceId: integer (Foreign Key to political_stances)
  value: varchar (Party's position on this issue)
}
```

**Political Stances Table**:

```typescript
politicalStances {
  id: serial (Primary Key)
  issue: varchar (Issue name)
  description: varchar (Issue description)
}
```

#### Relations

- **Party → Leader**: One-to-one relationship with users table
- **Party → Members**: One-to-many relationship with users table
- **Party → Stances**: Many-to-many relationship through partyStances table

### Server Functions

**Location**: [src/lib/server/party.ts](../src/lib/server/party.ts)

#### Data Fetching Functions

1. **`getParties()`**: Fetches all parties with member counts
   - Performs left join with users table
   - Aggregates member count using SQL COUNT
   - Orders by member count (descending)

2. **`getPartyById(partyId)`**: Fetches single party details
   - Returns null if party doesn't exist

3. **`getPartyMembers(partyId)`**: Fetches all members of a party
   - Excludes email addresses for privacy
   - Returns user profiles with party affiliation

4. **`getPartyStances(partyId)`**: Fetches party's political positions
   - Joins party_stances with political_stances
   - Returns issue descriptions and party's values

5. **`partyPageData(email)`**: Combined data loader
   - Fetches all parties
   - Checks if user is in a party
   - Used for party listing page

#### Authorization Functions

1. **`checkUserInParty(email)`**: Checks if user belongs to any party

2. **`checkUserInSpecificParty(userId, partyId)`**: Validates party membership

3. **`checkIfUserIsPartyLeader(userId, partyId)`**: Validates leadership status

4. **`getMembershipStatus(userId, partyId)`**: Combined membership check
   - Returns both membership and leadership status

#### Mutation Functions

1. **`createParty(data)`**: Creates new political party
   - Validates using `CreatePartySchema`
   - Automatically sets creator as leader and first member
   - Creates party stances for all political issues
   - Transactions ensure data consistency

2. **`joinParty(userId, partyId)`**: Adds user to party
   - Validates user isn't already in a party
   - Updates user's partyId field

3. **`leaveParty(userId, partyId)`**: Removes user from party
   - Validates user is in the specified party
   - Sets user's partyId to null
   - Special handling for party leaders (must transfer leadership or dissolve)

4. **`updateParty(partyId, data)`**: Updates party information
   - Validates using `UpdatePartySchema`
   - Only party leaders can update
   - Updates party metadata and stances

5. **`transferLeadership(partyId, newLeaderId)`**: Changes party leader
   - Validates current user is the leader
   - Validates new leader is a party member

6. **`dissolveParty(partyId, userId)`**: Deletes party
   - Only party leader can dissolve
   - Removes all member associations
   - Deletes party stances
   - Deletes party record

### Routes

#### Party Listing Page

**Route**: [src/routes/parties/index.tsx](../src/routes/parties/index.tsx)

Displays all parties in a grid with:

- Party logo and name
- Member count
- Political leaning indicator
- Color-coded theme
- Join button (if user not in a party)

**Data Loading**:

```typescript
loader: ({ context }) => {
  return queryClient.ensureQueryData({
    queryKey: ['parties'],
    queryFn: () => partyPageData({ data: { email: userEmail } }),
  })
}
```

#### Party Detail Page

**Route**: [src/routes/parties/$id.tsx](../src/routes/parties/$id.tsx)

Displays:

- Party information (bio, color, logo)
- Political stances
- Member list
- Join/Leave button
- Leadership actions (if user is leader)

**Dynamic Route Parameter**: `$id` (party ID)

#### Party Creation Page

**Route**: [src/routes/parties/create.tsx](../src/routes/parties/create.tsx)

Multi-step form for creating a party:

1. **Basic Information**: Name, color, logo
2. **Political Leaning**: Overall political position
3. **Bio**: Party description and mission
4. **Political Stances**: Positions on various issues
5. **Social Links**: Discord server URL

**Form Validation**:

- Name: Required, unique
- Color: Valid hex color code
- Logo: One of predefined options
- Stances: Required for all issues

#### Party Management Page

**Route**: [src/routes/parties/manage/$id.tsx](../src/routes/parties/manage/$id.tsx)

Party leader-only page for:

- Updating party information
- Modifying political stances
- Managing members
- Transferring leadership
- Dissolving party

**Authorization**: Redirects non-leaders to party detail page

### UI Components

#### Party Logo Component

**Location**: [src/components/party-logo.tsx](../src/components/party-logo.tsx)

Renders party logo with:

- Dynamic color theming
- Responsive sizing
- Fallback to default logo
- Integration with logo helper utility

**Location**: [src/lib/utils/logo-helper.ts](../src/lib/utils/logo-helper.ts)

Maps logo identifiers to Lucide React icons:

- Shield, Star, Flag, Heart, etc.
- Consistent icon sizing
- Type-safe logo selection

### Validation Schemas

**Location**: [src/lib/schemas/party-schema.ts](../src/lib/schemas/party-schema.ts)

**CreatePartySchema**:

```typescript
{
  name: string (min 3, max 100)
  color: string (hex color format)
  bio: string (min 10, max 1000)
  politicalLeaning: enum
  leaning: enum
  logo: string
  discord: string (URL format, optional)
  stances: array of {
    stanceId: number
    value: string
  }
}
```

**UpdatePartySchema**: Similar to CreatePartySchema with optional fields

## Features

### Party Creation

- Users can create parties if they're not already in one
- Creator automatically becomes party leader
- All political stances must be defined during creation
- Party name must be unique across the platform

### Party Membership

- Users can join one party at a time
- Leaving a party removes all associations
- Leaders must transfer leadership before leaving
- Member count displayed on party cards

### Political Stances

- Each party defines positions on predefined political issues
- Stances displayed on party profile
- Allows voters to understand party platforms
- Leaders can update stances over time

### Party Leadership

- Each party has exactly one leader
- Leaders can:
  - Update party information
  - Modify political stances
  - Transfer leadership to members
  - Dissolve the party
- Leadership transfer requires new leader to be a member

### Party Customization

- **Color**: Hex color code for branding
- **Logo**: Selection from predefined icon set
- **Bio**: Markdown-supported description
- **Discord**: Integration with external community
- **Political Leaning**: Left/Right/Center spectrum

## Data Flow

### Creating a Party

1. User navigates to `/parties/create`
2. Fills out multi-step form
3. Form validates data against schema
4. Client calls `createParty` server function
5. Server creates party with transaction:
   - Insert party record
   - Update user's partyId
   - Insert all party stances
6. User redirected to new party page

### Joining a Party

1. User clicks "Join" on party card
2. Client calls `joinParty` mutation
3. Server validates:
   - User isn't in another party
   - Party exists
4. Updates user's partyId
5. TanStack Query invalidates party queries
6. UI updates with new member count

### Viewing Party Details

1. User navigates to `/parties/$id`
2. Route loader fetches:
   - Party information
   - Party members
   - Party stances
   - User's membership status
3. TanStack Query caches data
4. Component renders with cached data
5. Background refetch on mount

## Security & Authorization

1. **Party Creation**: Users must be authenticated and not in a party
2. **Party Management**: Only party leaders can modify party data
3. **Member Actions**: Users can only join/leave if eligible
4. **Data Privacy**: Email addresses hidden from member lists
5. **Input Validation**: All mutations validated with Zod schemas

## Performance Optimizations

1. **Query Caching**: TanStack Query caches party data
2. **Aggregated Queries**: Member counts calculated in database
3. **Selective Field Loading**: Only necessary fields fetched
4. **Optimistic Updates**: UI updates before server confirmation
5. **Background Refetching**: Stale data refreshed automatically

## Future Enhancements

- Party rankings based on member count
- Party activity feed
- Party-specific forums or discussions
- Party achievements and milestones
- Inter-party alliances (separate from merges)
- Party invite system
- Private vs. public parties
- Party application/approval process
