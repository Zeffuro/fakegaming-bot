# Architecture Guide

This document defines where different types of code should live in our monorepo.

## Service Boundaries

### 🚀 Express API (`packages/api`) - External/Bot Services
**Purpose:** Traditional REST API for external integrations and bot operations

**What belongs here:**
- ✅ **Bot configuration** (disabled commands, patch subscriptions)
- ✅ **External integrations** (Twitch, YouTube webhooks)
- ✅ **Data management** (quotes, reminders, birthdays, users)
- ✅ **Non-dashboard features** (patch notes distribution)
- ✅ **Third-party API endpoints** (mobile apps, webhooks)
- ✅ **Complex business logic** that needs dedicated endpoints

**Authentication:** JWT tokens (for external clients)

**Current endpoints:**
- `/auth` - JWT authentication for external services
- `/quotes` - Quote management
- `/users` - User data management  
- `/servers` - Server configuration
- `/twitch` - Twitch integration
- `/youtube` - YouTube integration
- `/reminders` - Reminder system
- `/birthdays` - Birthday tracking
- `/patchNotes` - Patch note distribution
- `/patchSubscriptions` - Patch subscription management
- `/disabledCommands` - Bot command configuration

### 🌐 Dashboard API (`packages/dashboard/app/api`) - Dashboard-Specific
**Purpose:** Next.js API routes for dashboard functionality

**What belongs here:**
- ✅ **Discord OAuth** (login, callback)
- ✅ **Session management** (user authentication)
- ✅ **Guild management** (guilds, channels for dashboard users)
- ✅ **Dashboard-specific data** (user preferences, dashboard config)
- ✅ **Server-side rendering data** (data needed for pages)
- ✅ **External API proxy** (proxying requests to the Express API with authentication)

**Authentication:** HTTP-only cookies with JWT

**Current endpoints:**
- `/auth/discord` - Discord OAuth initiation
- `/auth/discord/callback` - OAuth callback handler
- `/auth/me` - Get current authenticated user
- `/auth/logout` - Logout and clear session
- `/user` - User data for dashboard
- `/guilds` - User's accessible guilds
- `/guilds/[guildId]/channels` - Guild channels for dashboard
- `/external/[...proxy]` - Proxy requests to Express API with auth

### 📦 Common Package (`packages/common`) - Shared Logic
**What belongs here:**
- ✅ **Discord API utilities** (getDiscordGuilds, getDiscordGuildChannels)
- ✅ **Caching utilities** (cacheGet, cacheSet)
- ✅ **Authentication helpers** (JWT issuing, OAuth flows)
- ✅ **Database models** (Sequelize models)
- ✅ **Types and interfaces** (shared TypeScript types)

### 🎯 Dashboard Components & Hooks (`packages/dashboard`)
**What belongs here:**
- ✅ **Custom hooks** (`components/hooks/`) - Data fetching logic, state management
- ✅ **Shared authentication utilities** (`lib/auth/`) - Dashboard-specific auth helpers
- ✅ **UI components** (`components/`) - Reusable React components
- ✅ **Page components** (`app/dashboard/`) - Route-specific UI only

## Code Organization Patterns

### ✅ Shared Authentication Logic
**Location:** `packages/dashboard/lib/auth/authUtils.ts`

**Benefits:**
- Eliminates duplicate authentication code
- Consistent error handling
- Centralized permission checking

**Usage:**
```typescript
import { authenticateUser, checkGuildAccess } from "@/lib/auth/authUtils";

const authResult = await authenticateUser(req);
const guildAccess = await checkGuildAccess(user, guildId);
```

### ✅ Custom Hooks Pattern
**Location:** `packages/dashboard/components/hooks/`

**Benefits:**
- Separates data logic from UI components
- Reusable across multiple pages
- Easier testing and maintenance
- Clear separation of concerns

**Example:**
```typescript
// useYouTube.ts - Data fetching logic
export function useYouTubeConfigs(guildId) { /* ... */ }
export function useGuildChannels(guildId) { /* ... */ }

// page.tsx - UI only
const { configs, addConfig } = useYouTubeConfigs(guildId);
const { channels, getChannelName } = useGuildChannels(guildId);
```

