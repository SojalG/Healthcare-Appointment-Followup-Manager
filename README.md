# Healthcare Appointment & Follow-up Manager

A full-stack healthcare appointment management platform with concurrency-safe booking, LLM-powered clinical summaries, background job processing, and Google Calendar integration.

## Tech Stack

- **Frontend:** React + Vite + TypeScript + TailwindCSS v4
- **Backend:** Express 5 + TypeScript
- **Database:** PostgreSQL 16 (via Prisma ORM)
- **Queue/Jobs:** BullMQ + Redis 7
- **Auth:** JWT (access + refresh tokens) + bcrypt
- **LLM:** Anthropic Claude API
- **Calendar:** Google Calendar API v3
- **Email:** Nodemailer (dev: Ethereal, prod: SMTP/SendGrid)

## Quick Start

### Prerequisites
- Node.js ≥ 20
- Docker & Docker Compose
- npm ≥ 10

### 1. Clone & Install
```bash
git clone <repo-url> healthcare-platform
cd healthcare-platform
npm install
```

### 2. Start Infrastructure
```bash
docker compose up -d
```
This starts PostgreSQL (port 5432) and Redis (port 6379).

### 3. Configure Environment
```bash
cp backend/.env.example backend/.env
# Edit backend/.env with your values
```

### 4. Setup Database
```bash
npm run db:generate
npm run db:migrate
npm run db:seed
```

### 5. Start Development Servers
```bash
# Start both backend + frontend
npm run dev

# Or individually:
npm run dev:backend    # http://localhost:3000
npm run dev:frontend   # http://localhost:5173
```

### Default Admin Credentials
- **Email:** admin@healthcare.local
- **Password:** Admin123!

## Project Structure

```
/backend           Express API + BullMQ workers
  /src
    /config        Environment validation
    /db            Prisma schema, client, seed
    /middleware    Auth, role-guard, error handler
    /modules       Feature modules (auth, doctors, appointments, etc.)
    /integrations  External services (LLM, email, calendar)
    /jobs          BullMQ job processors
/frontend          React + Vite SPA
  /src
    /portals       Role-based views (patient, doctor, admin)
    /components    Shared UI components
    /hooks         React Query hooks
    /api           Typed API client
/docs              Architecture & API documentation
```

## Documentation

- [System Design](docs/SYSTEM_DESIGN.md) — Core architectural decisions
- [API Reference](docs/API.md) — Endpoint documentation
- [Database Schema](docs/DB_SCHEMA.md) — ER diagram & table definitions
- [LLM Prompts](docs/LLM_PROMPTS.md) — Claude prompt templates
- [Google Calendar Setup](docs/GOOGLE_CALENDAR_SETUP.md) — OAuth configuration

## License

MIT
