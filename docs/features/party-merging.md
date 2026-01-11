# Party Merging

## Overview

The party merging system allows party leaders to propose mergers with other parties, creating a new unified party with combined membership and negotiated political positions. This feature enables coalition-building and strategic party consolidation.

## Technical Implementation

### Core Technologies

- **Drizzle ORM**: Database transactions and complex queries
- **TanStack Router**: Merge request routing
- **TanStack Query**: Real-time merge request updates
- **TanStack Form**: Merge proposal form management
- **Zod**: Schema validation for merge requests

### Architecture

#### Database Schema

**Location**: [src/db/schema.ts](../src/db/schema.ts)

**Merge Request Table**:

```typescript
mergeRequest {
  id: serial (Primary Key)
  leaderId: integer (Foreign Key to users - proposer)
  name: varchar (Proposed new party name)
  color: varchar (Proposed new party color)
  bio: text (Proposed new party bio)
  politicalLeaning: varchar
  createdAt: timestamp
  leaning: varchar
  logo: varchar (Proposed new party logo)
}
```

**Merge Request Stances Table**:

```typescript
mergeRequestStances {
  id: serial (Primary Key)
  mergeRequestId: integer (Foreign Key to merge_request)
  stanceId: integer (Foreign Key to political_stances)
  value: text (Proposed stance position)
}
```

**Party Notifications Table**:

```typescript
partyNotifications {
  senderPartyId: integer (FK - party proposing merge)
  receiverPartyId: integer (FK - party receiving proposal)
  mergeRequestId: integer (FK - merge proposal details)
  createdAt: timestamp
  status: varchar (Pending/Accepted/Rejected)

  Primary Key: (senderPartyId, receiverPartyId, mergeRequestId)
}
```

#### Relations

- **Merge Request → Leader**: Many-to-one with users table
- **Merge Request → Stances**: One-to-many with merge_request_stances
- **Party Notifications → Parties**: Many-to-one for sender and receiver
- **Party Notifications → Merge Request**: Many-to-one

### Server Functions

**Location**: [src/lib/server/party-merge.ts](../src/lib/server/party-merge.ts)

#### Query Functions

1. **`getMergeRequestsReceived(partyId)`**: Fetches merge proposals received
   - Joins notifications, merge requests, and sender party data
   - Filters by receiver party and pending status
   - Returns proposed party details and sender information

2. **`getMergeRequestsSent(partyId)`**: Fetches merge proposals sent
   - Similar to received but filters by sender party
   - Shows proposals awaiting response from other parties

3. **`getMergeRequestCount(partyId)`**: Counts pending merge requests
   - Used for notification badges
   - Only counts received requests

4. **`getMergeRequestDetails(mergeRequestId, partyId)`**: Full merge proposal
   - Fetches complete merge request with stances
   - Validates party is involved (sender or receiver)
   - Used for merge review page

#### Mutation Functions

1. **`createMergeRequest(data)`**: Proposes a party merger

   **Process**:
   - Validates both parties exist and user is sender's leader
   - Creates merge request record with proposed party details
   - Creates stance records for all political issues
   - Creates notification records for all receiver parties
   - Uses database transaction for atomicity

   **Input Schema**:

   ```typescript
   {
     senderPartyId: number
     receiverPartyIds: number[]
     name: string
     color: string
     bio: string
     leaning: string
     logo: string
     stances: Array<{stanceId: number, value: string}>
   }
   ```

2. **`acceptMergeRequest(data)`**: Accepts a merge proposal

   **Process**:
   - Validates receiver party leader is accepting
   - Checks all parties in merge are ready to proceed
   - If all parties accepted:
     - Creates new merged party
     - Migrates all members from old parties
     - Creates stances for new party
     - Deletes old parties and their data
     - Creates feed posts announcing merger
   - Updates notification status to Accepted
   - Uses transaction to ensure consistency

   **Input Schema**:

   ```typescript
   {
     senderPartyId: number;
     receiverPartyId: number;
     mergeRequestId: number;
   }
   ```

3. **`rejectMergeRequest(data)`**: Rejects a merge proposal

   **Process**:
   - Validates receiver party leader is rejecting
   - Updates notification status to Rejected
   - Keeps merge request for historical record

   **Input Schema**:

   ```typescript
   {
     senderPartyId: number;
     receiverPartyId: number;
     mergeRequestId: number;
   }
   ```

4. **`cancelMergeRequest(data)`**: Cancels an outgoing proposal

   **Process**:
   - Validates sender party leader is canceling
   - Deletes all associated notifications
   - Deletes merge request stances
   - Deletes merge request record
   - Uses cascade deletion

   **Input Schema**:

   ```typescript
   {
     senderPartyId: number;
     mergeRequestId: number;
   }
   ```

### Routes

#### Merge Proposal Page

**Route**: [src/routes/parties/merge/$id.tsx](../src/routes/parties/merge/$id.tsx)

**Purpose**: Create and send merge proposals to other parties

**Features**:

- Multi-party selection (can propose to multiple parties simultaneously)
- Proposed party configuration:
  - New party name
  - New party color
  - New party logo
  - New party bio
  - New political stances (negotiated positions)
- Preview of proposed party
- List of parties to merge with

**Authorization**:

- Only party leaders can access
- Must be leader of the party specified in URL

**Form Steps**:

