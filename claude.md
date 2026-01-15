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
  index.ts                # HTTP server setup
  socket.ts               # Socket event handlers
  rooms.ts                # In-memory room state management
```

## Key Files

- `src/app/room/[roomId]/page.tsx` - Main voting room UI
- `src/stores/roomStore.ts` - Client-side state management
- `src/components/room/voting/EstimateCard.tsx` - Card components (EstimateCard, VoteCard)
- `src/components/room/voting/CardDeck.tsx` - Card selection deck
- `src/hooks/useSocket.ts` - Socket.io connection management
- `server/socket.ts` - Server-side event handling
- `server/rooms.ts` - Room state and participant management

## Development Commands

```bash
npm run dev          # Start development server (Next.js + Socket.io)
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
```

## Architecture Notes

- Real-time communication uses Socket.io for bi-directional events
- Room state is stored in-memory on the server (not persisted)
- Client state is managed via Zustand with selectors for derived state
- Stories store their voting results via `finalEstimate` and `status` fields
- Stories can also cache historical voting stats for recall when re-selected
