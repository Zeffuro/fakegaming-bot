# fakegaming-bot Monorepo

[![Build Status](https://github.com/Zeffuro/fakegaming-bot/actions/workflows/ci.yml/badge.svg)](https://github.com/Zeffuro/fakegaming-bot/actions)
[![codecov](https://codecov.io/gh/Zeffuro/fakegaming-bot/branch/main/graph/badge.svg)](https://codecov.io/gh/Zeffuro/fakegaming-bot)
[![License: AGPL v3](https://img.shields.io/badge/License-AGPLv3-blue.svg)](LICENSE)
[![Node.js Version](https://img.shields.io/badge/node-%3E=22.0.0-brightgreen)](https://nodejs.org/)
[![ESLint](https://img.shields.io/badge/code_style-eslint-blue.svg)](https://eslint.org/)
[![Vitest](https://img.shields.io/badge/tested_with-vitest-6E9F18.svg?logo=vitest)](https://vitest.dev/)
[![Last Commit](https://img.shields.io/github/last-commit/Zeffuro/fakegaming-bot)](https://github.com/Zeffuro/fakegaming-bot/commits)

A modular Discord bot for community management, Twitch stream notifications, YouTube video announcements, League of
Legends stats, quotes, reminders, and more. Built with TypeScript and Discord.js. **This project is now a monorepo**
containing multiple packages.

---

## Features

- Modular command system
- Twitch and YouTube integration
- League of Legends and Teamfight Tactics stats
- Quote management
- Reminders and timezone support

---

## Monorepo Structure

This repository uses **[pnpm workspaces](https://pnpm.io/workspaces)** to manage multiple packages:

- **packages/api** — Express REST API for external integrations and bot operations
- **packages/bot** — The Discord bot (commands, services, integrations)
- **packages/common** — Shared code (database models, utilities, types)
- **packages/dashboard** — Dashboard for bot management (Next.js)

- `data/` — Persistent data, assets, and config (used by the bot)
- `migrations/` — Database migration scripts
- `scripts/` — Utility scripts (e.g., codegen, migration helpers)

---

## Documentation

- Architecture and patterns: `ARCHITECTURE.md`
- Engineering guides:
  - TypeScript & ESLint conventions: `TYPESCRIPT.md`
  - Testing strategy and helpers: `TESTING.md`
  - Environment and Docker setup: `ENVIRONMENT.md`
  - Database schema and migrations: `SCHEMA.md` and `MIGRATIONS.md`

---

## Getting Started

> **Package Manager:**  
> This project **requires [pnpm](https://pnpm.io/)** for monorepo workspace management.  
> Install with: `npm install -g pnpm`

### Prerequisites

- Node.js (v22+ recommended)
- **pnpm** (install with `npm install -g pnpm` or see [pnpm installation](https://pnpm.io/installation))
- (Optional) Docker & Docker Compose for containerized development/production

### Installation

Install all dependencies for all packages:

```bash
pnpm install
```

### Environment Variables

**For Local Development:**

1. Copy `.env.example` to `.env.development` in each package:
   ```bash
   cp packages/bot/.env.example packages/bot/.env.development
   cp packages/api/.env.example packages/api/.env.development
   cp packages/dashboard/.env.example packages/dashboard/.env.development
   ```

2. Edit each `.env.development` file with your **development credentials**:
   - Use **SQLite** for the database (no DATABASE_URL needed)
   - Use development Discord tokens/IDs
   - Use test API keys

**For Production/Live Data Testing:**

1. Copy `.env.example` to `.env` in each package:
   ```bash
   cp packages/bot/.env.example packages/bot/.env
   cp packages/api/.env.example packages/api/.env
   cp packages/dashboard/.env.example packages/dashboard/.env
   ```

2. Edit each `.env` file with your **production credentials**

**For Docker Compose:**

1. Copy the root `.env.example` to `.env` in the repository root:
   ```bash
   cp .env.example .env
   ```

2. Copy each package's `.env.example` to `.env` (production credentials)

3. Fill in database credentials in the root `.env` (Docker Compose will inject DATABASE_URL automatically)

**Environment File Priority:**
- Development scripts (`start:dev`) → Loads `.env.development` (via `NODE_ENV=development`)
- Production scripts (`start`) → Loads `.env` (via `NODE_ENV=production`)
- If environment-specific file is missing, falls back to `.env`

---

## Running & Development

### Running with Docker Compose (Production)

You can run the bot and its dependencies using Docker Compose with pre-built images:

```bash
docker-compose up -d
```

- This will start the bot, PostgreSQL database, API, and dashboard services.
- Uses pre-built images from Docker Hub (`zeffuro/fakegaming-*:latest`).
- The root `.env` file controls Docker Compose variables (database credentials, volume paths).
- Each service's `.env` file is loaded for service-specific configuration.
- To stop and remove containers:
  ```bash
  docker-compose down
  ```

### Running with Docker Compose (Local Testing)

To test Dockerized builds locally with development credentials:

```bash
docker-compose -f docker-compose.local.yml up --build -d
```

- This builds images from source instead of pulling from Docker Hub.
- Uses `.env.development` files for each service (development credentials).
- No PostgreSQL (uses SQLite via shared volume).
- Exposes API on port 3001 and Dashboard on port 3000.
- Perfect for testing Docker builds before deployment.
- Access: Dashboard at http://localhost:3000, API at http://localhost:3001/api

To rebuild after code changes:
```bash
docker-compose -f docker-compose.local.yml up --build -d
```

To stop:
```bash
docker-compose -f docker-compose.local.yml down
```

### Running Locally (Development Mode)

**Start the bot:**
```bash
pnpm start:bot:dev
```

**Start the API:**
```bash
pnpm start:api:dev
```

**Start the dashboard:**
```bash
pnpm start:dashboard:dev
```

These commands:
- Set `NODE_ENV=development` (loads `.env.development`)
- Use `tsx` for TypeScript execution without compilation
- Enable hot-reload for rapid development
- No Docker required

### Running Locally (Production Mode)

First build all packages:
```bash
pnpm build
```

Then start services:
```bash
pnpm start:bot    # Uses .env, runs compiled dist/index.js
pnpm start:api    # Uses .env, runs compiled dist/index.js
pnpm start:dashboard  # Uses .env, runs Next.js production server
```

---

## OpenAPI & Dashboard Types

The API exports an OpenAPI spec that the dashboard consumes to generate TypeScript types.

- Export the API spec:
```cmd
pnpm --filter @zeffuro/fakegaming-bot-api run export:openapi
```
- Regenerate dashboard API types:
```cmd
pnpm --filter @zeffuro/fakegaming-bot-dashboard run generate:api-types
pnpm --filter @zeffuro/fakegaming-bot-dashboard run typecheck
```

---

## Building, Linting, and Testing

- **Build all packages:**
  ```bash
  pnpm build
  ```
- **Lint all packages:**
  ```bash
  pnpm lint
  ```
- **Typecheck all packages:**
  ```bash
  pnpm typecheck
  ```
- **Test all packages:**
  ```bash
  pnpm test
  ```
- **Test with coverage:**
  ```bash
  pnpm test:coverage
  ```

Coverage thresholds per package:
- Lines/Statements: 80%
- Branches: 75%
- Functions: 80%

Notes:
- Generated or declarative wiring files may be excluded from coverage (e.g., auto-generated bot manifest, schema override registry). Core behavior is covered by unit/integration tests.

---

## Cross-Cutting Concerns (Security, Limits, Observability)

- CSRF: Both API (Express) and Dashboard (Next.js) enforce CSRF on mutating routes via a shared core in `@zeffuro/fakegaming-common/security`.
- Auth: JWT (HS256) with required issuer/audience. Cookies are HttpOnly/SameSite for dashboard.
- Rate limiting: DB-backed sliding window in API with standard headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`, and `Retry-After` on 429.
- Health/Readiness: `/healthz` and `/ready` endpoints for API and Bot. Docker compose exposes bot health locally only.
- Logging: Pino-based structured logs (`getLogger` in common). Dev pretty logs with `LOG_PRETTY=1`. API uses `pino-http` for request logging (reqId, status, latency) and skips `/healthz` noise.
- Metrics: Minimal in-process counters and periodic summary logs in API/Bot; Prometheus can be added later.

---

## Validation & Error Handling Standards

- All API routes use shared Zod-based validators from `@zeffuro/fakegaming-common`:
  - `validateParams(schema)` — path params (400 on invalid)
  - `validateQuery(schema)` — query params (400 on invalid)
  - `validateBody(schema | model, mode?)` or `validateBodyForModel(Model, 'create'|'update')` — request bodies (400 on invalid)
- Auth uses JWT; protected routes return 401 when token is missing/invalid and 403 for insufficient permissions.
- DELETE/GET-by-id endpoints consistently return 404 when resource is not found.

---

## Database & Migrations

- **Database models** are defined in `packages/common` (typically in `packages/common/src/models/`).
- **Database schema:** See [SCHEMA.md](./SCHEMA.md) for a complete Entity Relationship Diagram and detailed documentation of all tables.
- **Schema changes:** Any change to the database schema (adding/removing fields, tables, etc.) requires a new migration
  script in the `migrations/` directory.
- **Writing migrations:**
    - Create a new migration file in `migrations/` (see existing files for naming conventions, e.g.,
      `YYYYMMDD-description.ts`).
    - Migrations should be written in TypeScript and follow the project's migration conventions.
    - Both `up` and `down` functions are required for rollback capability.
    - See [MIGRATIONS.md](./MIGRATIONS.md) for detailed migration guide with examples.
- **Running migrations:**
    - Migrations run automatically when the bot or API starts.
    - The system uses Umzug to track which migrations have been applied.
    - See [MIGRATIONS.md](./MIGRATIONS.md) for manual execution and troubleshooting.

---

## Continuous Integration (CI)

This project uses **GitHub Actions** for continuous integration:

- **Builds, lints, and tests** all packages on every pull request and push to `main`.
- **Uploads coverage to Codecov** for `api`, `bot`, `common`, and `dashboard` packages.
- Ensures all code passes before merging.
- See the CI workflow in `.github/workflows/ci.yml`.

---

## Available Commands

<!-- COMMAND_TABLE_START -->

| Command | Description | Permissions |
|---------|-------------|-------------|
|`/add-quote`|Add a quote|All users|
|`/add-twitch-stream`|Add a Twitch stream for notifications|All users|
|`/add-youtube-channel`|Add a Youtube Channel for new video notifications|All users|
|`/birthday`|Show your or another user's birthday|All users|
|`/get-patchnotes`|Get the latest patch notes for a game|All users|
|`/help`|List all available commands and their descriptions.|All users|
|`/league-history`|Get recent League of Legends match history for a summoner|All users|
|`/league-stats`|Get League of Legends stats for a summoner or linked user|All users|
|`/link-riot`|Link your Discord account or another user to a Riot account|All users|
|`/poll`|Create a simple poll for users to vote on|All users|
|`/quotes`|Get all quotes for a user|All users|
|`/random-quote`|Get a random quote from the server|All users|
|`/remove-birthday`|Remove your birthday or another user's birthday (admins only)|All users|
|`/roll`|Roll dice or generate a random number|All users|
|`/search-quote`|Search quotes by text|All users|
|`/set-birthday`|Set your birthday and the channel to post in|All users|
|`/set-reminder`|Set a reminder|All users|
|`/set-timezone`|Set your timezone|All users|
|`/spin`|Spin the wheel to pick someone!|All users|
|`/subscribe-patchnotes`|Subscribe a channel to patch notes for a game|All users|
|`/tft-history`|Get recent Teamfight Tactics match history for a summoner|All users|
|`/weather`|Get the current weather and a short forecast for a specified location|All users|
<!-- COMMAND_TABLE_END -->

> **Note:** The command table above is auto-generated by CI. You do not need to update it manually.

---

## Development & Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for code style, how to add commands or preloaders, PR process, and more. Pull
requests and issues are welcome!

See also:
- [MIGRATIONS.md](./MIGRATIONS.md) - Database migration guide
- [TYPESCRIPT.md](./TYPESCRIPT.md) - TypeScript & ESLint configuration
- [ARCHITECTURE.md](./ARCHITECTURE.md) - Architecture decisions and patterns
- [ENVIRONMENT.md](./ENVIRONMENT.md) - Environment setup guide

---

## Code of Conduct

Participation in this project is governed by our [Code of Conduct](./CODE_OF_CONDUCT.md). Please be respectful and help
us keep the community welcoming.

---

## Security Policy

If you discover a security vulnerability, please see [SECURITY.md](./SECURITY.md) for how to report it privately.

---

## License

This project is licensed under the GNU Affero General Public License v3.0 (AGPLv3).

- **You can use, modify, and share this project, but if you deploy it or make it public, you must also share your
  changes under the same license.**
- See [LICENSE](./LICENSE) for the full text.

---

## FAQ

**Q: Can I use this bot on my own server?**
A: Yes! This project is open source and self-hosted. Follow the instructions above to deploy it to your own environment.

**Q: Is there a public instance or support server?**
A: No, this bot is used privately. There is no public instance or official support server.

**Q: How do I add new commands or features?**
A: See the [CONTRIBUTING.md](./CONTRIBUTING.md) for details on adding commands, features, and database changes.

**Q: Where are the database models?**
A: All models are in `packages/common`. See [SCHEMA.md](./SCHEMA.md) for a complete database schema diagram and documentation.

**Q: How do I report bugs or request features?**
A: Use GitHub Issues. See the Reporting Issues section in [CONTRIBUTING.md](./CONTRIBUTING.md).

**Q: Who maintains this project?**
A: [@Zeffuro](https://github.com/Zeffuro)

---

## Invite the Bot

To invite the bot to your Discord server, use the following links (replace `[client_id]` with your bot's client ID):

- **With Administrator permissions:**  
  `https://discord.com/oauth2/authorize?client_id=[client_id]&scope=bot%20applications.commands&permissions=522368`

- **Without Administrator permissions:**  
  `https://discord.com/oauth2/authorize?client_id=[client_id]&scope=bot%20applications.commands&permissions=522360`

---

Maintained by [@Zeffuro](https://github.com/Zeffuro)

## Privacy: Discord user resolution (Dashboard Quotes)

The dashboard quotes page resolves Discord user IDs (authors/submitters) to minimal display info using the bot token:
- Cached in Redis up to 24h under `user:{id}:profile` (id, username, global_name, discriminator, avatar)
- Optional guild nickname cached up to 24h under `user:{id}:nick:{guildId}`
- Only guild admins can request resolutions for IDs that already appear in that guild’s quotes
- No data is persisted in SQL; cache may be cleared safely at any time

Server env required for this feature: `DISCORD_BOT_TOKEN`, `JWT_SECRET`, `JWT_AUDIENCE`, and Redis configuration.
