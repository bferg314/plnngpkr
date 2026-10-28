# plnngpkr

A real-time story estimation app for agile teams to estimate stories collaboratively.

## Tech Stack

- **Framework:** Next.js 16 (App Router) with React 19
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **UI Components:** Radix UI (via shadcn/ui)
- **Animations:** Framer Motion
- **State Management:** Zustand
- **Real-time:** Socket.io (client and server)
- **Database:** Drizzle ORM with PostgreSQL
- **Icons:** Lucide React
- **Notifications:** Sonner

## Project Structure

```
src/
  app/                    # Next.js App Router pages
    api/                  # API routes
    create/               # Room creation page
    room/[roomId]/        # Voting room page
  components/
    room/voting/          # Voting-related components (EstimateCard, CardDeck)
    ui/                   # shadcn/ui components
  hooks/                  # Custom hooks (useSocket)
  lib/
    constants/            # Deck configurations
    db/                   # Database schema and connection
    utils/                # Utility functions (statistics, cn)
  stores/                 # Zustand stores (roomStore)
  types/                  # TypeScript type definitions

server/                   # Socket.io server
  index.ts                # HTTP server setup; runs migrations before listening
  migrate.ts              # Applies drizzle/migrations on start
  socket.ts               # Socket event handlers
  rooms.ts                # Room state (in memory) with Postgres write-behind and cleanup
  rateLimit.ts            # Rate limits for socket events and POST /api/rooms
  __tests__/              # Room state, rate limit and database tests
    helpers/              # Test server and Socket.IO client helpers

drizzle/migrations/       # Generated SQL migrations (committed)
```

## Key Files

- `src/app/room/[roomId]/page.tsx` - Main voting room UI
- `src/stores/roomStore.ts` - Client-side state management
- `src/components/room/voting/EstimateCard.tsx` - Card components (EstimateCard, VoteCard)
- `src/components/room/voting/CardDeck.tsx` - Card selection deck
- `src/hooks/useSocket.ts` - Socket.io connection management
- `server/socket.ts` - Server-side event handling
- `server/rooms.ts` - Room state and participant management
- `server/migrate.ts` - Database migrations run on server start
- `src/lib/db/schema.ts` - Drizzle schema (rooms, stories, vote_history)
- `.github/workflows/test-and-deploy.yml` - CI tests and deploy

## Development Commands

```bash
npm run dev          # Start development server (Next.js + Socket.io)
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npm test             # Run unit tests (statistics, room state, rate limits)
                     # Database tests run only with DATABASE_URL set, e.g.
                     # createdb plnngpkr_test && DATABASE_URL=postgres:///plnngpkr_test npm test
npm run db:generate  # Generate a migration after changing the schema
```

## Architecture Notes

- Real-time communication uses Socket.io for bi-directional events
- Active room state lives in memory on the server. Empty rooms are dropped from memory after 1 hour
- With `DATABASE_URL` set, rooms, stories, and vote history are also written to PostgreSQL via Drizzle ORM. Writes are non-blocking; a failed write logs a warning and the room keeps working. A room not in memory is reloaded from the database
- Without `DATABASE_URL`, the app runs in memory only and nothing is persisted
- Rooms are deleted from the database after `ROOM_RETENTION_DAYS` (default 30) without activity. Activity is the room's `updated_at` (bumped when the room is loaded and when it leaves memory), a story created or estimated, or a vote recorded. The cleanup runs on start and hourly, skips rooms in memory, and cascades to stories and vote history
- Socket events are rate limited per socket (join, chat, vote/clearVote, and everything else in a shared bucket) and joins also per IP; dropped events get one `rateLimited` notice, which the client shows as a toast. `POST /api/rooms` is limited per IP in `server/index.ts` before Next.js and answers 429 with `Retry-After`. Limits live in `LIMITS` in `server/rateLimit.ts`. The client IP is the last `X-Forwarded-For` entry (production runs behind a tunnel) unless `TRUST_PROXY=false`
- On start, `server/migrate.ts` applies pending migrations from `drizzle/migrations`. A failed migration stops the server
- Client state is managed via Zustand with selectors for derived state
- Stories store their voting results via `finalEstimate` and `status` fields
- Stories also cache their last votes and stats (`cachedVotes`, `cachedStats`) for recall when re-selected

## Schema Changes

1. Edit `src/lib/db/schema.ts`
2. Run `npm run db:generate` and commit the new files in `drizzle/migrations`

CI fails if the schema and the committed migrations don't match.

## CI and Deploy

`.github/workflows/test-and-deploy.yml` runs on every pull request and every push to `main`: `npm ci`, lint, `tsc --noEmit`, `npm test`, the migration check, and `npm run build`. When a push to `main` passes, it asks `bferg314/deploys` to deploy that commit.

## Releases

Release tags (`vX.Y.Z`) are the source of truth for the version. Bump `version` in `package.json` to match before tagging. Pushing a tag runs `.github/workflows/publish.yml`, which publishes the Docker image to `ghcr.io/bferg314/plnngpkr`.
