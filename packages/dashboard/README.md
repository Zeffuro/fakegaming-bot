# @zeffuro/fakegaming-bot-dashboard

Next.js dashboard for managing the fakegaming Discord bot.

## Overview

Web dashboard for guild administrators to manage the bot surfaces that are currently backed by API routes and persisted configuration. Built with Next.js 16, React, and TypeScript.

## Features

### Authentication
- Discord OAuth2 login
- JWT-based session management
- HttpOnly cookies for security
- CSRF protection on all mutating requests
- Admin-only access control

### Guild Management
- View and select guilds where you have administrator permissions
- Per-guild dashboard index with links to live management pages
- Discord guild and channel data from the dashboard API routes

### Quote Management
- List all quotes in a guild
- Add new quotes
- Delete quotes
- Search and filter functionality
- Author/submitter resolution with Discord profile data

### Notification Integrations
- Configure Twitch, TikTok, Bluesky, YouTube, Steam News, Patch Notes, anime, and birthday notifications
- Set destination channels, custom messages, cooldown periods, quiet hours, and pause state where supported
- Import/export notification setup and review duplicate or crowded routes
- View and edit existing provider configurations

### Command Management
- Disable/enable specific commands per guild
- Disable/enable entire modules per guild
- View all available commands
- Organized by module

### Analytics
- View guild notification delivery history
- Review provider health and delivery rates
- Drill into provider-specific 30-day delivery trends

### Account Tools
- Manage user notes, personal reminders, user settings, and DM anime subscriptions

### Admin Tools
- Review jobs, audit events, delivery history, integration health, Riot links, and provider credential diagnostics

## Technology Stack

- **Framework:** Next.js 16 (App Router)
- **Language:** TypeScript
- **Styling:** Material UI with local dashboard components
- **UI Components:** React components backed by MUI
- **Authentication:** Discord OAuth2 + short-lived JWT + refresh sessions
- **API Client:** Fetch API with type-safe wrappers
- **Validation:** Zod (shared from common package)

## Development

### Setup

```bash
# From repository root
pnpm install

# Build common package first
pnpm --filter @zeffuro/fakegaming-common run build

# Start dashboard in development mode
pnpm start:dashboard:dev
```

### Environment Variables

Copy `.env.example` to `.env.development`:

```bash
cp packages/dashboard/.env.example packages/dashboard/.env.development
```

Required variables:

```bash
# Server
PORT=3000
PUBLIC_URL=http://localhost:3000

# Discord OAuth
DISCORD_CLIENT_ID=your_client_id
DISCORD_CLIENT_SECRET=your_client_secret
# DISCORD_REDIRECT_URI is optional, defaults to ${PUBLIC_URL}/api/auth/discord/callback

# API connection
API_URL=http://localhost:3001/api

# JWT (must match API)
JWT_SECRET=your_development_secret
JWT_AUDIENCE=fakegaming-dashboard
JWT_ISSUER=fakegaming

# Admins (comma-separated Discord user IDs)
DASHBOARD_ADMINS=123456789012345678,987654321098765432

# Redis shared cache (required when API and dashboard run separately)
REDIS_URL=redis://localhost:6379
```

### Discord Application Setup

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Select your application (or create a new one)
3. Go to "OAuth2" section
4. Add redirect URI:
   - Development: `http://localhost:3000/api/auth/discord/callback`
   - Production: `https://yourdomain.com/api/auth/discord/callback`
5. Copy Client ID and Client Secret to `.env.development`

### Commands

```bash
# Development mode (hot reload)
pnpm start:dev

# Production build
pnpm build

# Production server
pnpm start

# Lint
pnpm lint

# Type check
pnpm typecheck

# Test
pnpm test

# Generate API types from OpenAPI spec
pnpm -w run gen:api-types
```

## Architecture

### App Router Structure

