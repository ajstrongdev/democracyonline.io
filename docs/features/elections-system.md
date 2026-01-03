# Elections System

## Overview

The elections system manages democratic processes for selecting Representatives, Senators, and President. Users can declare candidacy, vote for candidates, and winners are determined through ranked-choice voting or other voting mechanisms.

## Technical Implementation

### Core Technologies

- **Drizzle ORM**: Election and vote tracking
- **TanStack Router**: Election routes
- **TanStack Query**: Real-time vote counting
- **Ranked-Choice Voting**: Advanced voting algorithm

### Architecture

#### Database Schema

**Location**: [src/db/schema.ts](../src/db/schema.ts)

**Elections Table**:

```typescript
elections {
  election: varchar (Primary Key - e.g., 'House2024', 'Senate2024')
  status: varchar (Candidacy/Voting/Complete)
  seats: integer (Number of seats to fill)
  daysLeft: integer (Days until election closes)
}
```

**Candidates Table**:

```typescript
candidates {
  id: serial (Primary Key)
  userId: integer (Foreign Key to users)
  election: varchar (Foreign Key to elections)
  votes: integer (Vote count)
  haswon: boolean (Winner flag)

  Unique Constraint: (userId, election)
}
```

**Votes Table**:

```typescript
votes {
  id: serial (Primary Key)
  userId: integer (Foreign Key to users - voter)
  election: varchar (Foreign Key to elections)
  candidateId: integer (Foreign Key to candidates)

  Unique Constraint: (userId, election, candidateId)
}
```

**Senate Election Table**:

```typescript
senateElection {
  id: serial (Primary Key)
  voterId: integer (Foreign Key to users)
  candidateId: integer (Foreign Key to candidates)
  pointsWon: integer (Points from ranked-choice voting)
}
```

**Presidential Election Table**:

```typescript
presidentialElection {
  id: serial (Primary Key)
  voterId: integer (Foreign Key to users)
  candidateId: integer (Foreign Key to candidates)
  pointsWon: integer (Points from ranked-choice voting)
}
```

#### Relations

- **Elections → Candidates**: One-to-many
- **Elections → Votes**: One-to-many
- **Candidates → User**: Many-to-one
- **Candidates → Votes**: One-to-many
- **Votes → User**: Many-to-one (voter)
- **Votes → Candidate**: Many-to-one

### Server Functions

**Location**: [src/lib/server/elections.ts](../src/lib/server/elections.ts) (inferred)

#### Query Functions

1. **`getElections()`**: Lists all current elections
   - Returns elections with status and dates
   - Shows number of seats available

2. **`getElection(electionId)`**: Fetches single election details
   - Includes candidates
   - Includes vote counts
   - Shows days remaining

3. **`getCandidates(electionId)`**: Lists candidates for election
   - Ordered by vote count
   - Includes user information
   - Shows party affiliation

4. **`getUserCandidate(userId, electionId)`**: Checks candidacy status
   - Returns candidacy record if exists
   - Used to prevent duplicate candidacies

5. **`getUserVote(userId, electionId)`**: Gets user's vote
   - Returns which candidate(s) user voted for
   - Used for ranked-choice tracking

6. **`getElectionResults(electionId)`**: Calculates winners
   - Aggregates vote counts
   - Applies voting algorithm
   - Determines seat allocation

#### Mutation Functions

1. **`declareCandidacy(userId, electionId)`**: Register as candidate

   **Process**:
   - Validates user isn't already a candidate
   - Validates election is in Candidacy phase
   - Validates user meets requirements (party affiliation, etc.)
   - Creates candidate record

2. **`withdrawCandidacy(userId, electionId)`**: Remove candidacy

   **Process**:
   - Validates user is a candidate
   - Validates election is in Candidacy phase
   - Deletes candidate record
   - Removes associated votes

3. **`voteInElection(userId, electionId, candidateId)`**: Cast vote

   **Process**:
   - Validates election is in Voting phase
   - Validates candidate exists
   - Validates user hasn't voted yet
   - Records vote

4. **`voteRankedChoice(userId, electionId, rankings)`**: Ranked vote

   **Process**:
   - Validates election uses ranked-choice
   - Validates rankings are valid
   - Records multiple vote records with weights
   - Used for Senate/Presidential elections

5. **`finalizeElection(electionId)`**: Close election and determine winners

   **Process**:
   - Validates all votes counted
   - Runs appropriate voting algorithm
   - Sets winner flags on candidates
   - Updates user roles (Representative, Senator, President)
   - Changes election status to Complete
   - Creates feed posts announcing winners

### Election Types

#### House Elections (Representatives)

- **Voting Method**: Simple plurality
- **Seats**: Variable (many seats)
- **Eligibility**: All users can run and vote
- **Winner Determination**: Top N vote-getters win
- **Term**: Until next election cycle

#### Senate Elections

- **Voting Method**: Ranked-choice voting
- **Seats**: Fixed number (fewer than House)
- **Eligibility**: All users can run and vote
- **Winner Determination**: Ranked-choice algorithm
- **Term**: Longer than House terms

#### Presidential Elections

