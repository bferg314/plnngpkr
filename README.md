<div align="center">

<img src="src/app/icon.svg" alt="plnngpkr logo" width="64" height="64" />

# plnngpkr

**Fast, real-time Agile Planning Poker for engineering teams.**  
No signups. No paywalls. Share a link and start estimating stories in seconds.

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-149eca?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript)](https://www.typescriptlang.org/)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-4.8-010101?logo=socket.io)](https://socket.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?logo=postgresql)](https://www.postgresql.org/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ed?logo=docker)](https://www.docker.com/)
[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](./LICENSE)

[**Features**](#-features) • [**Quick Start**](#-quick-start) • [**Docker Deployment**](#-docker-deployment) • [**Configuration**](#%EF%B8%8F-configuration) • [**Architecture**](#-architecture)

</div>

---

## 📸 Preview

<div align="center">
  <img src="public/screenshot.png" alt="plnngpkr live estimation room" width="100%" />
</div>

---

## ✨ Features

| Category | Capabilities |
| :--- | :--- |
| **🃏 Real-Time Voting** | Instant bi-directional sync via **Socket.IO**. Unrevealed votes are redacted server-side until reveal so votes remain strictly private. Click a selected card again to unvote. |
| **📚 Flexible Card Decks** | Built-in **Fibonacci**, **Mini Fibonacci**, **T-Shirt Sizes**, **Powers of 2**, **Sequential**, plus an interactive **Custom Deck Builder**. |
| **📋 Story Management** | Add stories with descriptions, **bulk-import** multi-line backlogs, **edit**, **delete**, **reorder**, and **export** completed estimates as **CSV** or **JSON**. |
| **📊 Instant Analytics** | Automatically computes **Average**, **Median**, **Most Common (Mode)**, **Spread**, and **Consensus** indicators on reveal. |
| **🧠 Results Memory** | Switching back to a previously estimated story automatically recalls its historical votes and statistics. |
| **👑 Moderator Controls** | Reveal/reset votes, lock in final estimates across the full deck, run a **countdown timer** (start/pause/resume/reset), **promote moderators**, **remove participants**, and adjust room settings live. |
| **👀 Spectator Mode** | Product owners, scrum masters, and stakeholders can observe sessions in real time without affecting vote tallies. |
| **💬 Built-In Chat** | Real-time room chat with system activity logs (joins, reconnections, moderator changes) and unread message badges. |
| **🎨 Custom Themes** | Light, Dark, and System modes paired with **7 customizable accent color themes**. |
| **💾 Hybrid Persistence** | Works out-of-the-box with zero-config in-memory state (with a 1-hour empty-room TTL grace period) **or** persists rooms, stories, and vote history to **PostgreSQL** via **Drizzle ORM**. |

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** 20+
- **npm** (or pnpm / yarn / bun)
- **PostgreSQL 16+** *(optional — falls back to in-memory storage automatically if `DATABASE_URL` is omitted)*

### Local Development

```bash
# 1. Clone the repository
git clone https://github.com/bferg314/plnngpkr.git
cd plnngpkr

# 2. Install dependencies
npm install

# 3. Configure environment variables (optional for in-memory mode)
cp .env.example .env

# 4. Start the Next.js + Socket.IO development server
npm run dev
```

Open **[http://localhost:3000](http://localhost:3000)** in your browser.

---

## 🐳 Docker Deployment

`plnngpkr` ships with three Docker Compose configurations tailored for different workflows:

### 1. Local Development with Hot-Reload (`docker-compose.dev.yml`)
Mounts your local source tree for live reloading and spins up a local PostgreSQL 16 container with default credentials:

```bash
docker compose -f docker-compose.dev.yml up --build

# (First time only) Push the Drizzle schema to the dev Postgres container
docker exec -it plnngpkr-app-dev npm run db:push
```

### 2. Local Production Build (`docker-compose.yml`)
Builds the hardened multi-stage production `Dockerfile` locally alongside PostgreSQL 16:

```bash
cp .env.example .env
# Edit .env with yourPOSTGRES_PASSWORD and NEXT_PUBLIC_APP_URL
docker compose up -d --build
```

### 3. Pre-Built Container Registry Deployment (`docker-compose.prod.yml`)
Pulls the official pre-built image (`ghcr.io/bferg314/plnngpkr:latest`) for fast server deployment:

```bash
cp .env.example .env
docker compose -f docker-compose.prod.yml up -d
```

---

## ⚙️ Configuration

Copy `.env.example` to `.env` to customize your environment:

| Variable | Required | Default | Description |
| :--- | :---: | :---: | :--- |
| `PORT` | No | `3000` | HTTP & WebSocket server port |
| `HOSTNAME` | No | `0.0.0.0` | Server bind address |
| `NODE_ENV` | No | `development` | Environment mode (`development` or `production`) |
| `NEXT_PUBLIC_APP_URL` | No | `http://localhost:3000` | Public URL used by clients |
| `DATABASE_URL` | No* | — | PostgreSQL connection URI (`postgresql://user:pass@host:5432/db`). *If omitted, runs in-memory.* |
| `POSTGRES_USER` | Docker | `plnngpkr` | PostgreSQL username for Docker Compose |
| `POSTGRES_PASSWORD` | Docker | — | PostgreSQL password for Docker Compose |
| `POSTGRES_DB` | Docker | `plnngpkr` | PostgreSQL database name for Docker Compose |

---

## 🌐 Reverse Proxy Setup

When hosting behind a reverse proxy, ensure **WebSocket (`Upgrade`)** headers are forwarded for `/socket.io`.

<details>
<summary><strong>Nginx Configuration</strong></summary>

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
</details>

<details>
<summary><strong>Caddy Configuration</strong></summary>

```caddyfile
poker.yourdomain.com {
    reverse_proxy localhost:3000
}
```
</details>

---

## 🏗️ Architecture

```text
plnngpkr/
├── server/
│   ├── index.ts                # Custom Node HTTP server + Next.js + Socket.IO bootstrap
│   ├── socket.ts               # WebSocket event handlers & moderator authorization
│   ├── rooms.ts                # Room state engine, vote redaction, TTL, & DB write-behind
│   └── __tests__/              # Server & room state unit tests
├── src/
│   ├── app/
│   │   ├── api/                # REST endpoints (/api/health, /api/rooms, /api/rooms/[id]/export)
│   │   ├── create/             # Session & custom deck configuration UI
│   │   ├── room/[roomId]/      # Main real-time voting room interface
│   │   └── terms/              # Terms of Service page
│   ├── components/
│   │   ├── room/voting/        # 3D flip EstimateCard, VoteCard, and CardDeck components
│   │   ├── ui/                 # Radix UI + Tailwind primitives (shadcn/ui)
│   │   └── settings-dialog.tsx # Theme & live Moderator room settings modal
│   ├── hooks/
│   │   └── useSocket.ts        # Typed Socket.IO client hook & reconnection manager
│   ├── lib/
│   │   ├── constants/decks.ts  # Preset decks & default room settings
│   │   ├── db/                 # Drizzle ORM schema (rooms, stories, vote_history)
│   │   └── utils/statistics.ts # Average, median, mode, consensus & spread calculators
│   └── stores/
│       ├── roomStore.ts        # Zustand store & selectors for room state
│       └── settingsStore.ts    # Persistent client theme preferences
└── Dockerfile                  # Hardened multi-stage Node 20 Alpine build
```

---

## 🛠️ Development Scripts

```bash
npm run dev          # Start development server (Next.js + Socket.IO)
npm run build        # Build Next.js application for production
npm run start        # Start production server (cross-platform)
npm run lint         # Run ESLint static analysis
npm test             # Run unit test suite (statistics & room state engine)
npm run db:generate  # Generate Drizzle SQL migrations
npm run db:push      # Push Drizzle schema directly to PostgreSQL
npm run db:studio    # Open Drizzle Studio database GUI
```

---

## 📄 License

Distributed under the **[GNU Affero General Public License v3.0 or later (AGPL-3.0-or-later)](./LICENSE)**.
