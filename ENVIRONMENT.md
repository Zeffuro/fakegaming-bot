# Environment Variables & Docker Setup

This monorepo uses dedicated Dockerfiles and `.env` files for each service. The environment setup differs between local development and Docker Compose deployment.

## Environment File Strategy

### Local Development (No Docker)
- **File:** `.env.development` in each package
- **Loaded by:** `NODE_ENV=development` (set by `start:dev` scripts)
- **Purpose:** Development credentials, SQLite database, test API keys
- **Database:** SQLite (no DATABASE_URL needed)

### Local Development (With Docker)
- **File:** `.env.development` in each package
- **Docker Compose:** `docker-compose.local.yml`
- **Purpose:** Test Dockerized builds locally with development credentials
- **Database:** SQLite (uses shared data volume)
- **Builds from source** instead of using pre-built images

### Production / Live Data Testing
- **File:** `.env` in each package
- **Loaded by:** `NODE_ENV=production` (set by `start` scripts)
- **Purpose:** Production credentials, live database, real API keys
- **Database:** PostgreSQL or other production database

### Docker Compose (Production)
- **Files:** Root `.env` + each package's `.env`
- **Docker Compose:** `docker-compose.yml`
- **Root .env:** Controls Docker Compose (database credentials, volume paths)
- **Package .env:** Service-specific configuration (ports, API keys, etc.)
- **Database:** PostgreSQL (DATABASE_URL injected automatically)
- **Uses pre-built images** from Docker Hub

## Dockerfiles

- **API Service:** `Dockerfile.api`
- **Bot Service:** `Dockerfile.bot`
- **Dashboard Service:** `Dockerfile.dashboard`

## .env File Locations

- **Root:** `.env` (for Docker Compose variables only)
- **API Service:** `packages/api/.env.development` (dev) or `packages/api/.env` (prod)
- **Bot Service:** `packages/bot/.env.development` (dev) or `packages/bot/.env` (prod)
- **Dashboard Service:** `packages/dashboard/.env.development` (dev) or `packages/dashboard/.env` (prod)

## Key Environment Variables

### Root .env (Docker Compose Only)
```bash
# PostgreSQL credentials for Docker Compose
POSTGRES_USER=fakegaming
POSTGRES_PASSWORD=your_secure_password
POSTGRES_DB=fakegaming
POSTGRES_PORT=5432

# Docker volume mappings
POSTGRES_DATA_PATH=./data/postgres  # PostgreSQL data
BOT_DATA_PATH=./data/bot           # Bot assets and SQLite backups
```

### Service .env Files

Each service requires its own `.env.development` (for local dev) or `.env` (for production/Docker):

#### packages/bot/.env.development (example)
```bash
# Database - SQLite for local development
DATA_ROOT=./data
DATABASE_PROVIDER=sqlite
# DATABASE_URL not needed for SQLite

# Discord
DISCORD_BOT_TOKEN=your_dev_bot_token
CLIENT_ID=your_dev_client_id
GUILD_ID=your_test_guild_id

# API Keys (use test keys for dev)
RIOT_LEAGUE_API_KEY=your_riot_api_key
TWITCH_CLIENT_ID=your_twitch_client_id
TWITCH_CLIENT_SECRET=your_twitch_secret
YOUTUBE_API_KEY=your_youtube_api_key
OPENWEATHER_API_KEY=your_weather_api_key
```

#### packages/api/.env.development (example)
```bash
# Server configuration
PORT=3001
PUBLIC_URL=http://localhost:3001/api

# Database - SQLite for local development
DATABASE_PROVIDER=sqlite
# DATABASE_URL not needed for SQLite

# JWT configuration
JWT_SECRET=your_development_secret
JWT_AUDIENCE=fakegaming-dashboard

# Dashboard OAuth
DASHBOARD_CLIENT_ID=dashboard
DASHBOARD_CLIENT_SECRET=your_dashboard_secret

# Optional: Redis (not required for development)
# REDIS_URL=redis://localhost:6379
```

#### packages/dashboard/.env.development (example)
```bash
# Server configuration
PORT=3000
PUBLIC_URL=http://localhost:3000

# Discord OAuth
DISCORD_CLIENT_ID=your_discord_client_id
DISCORD_CLIENT_SECRET=your_discord_client_secret
DISCORD_BOT_TOKEN=your_bot_token

# API connection
API_URL=http://localhost:3001/api

# JWT configuration (must match API)
JWT_SECRET=your_development_secret
JWT_AUDIENCE=fakegaming-dashboard

# Dashboard OAuth (must match API)
DASHBOARD_CLIENT_ID=dashboard
DASHBOARD_CLIENT_SECRET=your_dashboard_secret

# Admin Discord user IDs (comma-separated)
DASHBOARD_ADMINS=123456789012345678,987654321098765432

# Optional: Redis (not required for development)
# REDIS_URL=redis://localhost:6379
```

## JWT Environment Variables

JWT is used for authentication across API and dashboard services. The following variables are required:

