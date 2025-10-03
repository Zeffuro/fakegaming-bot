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

**Authentication:** HTTP-only cookies with JWT

**Current endpoints:**
- `/auth/discord` - Discord OAuth initiation
- `/auth/discord/callback` - OAuth callback handler
- `/guilds` - User's accessible guilds
- `/guilds/[guildId]/channels` - Guild channels for dashboard

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

## Migration Notes

### Recent Improvements (October 2025)
- ✅ **Created shared authentication utilities** (`lib/auth/authUtils.ts`)
- ✅ **Eliminated duplicate auth logic** between guilds and channels routes
- ✅ **Separated data logic from UI** in YouTube page using custom hooks
- ✅ **Fixed API endpoint usage** - YouTube page now uses correct dashboard API
- ✅ **Improved code organization** - Clear separation of concerns

### Benefits Achieved
1. **Reduced code duplication** - Auth logic shared between routes
2. **Better maintainability** - Data logic separated from UI
3. **Improved testability** - Hooks can be tested independently
4. **Clearer architecture** - Each file has a single responsibility
5. **Easier debugging** - API calls centralized in hooks
