# Discord Bot API Documentation

Public-facing API endpoints for the Discord bot integration.

**Base URL:** `/api/bot`

## Overview

The Bot API provides public access to game data including users, parties, and game state information. All endpoints use GET requests with query parameters and return JSON responses.

## Authentication

No authentication required - all endpoints are publicly accessible.

## Endpoints

### Get Users

Retrieve information about users in the game.

#### Get All Users

```
GET /api/bot?endpoint=users
```

**Response:**

```json
[
  {
    "id": 1,
    "username": "john_doe",
    "bio": "Political enthusiast from California",
    "role": "Representative",
    "partyId": 5,
    "politicalLeaning": "Center Left",
    "isActive": true,
    "lastActivity": 0,
    "partyName": "Progressive Party",
    "partyColor": "#3B82F6"
  }
]
```

#### Get Specific User

```
GET /api/bot?endpoint=users&id=1
```

**Parameters:**

- `id` (integer) - User ID

**Response:**

```json
{
  "id": 1,
  "username": "john_doe",
  "bio": "Political enthusiast from California",
  "role": "Senator",
  "partyId": 5,
  "politicalLeaning": "Center Left",
  "isActive": true,
  "lastActivity": 0,
  "partyName": "Progressive Party",
  "partyColor": "#3B82F6"
}
```

**User Fields:**

- `id` - Unique user identifier
- `username` - Display name
- `bio` - User biography/description
- `role` - Position in government (`Representative`, `Senator`, `President`)
- `partyId` - ID of party membership (null if independent)
- `politicalLeaning` - Political ideology
- `isActive` - Whether user is currently active
- `lastActivity` - Days since last activity (0 = today)
- `partyName` - Name of party (null if independent)
- `partyColor` - Hex color code of party

---

### Get Parties

Retrieve information about political parties.

#### Get All Parties

```
GET /api/bot?endpoint=parties
```

**Response:**

```json
[
  {
    "id": 5,
    "name": "Progressive Party",
    "color": "#3B82F6",
    "bio": "Fighting for progress and equality",
    "leaderId": 12,
    "politicalLeaning": "Left",
    "leaning": "Center Left",
    "logo": "progressive-logo.png",
    "discord": "https://discord.gg/example",
    "memberCount": 15
  }
]
```

#### Get Specific Party

```
GET /api/bot?endpoint=parties&id=5
```

**Parameters:**

- `id` (integer) - Party ID

**Response:**

```json
{
  "id": 5,
  "name": "Progressive Party",
  "color": "#3B82F6",
  "bio": "Fighting for progress and equality",
  "leaderId": 12,
  "politicalLeaning": "Left",
  "leaning": "Center Left",
  "logo": "progressive-logo.png",
  "discord": "https://discord.gg/example",
  "memberCount": 15,
  "members": [
    {
      "id": 1,
      "username": "john_doe",
      "role": "Representative"
    },
    {
      "id": 12,
      "username": "jane_smith",
      "role": "Senator"
    }
  ]
}
```

**Party Fields:**

- `id` - Unique party identifier
- `name` - Party name
- `color` - Hex color code for party branding
- `bio` - Party description/platform
- `leaderId` - User ID of party leader
- `politicalLeaning` - Political ideology
- `leaning` - Specific political position
- `logo` - Logo filename
- `discord` - Discord invite link
- `memberCount` - Total number of party members
- `members` - Array of member objects (only in specific party query)

---

### Get Bills

Retrieve information about bills in the legislative process.

#### Get All Bills (Grouped by Stage)

```
GET /api/bot?endpoint=bills
```

**Response:**

```json
{
  "House": [
    {
      "id": 1,
      "status": "Voting",
      "stage": "House",
      "title": "Infrastructure Investment Act",
      "creatorId": 5,
      "content": "A comprehensive bill to improve national infrastructure...",
      "createdAt": "2026-02-01T10:30:00.000Z",
      "pool": 1,
      "creatorUsername": "john_doe"
    }
  ],
  "Senate": [
    {
      "id": 2,
      "status": "Voting",
      "stage": "Senate",
      "title": "Healthcare Reform Bill",
      "creatorId": 12,
      "content": "Reforms to the national healthcare system...",
      "createdAt": "2026-01-28T14:20:00.000Z",
      "pool": 1,
      "creatorUsername": "jane_smith"
    }
  ],
  "Presidency": [
    {
      "id": 3,
      "status": "Awaiting Signature",
      "stage": "Presidency",
      "title": "Education Funding Act",
      "creatorId": 8,
      "content": "Increases funding for public education...",
      "createdAt": "2026-01-25T09:15:00.000Z",
      "pool": 1,
      "creatorUsername": "alex_johnson"
    }
  ]
}
```