- **Voting Method**: Ranked-choice voting
- **Seats**: 1
- **Eligibility**: All users can run and vote
- **Winner Determination**: Majority with ranked-choice fallback
- **Term**: Fixed presidential term

### Voting Algorithms

#### Simple Plurality (House)

```typescript
// Top N candidates by vote count
const winners = candidates.sort((a, b) => b.votes - a.votes).slice(0, seats)
```

#### Ranked-Choice Voting (Senate/President)

1. Voters rank candidates in order of preference
2. If candidate has majority of first-choice votes, they win
3. Otherwise, eliminate candidate with fewest votes
4. Redistribute their votes to next choice
5. Repeat until winners determined

Implementation uses `senateElection` and `presidentialElection` tables to track point allocation from rankings.

### Routes

#### Elections Listing

**Route**: `/elections`

**Features**:

- Lists all active elections
- Shows status (Candidacy/Voting/Complete)
- Displays days remaining
- Click to view election details

#### Election Detail

**Route**: `/elections/$electionId`

**Features**:

- Election information
- List of candidates with vote counts
- Declare candidacy button (if eligible)
- Vote interface (if in voting phase)
- Results (if complete)

**Different Views Based on Phase**:

- **Candidacy**: Show candidates, allow declarations
- **Voting**: Show candidates, allow voting
- **Complete**: Show winners and full results

#### Voting Interface

**Embedded in election detail page**

**Simple Voting** (House):

- Radio buttons to select one candidate
- Submit vote button

**Ranked-Choice Voting** (Senate/President):

- Drag-and-drop interface for ranking
- Must rank at least top 3 choices
- Submit rankings button

## Features

### Election Phases

1. **Candidacy Phase**:
   - Users declare candidacy
   - Campaign period
   - Can withdraw candidacy
   - No voting yet

2. **Voting Phase**:
   - No new candidates
   - Users cast votes
   - Can't change vote after submission
   - Vote counts visible or hidden (configurable)

3. **Complete Phase**:
   - Winners announced
   - Full results published
   - Roles updated
   - Historical record

### Candidacy Requirements

- User must be authenticated
- Must not be running in another active election
- May require party affiliation
- May require minimum account age
- May require activity threshold

### Voting Rules

- One vote per election per user
- Can't vote for yourself
- Must vote during voting phase
- Votes are final once cast
- Ranked-choice requires minimum rankings

### Role Assignment

When election completes:

- **House Winners**: Assigned "Representative" role
- **Senate Winners**: Assigned "Senator" role
- **Presidential Winner**: Assigned "President" role
- Roles grant specific permissions (voting on bills, executive actions)

### Campaign Features

- Candidate profiles displayed
- Party affiliation shown
- Campaign statements/bios
- Endorsements (future)
- Debates (future)

## Data Flow

### Declaring Candidacy

1. User views election in Candidacy phase
2. Clicks "Run for Office"
3. Confirms candidacy declaration
4. Client calls `declareCandidacy` mutation
5. Server validates eligibility
6. Creates candidate record
7. User appears in candidate list
8. Feed post created announcing candidacy

### Voting Process

1. User views election in Voting phase
2. Sees list of candidates
3. Selects candidate(s) based on voting method
4. Submits vote
5. Client calls `voteInElection` or `voteRankedChoice`
6. Server validates and records vote
7. Vote count updated (if visible)
8. User can no longer vote in this election

### Election Finalization

1. Voting phase timer expires
2. System triggers `finalizeElection`
3. Counts all votes
4. Applies voting algorithm
5. Determines winners
6. Updates candidate records (haswon flag)
7. Updates user roles in database
8. Changes election status to Complete
9. Creates feed posts announcing results
10. Notifications sent to winners

## Security & Authorization

1. **Candidacy**: Must be authenticated
2. **Voting**: Must be authenticated and eligible
3. **One Candidate Per Election**: Database constraint
4. **One Vote Per Election**: Database constraint
5. **Phase Restrictions**: Operations only allowed in correct phase
6. **Role Updates**: Only system can assign roles
7. **Result Verification**: Vote counts auditable

## Performance Optimizations

1. **Vote Aggregation**: Computed in database
2. **Caching**: Election data cached with TanStack Query
3. **Indexed Queries**: Indexes on election and userId
4. **Batch Operations**: Role updates batched
5. **Result Precomputation**: Winners calculated once

## Integration Points

### User Roles System

Elections update user roles:

- Representative
- Senator
- President

These roles affect:

- Bill voting eligibility
- Legislative stage access
- Special powers/actions

### Feed System

Election events create feed posts:

- Candidacy declarations
- Election results
- Winner announcements

### Party System

Candidates' party affiliations displayed:

- Shows party logo and color
- Helps voters make informed decisions
- Party performance tracked

## Future Enhancements

- Primary elections within parties
- Electoral college system
- Campaign finance tracking
- Debate scheduling
- Candidate endorsements
- Voter turnout statistics
- Election fraud prevention
- Voter registration system
- Absentee voting
- Early voting period
- Election reminders/notifications
- Campaign donations
- Political action committees (PACs)
- Voter guides
- Issue-based candidate matching
