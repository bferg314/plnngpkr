# plnngpkr

A real-time story estimation app for agile teams to collaboratively estimate stories.

## Features

- **Real-time Voting** - Synchronized voting across all participants using Socket.io
- **Multiple Deck Types** - Fibonacci, T-shirt sizes, Powers of 2, Sequential, and custom decks
- **Story Management** - Add, edit, delete, and reorder stories
- **Voting Statistics** - View average, median, mode, and consensus after reveal
- **Results Memory** - Story voting results are cached and recalled when re-selected
- **Timer** - Optional countdown timer for time-boxed voting
- **Chat** - Built-in chat for team communication
- **Spectator Mode** - Allow observers to watch without voting
- **Moderator Controls** - Reveal votes, reset, set final estimates
- **Dark Mode** - Theme support via next-themes
- **Self-hosted** - Docker support for easy deployment

## Tech Stack

- **Frontend:** Next.js 16, React 19, TypeScript, Tailwind CSS
- **UI Components:** Radix UI / shadcn/ui
- **Animations:** Framer Motion
- **State:** Zustand
- **Real-time:** Socket.io
- **Database:** Drizzle ORM + PostgreSQL

## Getting Started

### Prerequisites

- Node.js 18+
- npm, yarn, pnpm, or bun

### Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Docker

```bash
# Development
docker-compose -f docker-compose.dev.yml up

# Production
docker-compose up
```

## Environment Variables

Copy `.env.example` to `.env` and configure:

```env
DATABASE_URL=postgresql://...
```

## Project Structure

```
src/
  app/                    # Next.js App Router pages
  components/             # React components
    room/voting/          # Voting card components
    ui/                   # shadcn/ui components
  hooks/                  # Custom hooks
  lib/                    # Utilities and constants
  stores/                 # Zustand stores
  types/                  # TypeScript types

server/                   # Socket.io server
  socket.ts               # WebSocket event handlers
  rooms.ts                # Room state management
```

## License

MIT
