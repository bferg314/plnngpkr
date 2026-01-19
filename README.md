# plnngpkr

A real-time story estimation app for agile teams to collaboratively estimate stories during sprint planning.

## Features

- **Real-time Voting** - Synchronized voting across all participants using Socket.io
- **Multiple Deck Types** - Fibonacci, T-shirt sizes, Powers of 2, Sequential, and custom decks
- **Story Management** - Add, edit, delete, and reorder stories with drag-and-drop
- **Bulk Import** - Import multiple stories at once from text
- **Voting Statistics** - View average, median, mode, and consensus after reveal
- **Results Memory** - Story voting results are cached and recalled when re-selected
- **Timer** - Optional countdown timer for time-boxed voting
- **Chat** - Built-in chat for team communication
- **Spectator Mode** - Allow observers to watch without voting
- **Moderator Controls** - Reveal votes, reset, kick participants, promote moderators, set final estimates
- **Color Themes** - Customizable accent colors and dark/light mode support
- **Self-hosted** - Docker support for easy deployment

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

## Getting Started

### Prerequisites

- Node.js 20+
- npm, yarn, pnpm, or bun
- PostgreSQL (or use Docker)

### Local Development

```bash
# Install dependencies
npm install

# Copy environment file and configure
cp .env.example .env

# Start development server (Next.js + Socket.io)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Docker Deployment

#### Development

```bash
docker-compose -f docker-compose.dev.yml up
```

#### Production

```bash
# Create .env file with your configuration
cp .env.example .env
# Edit .env with your production values

# Build and start
docker-compose up -d --build
```

## Environment Variables

Copy `.env.example` to `.env` and configure:

| Variable | Description | Example |
|----------|-------------|---------|
| `POSTGRES_USER` | Database username | `plnngpkr` |
| `POSTGRES_PASSWORD` | Database password | `your_secure_password` |
| `POSTGRES_DB` | Database name | `plnngpkr` |
| `DATABASE_URL` | Full connection string | `postgresql://user:pass@host:5432/db` |
| `NODE_ENV` | Environment mode | `production` |
| `PORT` | Server port | `3000` |
| `NEXT_PUBLIC_APP_URL` | Public URL for the app | `https://your-domain.com` |

## Reverse Proxy Configuration

When deploying behind a reverse proxy (nginx, Traefik, Caddy, etc.), ensure WebSocket support is enabled.

### Nginx Example

```nginx
location / {
    proxy_pass http://localhost:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 86400;
}
```

### Nginx Proxy Manager

Enable "Websockets Support" in the proxy host settings.

## Project Structure

```
src/
  app/                    # Next.js App Router pages
    api/                  # API routes
    create/               # Room creation page
    room/[roomId]/        # Voting room page
  components/
    room/voting/          # Voting components (EstimateCard, CardDeck)
    ui/                   # shadcn/ui components
  hooks/                  # Custom hooks (useSocket)
  lib/
    constants/            # Deck configurations
    db/                   # Database schema and connection
    utils/                # Utility functions (statistics, cn)
  stores/                 # Zustand stores (roomStore, settingsStore)
  types/                  # TypeScript type definitions

server/                   # Socket.io server
  index.ts                # HTTP server setup
  socket.ts               # WebSocket event handlers
  rooms.ts                # In-memory room state management
```

## How It Works

1. **Create a Room** - A moderator creates a room with their preferred deck type
2. **Share the Link** - Team members join via the room link
3. **Add Stories** - Moderator adds stories to estimate (or imports in bulk)
4. **Vote** - All participants select their estimates simultaneously
5. **Reveal** - Moderator reveals votes to see results and statistics
6. **Discuss & Finalize** - Team discusses and moderator sets the final estimate
7. **Next Story** - Move to the next story and repeat

## Development Commands

```bash
npm run dev          # Start development server (Next.js + Socket.io)
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
```

## License

MIT