#### Get Bills by Stage

```
GET /api/bot?endpoint=bills&stage=House
```

**Parameters:**

- `stage` (string) - Legislative stage (`House`, `Senate`, or `Presidency`)

**Response:**

```json
[
  {
    "id": 1,
    "status": "Voting",
    "stage": "House",
    "title": "Infrastructure Investment Act",
    "creatorId": 5,
    "content": "A comprehensive bill to improve national infrastructure...",
    "createdAt": "2026-02-01T10:30:00.000Z",
    "pool": 1,
    "creatorUsername": "john_doe"
  }
]
```

#### Get Bills by Stage and Status

```
GET /api/bot?endpoint=bills&stage=House&status=Voting
```

**Parameters:**

- `stage` (string, optional) - Legislative stage (`House`, `Senate`, or `Presidency`)
- `status` (string, optional) - Bill status (e.g., `Queued`, `Voting`, `Awaiting Signature`)

Both parameters can be used independently or together to filter bills.

**Response:**

```json
[
  {
    "id": 1,
    "status": "Voting",
    "stage": "House",
    "title": "Infrastructure Investment Act",
    "creatorId": 5,
    "content": "A comprehensive bill to improve national infrastructure...",
    "createdAt": "2026-02-01T10:30:00.000Z",
    "pool": 1,
    "creatorUsername": "john_doe"
  }
]
```

**Bill Fields:**

- `id` - Unique bill identifier
- `status` - Current status (`Queued`, `Voting`, `Awaiting Signature`, etc.)
- `stage` - Legislative stage (`House`, `Senate`, `Presidency`)
- `title` - Bill title
- `creatorId` - ID of user who created the bill
- `content` - Full text of the bill
- `createdAt` - Timestamp of bill creation
- `pool` - Bill pool number
- `creatorUsername` - Username of bill creator

---

### Get Candidates

Retrieve information about election candidates with their vote counts and campaign statistics.

#### Get All Candidates

```
GET /api/bot?endpoint=candidates
```

**Response:**

```json
[
  {
    "id": 15,
    "userId": 42,
    "username": "john_doe",
    "election": "President",
    "votes": 1250,
    "donations": 50000,
    "votesPerHour": 45,
    "donationsPerHour": 1200,
    "partyId": 5,
    "partyName": "Progressive Party",
    "partyColor": "#3B82F6"
  },
  {
    "id": 22,
    "userId": 38,
    "username": "jane_smith",
    "election": "Senate",
    "votes": 890,
    "donations": 35000,
    "votesPerHour": 32,
    "donationsPerHour": 950,
    "partyId": null,
    "partyName": null,
    "partyColor": null
  }
]
```

#### Get Candidates for Specific Election

```
GET /api/bot?endpoint=candidates&election=President
```

**Parameters:**

- `election` (string) - Election type (`President`, `Senate`, or `House`)

**Response:**

```json
[
  {
    "id": 15,
    "userId": 42,
    "username": "john_doe",
    "election": "President",
    "votes": 1250,
    "donations": 50000,
    "votesPerHour": 45,
    "donationsPerHour": 1200,
    "partyId": 5,
    "partyName": "Progressive Party",
    "partyColor": "#3B82F6"
  },
  {
    "id": 16,
    "userId": 38,
    "username": "jane_smith",
    "election": "President",
    "votes": 980,
    "donations": 42000,
    "votesPerHour": 38,
    "donationsPerHour": 1100,
    "partyId": null,
    "partyName": null,
    "partyColor": null
  }
]
```

**Candidate Fields:**

- `id` - Candidate ID
- `userId` - User ID of the candidate
- `username` - Candidate's username
- `election` - Election type (`President`, `Senate`, `House`)
- `votes` - Current vote count
- `donations` - Total campaign donations received
- `votesPerHour` - Rate of votes gained per hour
- `donationsPerHour` - Rate of donations gained per hour
- `partyId` - ID of candidate's party (null if independent)
- `partyName` - Name of candidate's party (null if independent)
- `partyColor` - Hex color of candidate's party (null if independent)

Candidates are sorted by vote count in descending order (highest votes first).

---

### Get Game State

Retrieve current election states for game update posts. When elections are in `Voting` or `Concluded` status, candidate information with vote counts is included.

```
GET /api/bot?endpoint=game-state
```