| Variable         | Required | Description                                 | Example Value             |
|------------------|----------|---------------------------------------------|--------------------------|
| JWT_SECRET       | Yes      | HMAC secret for signing/verifying JWTs       | (long random string)      |
| JWT_AUDIENCE     | Yes      | Audience claim (e.g., dashboard client)      | fakegaming-dashboard     |
| JWT_ISSUER       | Yes      | Issuer claim (e.g., API service)             | fakegaming               |

- **Production:** All variables must be set. The API and dashboard will fail to start if any are missing.
- **Development/Test:** Safe defaults are used only in test environments. For local/dev, set these in `.env.development` for each package.
- **Rotation:** Rotate `JWT_SECRET` periodically. When rotating, ensure all services are updated simultaneously to avoid auth failures. Document rotation events and update secrets in CI/CD and all relevant `.env` files.
- **Algorithm:** Only HS256 is supported and enforced.
- **Security:** Never commit secrets to version control. Use environment variables or secret managers.

See also: `packages/api/src/middleware/auth.ts` for enforcement logic.

## Docker Compose Configuration

The `docker-compose.yml` uses **pre-built images** for production deployment:

```yaml
services:
  postgres:
    image: postgres:17
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    volumes:
      - ${POSTGRES_DATA_PATH:-./data/postgres}:/var/lib/postgresql/data

  bot:
    image: zeffuro/fakegaming-bot:latest
    env_file:
      - ./packages/bot/.env
    environment:
      # DATABASE_URL constructed from root .env variables
      DATABASE_URL: postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}
    volumes:
      - ${BOT_DATA_PATH:-./data/bot}:/app/data

  api:
    image: zeffuro/fakegaming-api:latest
    env_file:
      - ./packages/api/.env
    environment:
      # DATABASE_URL constructed from root .env variables
      DATABASE_URL: postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}

  dashboard:
    image: zeffuro/fakegaming-dashboard:latest
    env_file:
      - ./packages/dashboard/.env
    ports:
      - "${PORT:-3000}:${PORT:-3000}"
```

**Important:** `DATABASE_URL` is automatically constructed from root `.env` variables and injected into containers, overriding any DATABASE_URL in service `.env` files.

## Setup Instructions

### For Local Development

1. **Copy `.env.example` to `.env.development`** in each package:
   ```bash
   cp packages/bot/.env.example packages/bot/.env.development
   cp packages/api/.env.example packages/api/.env.development
   cp packages/dashboard/.env.example packages/dashboard/.env.development
   ```

2. **Edit each `.env.development` file:**
   - Set `DATABASE_PROVIDER=sqlite` (no DATABASE_URL needed)
   - Add development Discord tokens and test API keys
   - Use `localhost` URLs for service connections

3. **Install dependencies and run:**
   ```bash
   pnpm install
   pnpm start:bot:dev     # Loads .env.development
   pnpm start:api:dev     # Loads .env.development
   pnpm start:dashboard:dev  # Loads .env.development
   ```

### For Production / Live Data Testing

1. **Copy `.env.example` to `.env`** in each package:
   ```bash
   cp packages/bot/.env.example packages/bot/.env
   cp packages/api/.env.example packages/api/.env
   cp packages/dashboard/.env.example packages/dashboard/.env
   ```

2. **Edit each `.env` file:**
   - Set `DATABASE_PROVIDER=postgres` and add `DATABASE_URL`
   - Add production Discord tokens and real API keys
   - Use production URLs

3. **Build and run:**
   ```bash
   pnpm build
   pnpm start:bot      # Loads .env
   pnpm start:api      # Loads .env
   pnpm start:dashboard   # Loads .env
   ```

### For Docker Compose (Production)

**Use this for production deployment with pre-built images from Docker Hub:**

1. **Copy root `.env.example` to `.env`:**
   ```bash
   cp .env.example .env
   ```

2. **Edit root `.env`** with database credentials and volume paths.

3. **Copy and edit service `.env` files** (production credentials):
   ```bash
   cp packages/bot/.env.example packages/bot/.env
   cp packages/api/.env.example packages/api/.env
   cp packages/dashboard/.env.example packages/dashboard/.env
   ```
   
4. **Start Docker Compose:**
   ```bash
   docker-compose up -d
   ```

**Notes:**
- Uses pre-built images (`zeffuro/fakegaming-*:latest`) from Docker Hub
- `DATABASE_URL` is automatically set from root `.env` variables
- You do NOT need to set `DATABASE_URL` in service `.env` files (it will be overridden)
- Volume paths for data persistence are configured in the root `.env`
- Runs with PostgreSQL database
- Use `-d` flag to run in detached mode (background)

**Stop services:**
```bash
docker-compose down
```

---

### For Local Docker Testing (Development)

**Use this to test Dockerized builds locally with development credentials:**

1. **Copy `.env.example` to `.env.development`** in each package (if not already done):
   ```bash
   cp packages/bot/.env.example packages/bot/.env.development
   cp packages/api/.env.example packages/api/.env.development
   cp packages/dashboard/.env.example packages/dashboard/.env.development
   ```

2. **Edit each `.env.development` file** with development credentials (SQLite, test API keys).

3. **Build and start services with the local compose file:**
   ```bash
   docker-compose -f docker-compose.local.yml up --build -d
   ```

