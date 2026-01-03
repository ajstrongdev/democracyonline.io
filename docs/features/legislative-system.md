# Legislative System (Bills)

## Overview

The legislative system allows users to propose, vote on, and track bills through a three-stage legislative process: House of Representatives, Senate, and Presidential approval. Bills progress through each stage based on voting outcomes.

## Technical Implementation

### Core Technologies

- **Drizzle ORM**: Complex voting queries and aggregations
- **TanStack Router**: Bill routing and data loading
- **TanStack Query**: Real-time vote tracking
- **TanStack Form**: Bill creation and voting forms
- **Zod**: Schema validation for bills

### Architecture

#### Database Schema

**Location**: [src/db/schema.ts](../src/db/schema.ts)

**Bills Table**:

```typescript
bills {
  id: serial (Primary Key)
  status: varchar (Queued/Active/Passed/Failed)
  stage: varchar (House/Senate/Presidential)
  title: varchar (Bill title, max 255 chars)
  creatorId: integer (Foreign Key to users)
  content: text (Bill content/description)
  createdAt: timestamp
  pool: integer (Foreign Key to game_tracker)
}
```

**Bill Votes Tables** (Three separate tables for each stage):

```typescript
billVotesHouse {
  id: serial (Primary Key)
  billId: integer (Foreign Key to bills)
  voterId: integer (Foreign Key to users)
  voteYes: boolean (true = Yes, false = No)
}

billVotesSenate {
  id: serial (Primary Key)
  billId: integer (Foreign Key to bills)
  voterId: integer (Foreign Key to users)
  voteYes: boolean
}

billVotesPresidential {
  id: serial (Primary Key)
  billId: integer (Foreign Key to bills)
  voterId: integer (Foreign Key to users)
  voteYes: boolean
}
```

**Game Tracker Table**:

```typescript
gameTracker {
  id: serial (Primary Key)
  billPool: integer (Current pool/cycle number)
}
```

#### Relations

- **Bills → Creator**: Many-to-one with users table
- **Bills → House Votes**: One-to-many with billVotesHouse
- **Bills → Senate Votes**: One-to-many with billVotesSenate
- **Bills → Presidential Votes**: One-to-many with billVotesPresidential
- **Bills → Pool**: Many-to-one with gameTracker

### Server Functions

**Location**: [src/lib/server/bills.ts](../src/lib/server/bills.ts)

#### Query Functions

1. **`getBills()`**: Fetches all bills with vote counts

   **Process**:
   - Creates CTEs (Common Table Expressions) for vote counting
   - Separate counts for Yes/No votes at each stage
   - Performs complex joins to aggregate all data
   - Returns comprehensive bill data with voting statistics

   **Returned Data**:

   ```typescript
   {
     ...billFields,
     creator: string, // username
     houseTotalYes: number,
     houseTotalNo: number,
     senateTotalYes: number,
     senateTotalNo: number,
     presidentialTotalYes: number,
     presidentialTotalNo: number
   }
   ```

2. **`getBillById(billId)`**: Fetches single bill with votes
   - Similar aggregation to getBills
   - Returns null if bill doesn't exist

3. **`getUserVote(billId, userId, stage)`**: Checks if user voted
   - Queries appropriate votes table based on stage
   - Returns vote value (Yes/No) or null if not voted

4. **`getCurrentPool()`**: Gets current bill pool/cycle number
   - Returns active pool from gameTracker table

#### Mutation Functions

1. **`createBill(data)`**: Creates new bill proposal

   **Process**:
   - Validates using `CreateBillsSchema`
   - Gets current pool number
   - Inserts bill with status "Queued" and stage "House"
   - Returns created bill ID

   **Input Schema**:

   ```typescript
   {
     title: string (max 255 chars)
     content: string (bill text)
     creatorId: number
   }
   ```

2. **`voteOnBill(data)`**: Records user's vote on a bill

   **Process**:
   - Validates user hasn't already voted on this stage
   - Determines which votes table to use based on stage
   - Inserts vote record
   - Returns success status

   **Input Schema**:

   ```typescript
   {
     billId: number
     voterId: number
     voteYes: boolean
     stage: 'House' | 'Senate' | 'Presidential'
   }
   ```

3. **`advanceStage(billId)`**: Moves bill to next legislative stage

   **Process**:
   - Counts votes in current stage
   - Determines if bill passed (majority Yes votes)
   - If passed:
     - House → Senate
     - Senate → Presidential
     - Presidential → Status "Passed"
   - If failed:
     - Status set to "Failed"
   - Clears votes for next stage

4. **`updateBillStatus(billId, status)`**: Updates bill status
   - Admin/system function
   - Changes status (Queued/Active/Passed/Failed)

### Routes

#### Bills Listing Page

**Route**: [src/routes/bills.tsx](../src/routes/bills.tsx)

**Features**:

- Lists all bills with vote counts
- Filters by status (All/Queued/Active/Passed/Failed)
- Filters by stage (All/House/Senate/Presidential)
- Shows voting progress bars
- Create bill button (if authenticated)
- Click bill to view details

**Data Loading**:

- Uses route loader to fetch bills
- TanStack Query caches bill list
- Background refetch on mount

**UI Components**:

- Bill cards with title and status badges
- Vote progress indicators
- Creator attribution
- Timestamp display

#### Bill Detail Page

**Route**: [src/routes/bills/$billId.tsx](../src/routes/bills/$billId.tsx)

