# Democracy Online - Technical Documentation

## Project Overview

Democracy Online is a full-stack web application that simulates an online democratic government system. Users can form political parties, propose and vote on legislation, participate in elections, and engage in the democratic process through a modern, interactive platform.

## Technology Stack

### Frontend

- **Framework**: [TanStack Start](https://tanstack.com/start) (React-based meta-framework)
- **Routing**: [TanStack Router](https://tanstack.com/router) v1.132.0
  - Type-safe routing
  - File-based routing
  - Data loading integration
- **State Management**:
  - [TanStack Query](https://tanstack.com/query) v5.66.5 (server state)
  - React Context API (client state)
- **Forms**: [TanStack Form](https://tanstack.com/form) v1.0.0
- **UI Components**: [shadcn/ui](https://ui.shadcn.com/)
  - Built on Radix UI primitives
  - Tailwind CSS styling
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) v4.0.6
- **Icons**: [Lucide React](https://lucide.dev/)
- **Language**: TypeScript

### Backend

- **Runtime**: [Nitro](https://nitro.unjs.io/) (Universal JavaScript server)
- **Database**: PostgreSQL
- **ORM**: [Drizzle ORM](https://orm.drizzle.team/) v0.39.0
  - Type-safe queries
  - Schema migrations
  - Relational query builder
- **Authentication**: [Firebase Authentication](https://firebase.google.com/docs/auth)
  - Email/password authentication
  - Firebase Admin SDK for server-side verification
- **API**: [TanStack Start Server Functions](https://tanstack.com/start/latest/docs/server-functions)
  - Type-safe client-server communication
  - Automatic serialization

### Development Tools

- **Build Tool**: [Vite](https://vitejs.dev/)
- **Package Manager**: pnpm
- **Linting**: ESLint with [TanStack Config](https://tanstack.com/config)
- **Formatting**: Prettier
- **Testing**: [Vitest](https://vitest.dev/)
- **Environment Variables**: [T3 Env](https://env.t3.gg/) for type-safe env validation

## Project Structure

```
democracy-online/
├── src/
│   ├── components/          # Reusable UI components
│   │   ├── auth/           # Authentication components
│   │   └── ui/             # shadcn/ui components
│   ├── db/                 # Database configuration and schema
│   │   ├── index.ts        # Drizzle client initialization
│   │   └── schema.ts       # Database schema definitions
│   ├── hooks/              # Custom React hooks
│   ├── integrations/       # Third-party integrations
│   │   └── tanstack-query/ # TanStack Query setup
│   ├── lib/                # Utility functions and shared logic
│   │   ├── auth-context.tsx    # Authentication context provider
│   │   ├── firebase.ts         # Firebase initialization
│   │   ├── middleware/         # Server middleware
│   │   ├── schemas/            # Zod validation schemas
│   │   ├── server/             # Server functions
│   │   │   ├── bills.ts        # Bill-related server logic
│   │   │   ├── party.ts        # Party-related server logic
│   │   │   ├── party-merge.ts  # Party merging logic
│   │   │   ├── theme.ts        # Theme management
│   │   │   └── users.ts        # User management
│   │   └── utils/              # Utility functions
│   ├── routes/             # File-based routing (TanStack Router)
│   │   ├── __root.tsx      # Root layout
│   │   ├── index.tsx       # Home page
│   │   ├── bills.tsx       # Bills listing
│   │   ├── login.tsx       # Login page
│   │   ├── signup.tsx      # Signup page
│   │   ├── profile.tsx     # User profile
│   │   ├── api/            # API routes
│   │   └── parties/        # Party-related routes
│   ├── scripts/            # Utility scripts
│   │   └── postgres.sh     # Database startup script
│   ├── env.ts              # Environment variable validation
│   ├── router.tsx          # Router configuration
│   ├── routeTree.gen.ts    # Generated route tree
│   └── styles.css          # Global styles and CSS variables
├── docs/                   # Documentation
│   ├── features/           # Feature-specific documentation
│   ├── CI_CD.md           # CI/CD documentation
│   └── FIREBASE_AUTH.md   # Firebase setup guide
├── public/                 # Static assets
├── drizzle.config.ts      # Drizzle ORM configuration
├── components.json        # shadcn/ui configuration
├── package.json           # Dependencies and scripts
├── tsconfig.json          # TypeScript configuration
└── vite.config.ts         # Vite configuration
```

## Architecture

### Full-Stack React with TanStack Start

The application uses TanStack Start, a modern React meta-framework that enables:

- Server-side rendering (SSR)
- API routes alongside React components
- Server functions for type-safe client-server communication
- File-based routing with TanStack Router

### Data Flow

```
User Action → React Component → TanStack Query Mutation
                                        ↓
                                Server Function (src/lib/server/)
                                        ↓
                                Drizzle ORM Query
                                        ↓
                                PostgreSQL Database
                                        ↓
                                Response → TanStack Query Cache
                                        ↓
                                React Component Re-render
```

### Server Functions

Server functions provide type-safe, zero-config API endpoints:

```typescript
// Define server function
export const getParties = createServerFn().handler(async () => {
  return await db.select().from(parties)
})

// Call from client
const { data } = useQuery({
  queryKey: ['parties'],
  queryFn: () => getParties(),
})
```

Benefits:

- Full TypeScript type safety
- No manual API route definition
- Automatic serialization/deserialization
- Built-in error handling

### Authentication Flow

1. **Client-side**: Firebase Authentication manages user sessions
2. **Context Provider**: `AuthProvider` wraps app, provides auth state
3. **Protected Routes**: Routes check auth state, redirect if needed
4. **Server-side**: Firebase Admin SDK verifies tokens on server
5. **Database Sync**: User data stored in PostgreSQL for app features

### Database Schema

The application uses a relational PostgreSQL database with the following main entities:

- **Users**: User accounts, profiles, and authentication data
- **Parties**: Political party information and leadership
- **Party Stances**: Political positions on various issues
- **Merge Requests**: Party merger proposals and negotiations
- **Bills**: Legislative proposals and content
- **Bill Votes**: Votes on bills at different legislative stages
- **Elections**: Electoral contests for government positions
- **Candidates**: Users running in elections
- **Votes**: Electoral votes cast by users
- **Chats**: In-app messaging system
- **Feed**: Activity feed for site-wide announcements

See [src/db/schema.ts](../src/db/schema.ts) for complete schema definitions.

### State Management Strategy

**Server State** (TanStack Query):

- Data from database (parties, bills, users)
- Cached client-side
- Automatic background refetching
- Optimistic updates for mutations

**Client State** (React Context/useState):

- Authentication state
- Theme preferences
- UI state (modals, sidebars)
- Form state (TanStack Form)

**Persistent State**:

- localStorage: Theme preferences
- Firebase: Authentication tokens
- Database: User data, preferences

## Key Features

### 1. Authentication

[Detailed Documentation](features/authentication.md)

- Firebase email/password authentication
- Protected routes
- User registration and login
- Session management

### 2. Political Parties

[Detailed Documentation](features/political-parties.md)

- Create and manage political parties
- Join parties and collaborate with members
- Define party platforms and political stances
- Party leadership and governance

### 3. Party Merging

[Detailed Documentation](features/party-merging.md)

- Propose mergers between multiple parties
- Negotiate terms of merged party
- Multi-party approval process
- Automatic member migration

### 4. Legislative System

[Detailed Documentation](features/legislative-system.md)

- Propose bills
- Three-stage voting (House, Senate, Presidential)
- Track bill progress through legislative process
- Vote counting and bill advancement

### 5. Elections System

[Detailed Documentation](features/elections-system.md)

- Declare candidacy for government positions
- Ranked-choice voting
- Multiple election types (House, Senate, Presidential)
- Automatic role assignment for winners

### 6. Theme System

[Detailed Documentation](features/theme-system.md)

- Dark/light mode support
- System preference detection
- Persistent user preferences
- Smooth theme transitions

## Development Workflow

### Setup

```bash
# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env.local
# Fill in your Firebase credentials and database URL

# Generate database schema
pnpm db:generate

# Push schema to database
pnpm db:push
```

### Development Server

```bash
# Start development server
pnpm dev

# Or use VS Code task
# Run task: "Start Dev Server (Unix/macOS)"
```

This starts:

- Next.js development server on port 3000
- PostgreSQL database (via Docker or local instance)

### Database Management

```bash
# Generate migration
pnpm db:generate

# Apply migrations
pnpm db:migrate

# Push schema changes directly (dev)
pnpm db:push

# Open Drizzle Studio (database GUI)
pnpm db:studio
```

### Code Quality

```bash
# Run linter
pnpm lint

# Format code
pnpm format

# Check and fix all issues
pnpm check

# Run tests
pnpm test
```

### Build for Production

```bash
# Build application
pnpm build

# Preview production build
pnpm preview
```

## Environment Variables

Required environment variables (define in `.env.local`):

```bash
# Firebase Configuration
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/democracy

# Optional
NODE_ENV=development
```

See [docs/FIREBASE_AUTH.md](FIREBASE_AUTH.md) for Firebase setup instructions.

## API Design

### Server Functions

All server-side logic is organized into domain-specific modules:

- `src/lib/server/bills.ts` - Bill creation, voting, advancement
- `src/lib/server/party.ts` - Party CRUD operations
- `src/lib/server/party-merge.ts` - Party merger logic
- `src/lib/server/users.ts` - User management
- `src/lib/server/theme.ts` - Theme preferences

### Validation

All server functions validate input using Zod schemas:

```typescript
import { CreatePartySchema } from '@/lib/schemas/party-schema'

export const createParty = createServerFn()
  .inputValidator(CreatePartySchema)
  .handler(async ({ data }) => {
    // data is fully typed and validated
    return await db.insert(parties).values(data)
  })
```

## Security Considerations

1. **Authentication**: Firebase handles secure authentication
2. **Authorization**: Server functions validate user permissions
3. **Input Validation**: Zod schemas validate all inputs
4. **SQL Injection**: Drizzle ORM uses parameterized queries
5. **XSS Prevention**: React escapes output by default
6. **CSRF**: TanStack Start includes CSRF protection
7. **Environment Variables**: Sensitive data in env vars, never committed

## Performance Optimizations

1. **Code Splitting**: Route-based automatic code splitting
2. **SSR**: Initial page load server-rendered
3. **Query Caching**: TanStack Query caches all server data
4. **Optimistic Updates**: UI updates before server confirmation
5. **Database Indexes**: Strategic indexes on frequently queried fields
6. **Connection Pooling**: Database connection pooling via Drizzle
7. **Image Optimization**: Static assets optimized by Vite

## Testing Strategy

- **Unit Tests**: Vitest for utility functions and business logic
- **Integration Tests**: API route testing with Vitest
- **Component Tests**: React component testing with React Testing Library
- **E2E Tests**: Playwright for critical user flows (future)

## Deployment

See [docs/CI_CD.md](CI_CD.md) for CI/CD pipeline documentation.

Typical deployment flow:

1. Push to `develop` branch
2. CI runs tests and linting
3. Build application
4. Run database migrations
5. Deploy to staging environment
6. Manual approval
7. Deploy to production

## Contributing

1. Create feature branch from `develop`
2. Implement feature with tests
3. Run `pnpm check` to ensure code quality
4. Submit pull request to `develop`
5. Address code review feedback
6. Merge after approval

## Troubleshooting

### Database Connection Issues

```bash
# Check if PostgreSQL is running
pg_isready

# Restart PostgreSQL (macOS)
brew services restart postgresql

# Check connection string in .env.local
echo $DATABASE_URL
```

### Firebase Authentication Errors

- Verify all Firebase env vars are set correctly
- Check Firebase console for API key restrictions
- Ensure email/password auth is enabled in Firebase

### Build Errors

```bash
# Clear build cache
rm -rf .tanstack node_modules/.vite

# Reinstall dependencies
pnpm install

# Rebuild
pnpm build
```

## Resources

- [TanStack Start Documentation](https://tanstack.com/start)
- [TanStack Router Documentation](https://tanstack.com/router)
- [TanStack Query Documentation](https://tanstack.com/query)
- [Drizzle ORM Documentation](https://orm.drizzle.team/)
- [Firebase Authentication Documentation](https://firebase.google.com/docs/auth)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)

## License

[Add your license information here]

## Support

For questions or issues, please [open an issue](https://github.com/ajstrongdev/onlinedemocraticrepublic/issues) on GitHub.