**What makes this different:**
- ✅ **Builds from source** (uses `build:` instead of `image:`)
- ✅ **Uses `.env.development` files** (development credentials)
- ✅ **No PostgreSQL** (uses SQLite via shared volume)
- ✅ **Exposes ports** (API on 3001, Dashboard on 3000)
- ✅ **Perfect for testing Docker builds** before pushing images

**Access services:**
- Dashboard: http://localhost:3000
- API: http://localhost:3001/api

**Stop services:**
```bash
docker-compose -f docker-compose.local.yml down
```

**Rebuild after code changes:**
```bash
docker-compose -f docker-compose.local.yml up --build -d
```

---

### Comparison: docker-compose.yml vs docker-compose.local.yml

| Feature | `docker-compose.yml` (Production) | `docker-compose.local.yml` (Local Testing) |
|---------|-----------------------------------|---------------------------------------------|
| **Purpose** | Production deployment | Local Docker testing |
| **Images** | Pre-built from Docker Hub | Built from source |
| **Database** | PostgreSQL (included) | SQLite (via volume) |
| **Environment** | `.env` files | `.env.development` files |
| **Ports Exposed** | Dashboard only (3000) | API (3001) + Dashboard (3000) |
| **Use Case** | Deploy to server | Test Dockerfiles locally |
| **Command** | `docker-compose up -d` | `docker-compose -f docker-compose.local.yml up --build -d` |

#### CSRF Protection (Dashboard & API)
Both the Dashboard (Next.js) and API (Express) use a double-submit cookie pattern via a shared core in `@zeffuro/fakegaming-common/security` for CSRF defense on mutating requests (POST/PUT/PATCH/DELETE):
- Cookie name: `csrf` (not HttpOnly; SameSite=Lax; rotated periodically and at login/refresh).
- Header: `x-csrf-token` must match the cookie value.
- Safe methods (GET/HEAD/OPTIONS) bypass validation.
- Failure responses: HTTP 403 with JSON `{ error: "CSRF", details }`.
- Rotation: new token issued on login and JWT refresh; may rotate on other privileged actions later.

Risk considerations:
- SameSite=Lax mitigates cross-site contexts; token is random (32 bytes hex).
- Because auth cookie `jwt` is HttpOnly + SameSite=Strict, token theft via XSS is still a concern; continue minimizing inline scripts and consider CSP.

Public names exported from common:
- `CSRF_COOKIE_NAME` = `csrf`
- `CSRF_HEADER_NAME` = `x-csrf-token`

Adapters and helpers:
- Dashboard: `packages/dashboard/lib/security/csrf.ts` (NextResponse/NextRequest integration)
- API: `packages/api/src/middleware/csrf.ts` (Express middleware)
  - `enforceCsrfOnce(req,res,next)`: Ensures CSRF is enforced at most once per request and short-circuits subsequent checks.
  - `skipCsrf(req,res,next)`: Explicitly bypass CSRF for a route (e.g., `/auth/login`).

Router auto-enforcement (API):
- Mutating routes are automatically protected by `enforceCsrfOnce` when you build routers with `createBaseRouter()` (`packages/api/src/utils/createBaseRouter.ts`).
- To intentionally bypass CSRF for a route, include `skipCsrf` as the first middleware in that route definition (the base router orders it correctly before enforcement).
- App-level middleware also applies `enforceCsrfOnce` after JWT auth and before rate limiting to preserve global ordering; `enforceCsrfOnce` short-circuits, so duplicate checks do not add overhead.

---

### Bot Health Server
The bot exposes lightweight health endpoints via an internal HTTP server for uptime checks and orchestrators:
- GET /healthz: returns 200 when the process is up.
- GET /ready: returns 200 when the Discord client is ready and the database (if configured) is reachable; otherwise 503.

Configuration:
- BOT_HEALTH_PORT: Optional port to bind the bot health server. If omitted or set to 0, an ephemeral port is chosen and logged at startup.
- BOT_HEALTH_HOST: Optional host/interface to bind. Defaults to 127.0.0.1 for safety. Use 0.0.0.0 only if you intend to expose externally.

Example (packages/bot/.env or .env.development):
```bash
# Bind the bot health server (optional)
BOT_HEALTH_PORT=8081
# Bind to loopback only by default (safer); set 0.0.0.0 only if you must expose externally
BOT_HEALTH_HOST=127.0.0.1
```

Security & exposure:
- Binding to 127.0.0.1 keeps the endpoints accessible only from the local machine/container network namespace.
- If you set BOT_HEALTH_HOST=0.0.0.0 and map the port, the endpoints become network-accessible. The responses do not contain secrets, but treat them as internal-only; restrict exposure via firewalling/reverse proxy IP allow-lists.
- In Docker/Compose/Kubernetes, only map the port when you need external probing. Prefer sidecar/local-network probes when possible.

Docker note:
- To access the bot health endpoints from outside the container, set BOT_HEALTH_PORT and BOT_HEALTH_HOST=0.0.0.0, and expose/map the port in your runtime environment (Compose/Kubernetes). The production docker-compose currently does not publish the bot health port; map it if needed for your monitoring.

---