**Features**:

- Full bill content display
- Voting statistics for all stages
- Vote buttons (if user hasn't voted in current stage)
- User's vote indicator (if already voted)
- Creator information
- Share/bookmark options

**Voting UI**:

- "Vote Yes" and "Vote No" buttons
- Disabled if already voted
- Shows user's previous vote
- Real-time vote count updates

#### Bill Creation Page

**Route**: [src/routes/bills/create.tsx](../src/routes/bills/create.tsx)

**Features**:

- Bill title input
- Rich text editor for bill content
- Preview mode
- Character count
- Validation feedback

**Form Validation**:

- Title: Required, max 255 characters
- Content: Required, min 50 characters
- Creator: Automatically set to current user

### Validation Schemas

**Location**: [src/lib/schemas/bills-schema.ts](../src/lib/schemas/bills-schema.ts)

**CreateBillsSchema**:

```typescript
{
  title: string (min 10, max 255)
  content: string (min 50, max 10000)
  creatorId: number (positive)
}
```

## Features

### Three-Stage Legislative Process

1. **House of Representatives**:
   - All members can vote
   - Simple majority required to pass
   - Advances to Senate if passed

2. **Senate**:
   - Senators only (elected position)
   - Simple majority required
   - Advances to Presidential if passed

3. **Presidential**:
   - President only (elected position)
   - Can approve or veto
   - Single vote determines outcome

### Bill Lifecycle

```
Created (Queued) → House Vote → Senate Vote → Presidential Vote → Passed
                          ↓            ↓              ↓
                       Failed       Failed        Failed (Vetoed)
```

**States**:

- **Queued**: Waiting to become active
- **Active**: Currently accepting votes
- **Passed**: Completed all stages successfully
- **Failed**: Rejected at any stage

### Voting Rules

- **One Vote Per Stage**: Users can only vote once per stage
- **No Vote Changes**: Votes are final once cast
- **Role-Based Voting**:
  - House stage: All users
  - Senate stage: Senators only
  - Presidential stage: President only
- **Vote Privacy**: Individual votes are recorded but may not be public

### Bill Pool System

- Bills organized into pools/cycles
- Pools advance on schedule (game mechanic)
- Multiple bills can be in same pool
- Pool number used for organization and timing

### Vote Tracking & Display

- Real-time vote count aggregation
- Percentage calculations
- Visual progress bars
- Historical vote data retained

## Data Flow

### Creating a Bill

1. User navigates to `/bills/create`
2. Fills out bill form (title, content)
3. Submits form
4. Client calls `createBill` server function
5. Server validates data
6. Creates bill record with status "Queued"
7. Assigns to current pool
8. Redirects to bill detail page
9. Bill appears in queued bills list

### Voting on a Bill

1. User views bill detail page
2. Sees vote buttons if eligible
3. Clicks "Vote Yes" or "Vote No"
4. Client calls `voteOnBill` mutation
5. Server validates:
   - User is eligible for this stage
   - User hasn't voted on this stage
   - Bill is in Active status
6. Records vote in appropriate table
7. TanStack Query invalidates bill queries
8. Vote counts update in real-time
9. Vote buttons disabled for user

### Advancing Bill Stages

**Automated Process** (triggered by game advancement):

1. Game advancement event occurs
2. For each active bill:
   - Count votes in current stage
   - Calculate pass/fail
   - If passed:
     - Update stage to next level
     - Status remains "Active"
   - If failed:
     - Update status to "Failed"
     - Stage remains same (for record)
3. All affected bills updated
4. Notifications sent to bill creators
5. Feed posts created for passed bills

## Security & Authorization

1. **Bill Creation**: Only authenticated users
2. **Voting Authorization**:
   - House: All authenticated users
   - Senate: Only users with Senator role
   - Presidential: Only user with President role
3. **One Vote Per Stage**: Enforced by database constraints
4. **Input Validation**: All data validated with Zod
5. **SQL Injection Prevention**: Parameterized queries via Drizzle ORM

## Performance Optimizations

1. **Vote Aggregation**: Done in database with CTEs
2. **Query Caching**: TanStack Query caches bill and vote data
3. **Batch Loading**: All bills loaded with votes in single query
4. **Indexed Queries**: Database indexes on billId and voterId
5. **Selective Field Loading**: Only necessary fields fetched

## Edge Cases Handled

1. **Tie Votes**: Configurable tie-breaking rules
2. **No Votes Cast**: Bill fails if no votes
3. **User Role Changes**: Re-validated at vote time
4. **Concurrent Votes**: Database transactions prevent duplicates
5. **Deleted Users**: Foreign key constraints maintain referential integrity
6. **Pool Changes**: Bills remain in original pool

## Game Integration

### Game Advancement API

**Route**: [src/routes/api/game-advance.ts](../src/routes/api/game-advance.ts)

**Purpose**: Advances game state, processes bills

**Process**:

1. Triggered by scheduled task or admin action
2. Advances bill pool number
3. Processes all active bills:
   - Counts votes
   - Advances or fails bills
4. Creates feed posts for results
5. Updates game tracker

**Authorization**: Requires API token

## Future Enhancements

- Bill amendments
- Co-sponsors system
- Committee assignments
- Bill categories/tags
- Public comment period
- Vote explanations/justifications
- Bill versioning
- Related bills linking
- Vote delegation/proxies
- Quorum requirements
- Super-majority options
- Floor debate system
- Bill scheduling/calendar
