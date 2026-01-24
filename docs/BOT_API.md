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

### Get Game State

Retrieve current election states for game update posts.

```
GET /api/bot?endpoint=game-state
```

**Response:**

```json
[
  {
    "election": "President",
    "status": "Voting",
    "seats": null,
    "daysLeft": 3
  },
  {
    "election": "Senate",
    "status": "Candidacy",
    "seats": 10,
    "daysLeft": 5
  },
  {
    "election": "House",
    "status": "Results",
    "seats": null,
    "daysLeft": 0
  }
]
```

**Election State Fields:**

- `election` - Election type (`President`, `Senate`, `House`)
- `status` - Current phase (`Candidacy`, `Voting`, `Results`, etc.)
- `seats` - Number of available seats (primarily for Senate)
- `daysLeft` - Days remaining in current phase

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

## Use Cases

### Game Update Posts

Use `game-state` endpoint to generate daily game update messages showing election progress.

### User Profiles

Use `users` endpoint with ID to display detailed user information in Discord.

### Party Information

Use `parties` endpoint to show party details, member lists, and recruitment information.

## Implementation

The Bot API is implemented in `/src/routes/api/bot.ts` using TanStack Start server routes with direct database queries via Drizzle ORM.