1. Select parties to merge with
2. Configure new party details
3. Define political stances for merged party
4. Review and submit proposal

#### Merge Request Review

**Feature**: View and respond to merge proposals (embedded in party management)

**Actions Available**:

- **For Receivers**: Accept or Reject proposal
- **For Senders**: Cancel proposal

**Information Displayed**:

- Proposed party details (name, color, logo, bio)
- Political stances of proposed party
- Parties involved in merger
- Proposal timestamp
- Current status

### Validation Schemas

**Location**: [src/lib/schemas/merge-request-schema.ts](../src/lib/schemas/merge-request-schema.ts)

**CreateMergeRequestSchema**:

```typescript
{
  senderPartyId: number (positive)
  receiverPartyIds: number[] (min 1)
  name: string (min 3, max 255)
  color: string (hex format)
  bio: string (min 10, max 5000)
  leaning: string
  logo: string
  stances: Array<{
    stanceId: number (positive)
    value: string (min 1)
  }>
}
```

**AcceptMergeRequestSchema**:

```typescript
{
  senderPartyId: number;
  receiverPartyId: number;
  mergeRequestId: number;
}
```

**RejectMergeRequestSchema**: Same as Accept

**CancelMergeRequestSchema**:

```typescript
{
  senderPartyId: number;
  mergeRequestId: number;
}
```

## Features

### Multi-Party Mergers

- Can propose mergers involving 2+ parties
- All parties must accept for merger to complete
- If any party rejects, entire proposal fails
- Sender can cancel before all parties respond

### Merge Proposal Workflow

1. **Proposal Creation**:
   - Leader creates merge request
   - Defines all aspects of new party
   - Sends to one or more parties

2. **Proposal Review**:
   - Receiving party leaders notified
   - Can view full proposal details
   - Compare proposed stances with current party

3. **Decision Making**:
   - Each party independently accepts/rejects
   - No time limit on decisions
   - Can reject with no consequences

4. **Merge Execution**:
   - When all parties accept, merger executes automatically
   - New party created with proposed details
   - All members migrated to new party
   - Old parties dissolved
   - Feed posts created announcing merger

### Political Stance Negotiation

- Proposer defines stances for merged party
- Stances may differ from either original party
- Allows for compromise positions
- All stances must be defined at proposal time

### Notification System

- Badge counter shows pending merge requests
- Separate views for sent and received proposals
- Status tracking (Pending/Accepted/Rejected)
- Real-time updates via TanStack Query

### Historical Record

- Rejected proposals remain in database
- Canceled proposals are deleted
- Completed mergers create feed posts
- Maintains audit trail of party evolution

## Data Flow

### Creating a Merge Proposal

1. Party leader navigates to `/parties/merge/$partyId`
2. Selects target parties for merger
3. Fills out proposed party details
4. Defines political stances
5. Submits form
6. Server function creates:
   - Merge request record
   - Stance records
   - Notification records for each receiver
7. Receivers see notification badges
8. Proposer sees sent request in management page

### Accepting a Merge Proposal

1. Receiver party leader views proposal
2. Reviews proposed party details
3. Clicks "Accept"
4. Server validates receiver's authority
5. Updates notification status to Accepted
6. Checks if all parties have accepted:
   - **If not all accepted**: Waits for others
   - **If all accepted**: Executes merger:
     - Creates new party with proposed details
     - Updates all members' partyId
     - Deletes old party records
     - Creates feed posts
     - Deletes merge request and notifications
7. All affected users see updated party affiliation

### Canceling a Merge Proposal

1. Sender party leader views sent requests
2. Clicks "Cancel" on proposal
3. Server validates sender's authority
4. Deletes notification records
5. Deletes merge request
6. Receivers no longer see proposal

## Security & Authorization

1. **Proposal Creation**: Only party leaders can propose mergers
2. **Proposal Response**: Only receiving party leaders can accept/reject
3. **Proposal Cancellation**: Only sending party leader can cancel
4. **Party Validation**: All parties in merge must exist
5. **Leader Validation**: Actions require current leadership status
6. **Transaction Safety**: All operations use database transactions
7. **Input Validation**: All data validated with Zod schemas

## Edge Cases Handled

1. **Leader Changes During Merge**: Re-validates leadership on every action
2. **Party Dissolution During Merge**: Validated parties exist before execution
3. **Concurrent Acceptances**: Database transaction ensures consistency
4. **Duplicate Proposals**: Composite primary key prevents duplicates
5. **Self-Merge Prevention**: Validates sender not in receiver list
6. **Member Migration**: All members transferred atomically

## Performance Optimizations

1. **Batch Notifications**: Creates all notifications in single query
2. **Transaction Management**: Groups related operations
3. **Query Optimization**: Uses joins instead of multiple queries
4. **Selective Loading**: Only loads necessary fields
5. **Query Caching**: TanStack Query caches merge request data

## Integration Points

### Feed System

When merge completes, creates feed posts:

- Announces new party formation
- Lists merging parties
- Visible to all users

### User Profile

User's party affiliation updates automatically when merge completes

### Party Listings

Old parties removed, new party appears in listings with combined member count

## Future Enhancements

- Merge negotiation chat/comments
- Counter-proposals
- Partial merges (some members opt out)
- Merge history page
- Merge request expiration
- Merge approval voting (not just leader decision)
- Merger preview/simulation
- Rollback mechanism for failed mergers