```
app/
api/
  auth/discord/                # OAuth initiation and callback
  auth/logout/                 # Logout endpoint
  auth/me/                     # Current auth session
  auth/refresh/                # Refresh session
  external/[...proxy]/         # Signed proxy to Express API
  guilds/                      # Guild list
  guilds/[guildId]/channels/   # Guild channel list
  healthz/                     # Health check
  user/                        # Current user profile
dashboard/
  [guildId]/                   # Guild dashboard index
  admin/                       # Admin overview and tools
  analytics/[guildId]/         # Guild notification analytics
  anime/[guildId]/             # Anime episode subscriptions
  birthdays/[guildId]/         # Birthday announcements
  bluesky/[guildId]/           # Bluesky post notifications
  commands/[guildId]/          # Command/module availability
  me/                          # User notes, reminders, and settings
  patch-notes/[guildId]/       # Patch note subscriptions
  quotes/[guildId]/            # Quote management
  settings/[guildId]/          # Server control center
  settings/[guildId]/notifications/
  steam-news/[guildId]/        # Steam news subscriptions
  tiktok/[guildId]/            # TikTok live notifications
  twitch/[guildId]/            # Twitch live notifications
  youtube/[guildId]/           # YouTube upload notifications
layout.tsx                     # Root layout
```

### API Routes (Next.js)

Next.js API routes handle:
- Discord OAuth flow
- Session management
- Guild/channel data fetching
- Proxying requests to Express API

### Components

```
components/
dashboard/                     # Shared dashboard panels, cards, and theme helpers
config-dialog/                 # Shared notification configuration dialog fields
admin/                         # Admin overview and audit components
anime/                         # Anime dashboard components
hooks/                         # Dashboard data hooks
Commands/                      # Command/module controls
Guild/                         # Guild selection UI
NotificationConfigPage.tsx     # Shared provider notification CRUD page
BirthdayConfigPage.tsx         # Birthday announcement page shell
DashboardLayout.tsx            # Authenticated dashboard layout
```

### Custom Hooks Pattern

Data fetching and state management is handled by custom hooks backed by typed API wrappers in `lib/api/`:

```typescript
// components/hooks/useQuotes.ts
import { useCallback, useEffect, useState } from "react";
import type { ApiSchema } from "@zeffuro/fakegaming-common/api-helpers";
import { api } from "@/lib/api-client";

type Quote = ApiSchema<"QuoteConfig">;

export function useQuotes(guildId: string) {
    const [quotes, setQuotes] = useState<Quote[]>([]);
    const [loading, setLoading] = useState(false);

    const refresh = useCallback(async () => {
        setLoading(true);
        try {
            setQuotes(await api.getQuotesByGuild(guildId));
        } finally {
            setLoading(false);
        }
    }, [guildId]);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    return { quotes, loading, refresh };
}
```

## Authentication Flow

1. User clicks "Login with Discord"
2. Redirect to `/api/auth/discord`
3. Discord OAuth authorization
4. Redirect to `/api/auth/discord/callback`
5. Exchange code for Discord tokens
6. Fetch user profile from Discord
7. Cache Discord profile, access token, and guild permissions in Redis
8. Issue 20-minute JWT token
9. Set HttpOnly `jwt` and `refresh_session` cookies
10. Set CSRF cookie
11. Redirect to `/dashboard`

### Protected Routes

All dashboard pages require authentication:

```typescript
// lib/auth/authUtils.ts
export async function authenticateUser(req: NextRequest) {
    const token = req.cookies.get('jwt')?.value;
    if (!token) throw new Error('Unauthorized');
    
    const decoded = verifyJWT(token);
    return decoded;
}
```

### Guild Access Control

Users can only access guilds where they have administrator permissions:

```typescript
export async function checkGuildAccess(userId: string, guildId: string) {
    const guilds = await defaultCacheManager.get(CACHE_KEYS.userGuilds(userId));
    return isGuildAdmin(guilds, guildId);
}
```

The API reads the same Redis cache key for guild-scoped route authorization. If API and dashboard do not share Redis, login can succeed while guild-scoped API routes return 403.

## API Integration

### External API Proxy

The dashboard proxies requests to the Express API via `/api/external/[...proxy]`:

```typescript
// app/api/external/[...proxy]/route.ts
export async function POST(req: NextRequest) {
    const user = await authenticateUser(req);
    const csrfToken = req.headers.get('x-csrf-token');
    
    // Proxy to Express API
    const response = await fetch(`${API_URL}/${path}`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${jwt}`,
            'x-csrf-token': csrfToken,
        },
        body: await req.text()
    });
    
    return response;
}
```

### Type-Safe API Calls

Use generated OpenAPI schema helpers through domain wrappers in `lib/api/`:

```typescript
// lib/api/quotes.ts
import type { ApiSchema } from "@zeffuro/fakegaming-common/api-helpers";
import { API_ENDPOINTS, apiRequest } from "./core";

type QuoteResponse = ApiSchema<"QuoteConfig">;

export const quotesApi = {
    getQuotesByGuild: (guildId: string) =>
        apiRequest<QuoteResponse[]>(`${API_ENDPOINTS.QUOTES}/guild/${encodeURIComponent(guildId)}`),
};
```

## CSRF Protection

All mutating requests require CSRF tokens. Use `apiRequest` for dashboard client calls so cookies, JSON serialization, and CSRF headers stay consistent:

```typescript
await apiRequest<QuoteResponse>(API_ENDPOINTS.QUOTES, {
    method: "POST",
    body: data,
});
```

## Deployment

### Docker

Using docker-compose (from repository root):

```bash
docker-compose up -d dashboard
```

### Manual

```bash
# Build
pnpm build

# Start
pnpm start

# Or with PM2
pm2 start npm --name dashboard -- start
```

### Environment Variables (Production)

Create `.env` (not `.env.development`):

```bash
PORT=3000
PUBLIC_URL=https://yourdomain.com

DISCORD_CLIENT_ID=...
DISCORD_CLIENT_SECRET=...

API_URL=http://api:3001/api
REDIS_URL=redis://redis:6379

JWT_SECRET=... (strong random string)
JWT_AUDIENCE=fakegaming-dashboard
JWT_ISSUER=fakegaming

DASHBOARD_ADMINS=...
```

### Reverse Proxy (Nginx)

```nginx
server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Testing

```bash
# Run tests
pnpm test

# Watch mode
pnpm test --watch

# Coverage
pnpm test:coverage
```

Test files are located in `__tests__` directories alongside source files.

## Troubleshooting

### Login Fails

1. Check `DISCORD_CLIENT_ID` and `DISCORD_CLIENT_SECRET`
2. Verify redirect URI in Discord Developer Portal matches `${PUBLIC_URL}/api/auth/discord/callback`
3. Check `JWT_SECRET` matches between dashboard and API
4. Clear browser cookies and try again

### 403 Forbidden on Guild Pages

1. Verify user has administrator permissions in the guild
2. Verify API and dashboard share the same Redis instance
3. Check `user:<discordId>:guilds` exists in Redis
4. Logout and login again, or request `/api/guilds?refresh=1`, to refresh guild data

### Dashboard Shows Blank

1. Check browser console for JavaScript errors
2. Verify API is accessible from dashboard
3. Check Next.js build succeeded
4. Clear `.next` cache and rebuild

See [TROUBLESHOOTING.md](../../TROUBLESHOOTING.md) for more issues.

## Development Tips

### Hot Reload

In development mode, changes to files trigger hot reload:
- Page changes reload instantly
- API route changes require manual refresh
- Component changes update without full page reload

### Debugging

Enable verbose logging:

```bash
LOG_LEVEL=debug pnpm start:dev
```

Check API requests in browser DevTools Network tab.

### Type Safety

The dashboard uses generated types from the Express API OpenAPI spec. Regenerate types after API changes:

```bash
# From repository root
pnpm run gen:api-types
```

## Related Documentation

- [API_GUIDE.md](../../API_GUIDE.md) - Express API documentation
- [ARCHITECTURE.md](../../ARCHITECTURE.md) - Architecture patterns
- [SECURITY.md](../../SECURITY.md) - Security policies
- [DEPLOYMENT.md](../../DEPLOYMENT.md) - Deployment guide
- [ENVIRONMENT.md](../../ENVIRONMENT.md) - Environment configuration

## Support

- Issues: [GitHub Issues](https://github.com/Zeffuro/fakegaming-bot/issues)
- Maintainer: [@Zeffuro](https://github.com/Zeffuro)