### ✅ Page Component Structure
**Pattern:** Keep page components focused on UI rendering only

**Before (❌):**
- Mixed data fetching with UI logic
- Duplicate API calls
- Hard to maintain and test

**After (✅):**
- Custom hooks handle all data logic
- Page components only handle UI state and rendering
- Reusable data logic across pages

## Decision Tree

When adding a new feature, ask yourself:

1. **Is this for the dashboard specifically?**
   - YES → Dashboard API (`packages/dashboard/app/api`)

2. **Is this for external clients or bot operations?**
   - YES → Express API (`packages/api`)

3. **Is this shared logic between services?**
   - YES → Common package (`packages/common`)

4. **Is this dashboard UI logic?**
   - **Data fetching/state management** → Custom hook (`components/hooks/`)
   - **Authentication/permissions** → Auth utils (`lib/auth/`)
   - **UI components** → Components (`components/`)
   - **Page-specific UI** → Page component (`app/dashboard/`)

## Examples

### ✅ Good Examples
- **Channel fetching for dashboard** → Dashboard API + custom hook
- **Authentication utilities** → Shared auth utils
- **YouTube config management** → Custom hook + Express API
- **Guild permissions checking** → Shared auth utils

### ❌ Bad Examples
- **Data fetching in page components** → Should use custom hooks
- **Duplicate auth logic** → Should use shared auth utils
- **API endpoint logic in components** → Should be in API routes

---

## Bot Module Organization

### Command Structure
Commands are organized by module in `packages/bot/src/modules/`:

```
modules/
├── general/        # General utility commands (help, roll, poll, weather)
├── league/         # League of Legends integration
├── quotes/         # Quote management system
├── reminders/      # Reminder system with timezone support
├── birthdays/      # Birthday tracking and notifications
├── twitch/         # Twitch stream notifications
├── youtube/        # YouTube video notifications
├── patchnotes/     # Game patch notes distribution
```

Each module contains:
- `commands/` - Discord slash commands
- `__tests__/` - Unit tests for commands
- `shared/` - Shared utilities (optional)

### Service Organization
Background services in `packages/bot/src/services/`:

```
services/
├── patchfetchers/     # Game-specific patch note fetchers
├── patchNotesService.test.ts
├── scheduledReminderService.ts
└── birthdayService.ts
```

### Adding a New Module

1. Create module directory: `packages/bot/src/modules/yourmodule/`
2. Add commands in `commands/` subdirectory
3. Export command data and execute function
4. Add tests in `__tests__/` subdirectory
5. Register in command loader if needed

---

## Cross-Cutting Concerns

These apply across services and are implemented in shared locations where possible.

- CSRF protection
  - Shared core in `@zeffuro/fakegaming-common/security/csrf.ts` (cookie + header names; token generation/validation)
  - Next.js adapter: `packages/dashboard/lib/security/csrf.ts`
  - Express adapter: `packages/api/src/middleware/csrf.ts` (plus auto-enforcement in base router)
- Authentication
  - JWT (HS256) with required issuer/audience; helpers in `@zeffuro/fakegaming-common/discord/auth` and `@zeffuro/fakegaming-common/auth`
  - Dashboard uses HttpOnly cookie; API uses Bearer for external clients
- Rate limiting (API)
  - DB-backed sliding window (sql table `api_rate_limits`); middleware in API
  - Standard headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` and `Retry-After` on 429
- Logging & Metrics
  - Shared logger: `getLogger()` from `@zeffuro/fakegaming-common/utils/logger`
  - API request logs via `pino-http`; sensitive headers redacted; `/healthz` skipped
  - Minimal counters in common `utils/metrics`; API/Bot emit periodic summary logs
- Health & Readiness
  - API and Bot expose `/healthz` (liveness) and `/ready` (readiness) endpoints
  - Bot health server is local-only by default; see compose files for port mapping
- Generated artifacts
  - Bot command manifest is auto-generated into `packages/common/src/manifest/bot-manifest.ts` (do not edit)
  - Use `pnpm run gen:manifest` or root build scripts to regenerate

---