**Response (with candidates for Voting/Concluded elections):**

```json
[
  {
    "election": "President",
    "status": "Voting",
    "seats": null,
    "daysLeft": 3,
    "candidates": [
      {
        "id": 15,
        "userId": 42,
        "username": "john_doe",
        "election": "President",
        "votes": 1250,
        "donations": 50000,
        "partyId": 5,
        "partyName": "Progressive Party",
        "partyColor": "#3B82F6"
      },
      {
        "id": 16,
        "userId": 38,
        "username": "jane_smith",
        "election": "President",
        "votes": 980,
        "donations": 42000,
        "partyId": null,
        "partyName": null,
        "partyColor": null
      }
    ]
  },
  {
    "election": "Senate",
    "status": "Candidate",
    "seats": 10,
    "daysLeft": 5
  }
]
```

**Election State Fields:**

- `election` - Election type (`President`, `Senate`, `House`)
- `status` - Current phase (`Candidate`, `Voting`, `Concluded`, etc.)
- `seats` - Number of available seats (primarily for Senate)
- `daysLeft` - Days remaining in current phase
- `candidates` - Array of candidate objects (only present when status is `Voting` or `Concluded`)

**Candidate Fields (when included):**

- `id` - Candidate ID
- `userId` - User ID of the candidate
- `username` - Candidate's username
- `election` - Election type
- `votes` - Current vote count
- `donations` - Total campaign donations received
- `partyId` - ID of candidate's party (null if independent)
- `partyName` - Name of candidate's party (null if independent)
- `partyColor` - Hex color of candidate's party (null if independent)

Candidates are sorted by vote count in descending order (highest votes first).

---

## Error Responses

### Invalid Endpoint

```json
{
  "error": "Invalid endpoint",
  "available": ["users", "parties", "game-state"],
  "usage": {
    "users": "/api/bot?endpoint=users or /api/bot?endpoint=users&id=1",
    "parties": "/api/bot?endpoint=parties or /api/bot?endpoint=parties&id=1",
    "gameState": "/api/bot?endpoint=game-state"
  }
}
```

### Invalid ID

```json
{
  "error": "Invalid user ID"
}
```

### Invalid Stage

```json
{
  "error": "Invalid stage",
  "validStages": ["House", "Senate", "Presidency"]
}
```

### Invalid Election

```json
{
  "error": "Invalid election type",
  "validElections": ["President", "Senate", "House"]
}
```

### Not Found

```json
{
  "error": "User not found"
}
```

### Server Error

```json
{
  "error": "Internal server error",
  "message": "Detailed error message"
}
```

## Status Codes

- `200` - Success
- `400` - Bad request (invalid endpoint or ID)
- `404` - Resource not found
- `500` - Internal server error

## Rate Limiting

Currently no rate limiting is implemented. Please be respectful with request frequency.

## Examples

### Get All Active Users

```bash
curl "https://democracyonline.io/api/bot?endpoint=users"
```

### Get Specific Party with Members

```bash
curl "https://democracyonline.io/api/bot?endpoint=parties&id=5"
```

### Get Current Election Status

```bash
curl "https://democracyonline.io/api/bot?endpoint=game-state"
```

### Get All Bills

```bash
curl "https://democracyonline.io/api/bot?endpoint=bills"
```

### Get Bills in House

```bash
curl "https://democracyonline.io/api/bot?endpoint=bills&stage=House"
```

### Get Bills in House that are Voting

```bash
curl "https://democracyonline.io/api/bot?endpoint=bills&stage=House&status=Voting"
```

### Get All Bills with Voting Status

```bash
curl "https://democracyonline.io/api/bot?endpoint=bills&status=Voting"
```

### Get Presidential Candidates

```bash
curl "https://democracyonline.io/api/bot?endpoint=candidates&election=President"
```

### Get All Candidates

```bash
curl "https://democracyonline.io/api/bot?endpoint=candidates"
```

## Use Cases

### Game Update Posts

Use `game-state` endpoint to generate daily game update messages showing election progress.

### User Profiles

Use `users` endpoint with ID to display detailed user information in Discord.

### Party Information

Use `parties` endpoint to show party details, member lists, and recruitment information.

### Legislative Tracking

Use `bills` endpoint to track bills moving through the legislative process and display voting information.

### Election Results

Use `candidates` endpoint to display election leaderboards and track campaign progress with real-time vote and donation statistics.

## Implementation

The Bot API is implemented in `/src/routes/api/bot.ts` using TanStack Start server routes with direct database queries via Drizzle ORM.
