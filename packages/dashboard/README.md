# @zeffuro/fakegaming-bot-dashboard

Next.js dashboard for managing the fakegaming Discord bot.

## Overview

Web dashboard for guild administrators to configure and manage the bot without using Discord commands. Built with Next.js 15, React, and TypeScript.

## Features

### Authentication
- Discord OAuth2 login
- JWT-based session management
- HttpOnly cookies for security
- CSRF protection on all mutating requests
- Admin-only access control

### Guild Management
- View and select guilds where you have administrator permissions
- Per-guild configuration pages
- Real-time guild and channel data from Discord API

### Quote Management
- List all quotes in a guild
- Add new quotes
- Delete quotes
- Search and filter functionality
- Author/submitter resolution with Discord profile data

### Twitch Integration
- Configure Twitch stream notifications
- Set custom messages per stream
- Configure cooldown periods
- Set quiet hours (optional)
- View and edit existing configurations

### YouTube Integration
- Configure YouTube channel notifications
- Set custom messages per channel
- Configure cooldown periods
- Set quiet hours (optional)
- View and edit existing configurations

### TikTok Integration
- Configure TikTok account live notifications
- Manage notification settings
- View active configurations

### Command Management
- Disable/enable specific commands per guild
- Disable/enable entire modules per guild
- View all available commands
- Organized by module

### Patch Notes Management
- Subscribe channels to patch note announcements
- Support for multiple games (League, Valorant, TFT)
- Automatic announcements when new patches are released

## Technology Stack

- **Framework:** Next.js 15 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **UI Components:** Custom React components
- **Authentication:** Discord OAuth2 + JWT
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

# Optional: Redis (not required for development)
# REDIS_URL=redis://localhost:6379
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
pnpm generate:api-types
```

## Architecture

### App Router Structure

```
app/
├── api/                      # API routes (Next.js API)
│   ├── auth/                # Discord OAuth endpoints
│   │   ├── discord/         # OAuth initiation
│   │   │   └── callback/    # OAuth callback
│   │   ├── me/              # Get current user
│   │   └── logout/          # Logout endpoint
│   ├── external/            # Proxy to Express API
│   │   └── [...proxy]/      # Dynamic proxy route
│   ├── guilds/              # Guild data endpoints
│   └── health/              # Health check
├── dashboard/               # Dashboard pages
│   ├── admin/               # Admin-only pages
│   ├── quotes/              # Quote management
│   │   └── [guildId]/       # Guild-specific quotes
│   ├── twitch/              # Twitch config
│   │   └── [guildId]/
│   ├── youtube/             # YouTube config
│   │   └── [guildId]/
│   ├── tiktok/              # TikTok config
│   │   └── [guildId]/
│   ├── commands/            # Command management
│   │   └── [guildId]/
│   └── patchnotes/          # Patch subscriptions
│       └── [guildId]/
├── login/                   # Login page
└── layout.tsx               # Root layout
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
├── hooks/                   # Custom React hooks
│   ├── useAuth.ts          # Authentication hook
│   ├── useGuilds.ts        # Guild data hook
│   ├── useQuotes.ts        # Quotes data hook
│   ├── useTwitch.ts        # Twitch config hook
│   └── useYouTube.ts       # YouTube config hook
├── ui/                      # UI components
│   ├── Button.tsx
│   ├── Card.tsx
│   ├── Input.tsx
│   └── ...
└── layout/                  # Layout components
    ├── Sidebar.tsx
    └── Navigation.tsx
```

### Custom Hooks Pattern

Data fetching and state management is handled by custom hooks:

```typescript
// components/hooks/useQuotes.ts
export function useQuotes(guildId: string) {
    const [quotes, setQuotes] = useState([]);
    const [loading, setLoading] = useState(true);

    const addQuote = async (quote) => {
        // API call with CSRF
    };

    const deleteQuote = async (id) => {
        // API call with CSRF
    };

    return { quotes, loading, addQuote, deleteQuote };
}
```

Usage in page components:

```typescript
// app/dashboard/quotes/[guildId]/page.tsx
export default function QuotesPage({ params }) {
    const { quotes, loading, addQuote } = useQuotes(params.guildId);
    
    if (loading) return <Spinner />;
    
    return <QuotesList quotes={quotes} onAdd={addQuote} />;
}
```

## Authentication Flow

1. User clicks "Login with Discord"
2. Redirect to `/api/auth/discord`
3. Discord OAuth authorization
4. Redirect to `/api/auth/discord/callback`
5. Exchange code for Discord tokens
6. Fetch user profile from Discord
7. Issue JWT token
8. Set HttpOnly cookie with JWT
9. Set CSRF cookie
10. Redirect to `/dashboard`

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
    const guilds = await getDiscordGuilds(userId);
    const guild = guilds.find(g => g.id === guildId);
    
    if (!guild || !hasAdminPerms(guild.permissions)) {
        throw new Error('Forbidden');
    }
}
```

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

Use generated types from OpenAPI spec:

```typescript
import type { paths } from '@zeffuro/fakegaming-common/types/api';

type QuotesResponse = paths['/quotes']['get']['responses']['200']['content']['application/json'];

async function getQuotes(guildId: string): Promise<QuotesResponse> {
    const res = await fetch(`/api/external/quotes?guildId=${guildId}`);
    return res.json();
}
```

## CSRF Protection

All mutating requests require CSRF tokens:

```typescript
// Get CSRF token from cookie
const csrfToken = document.cookie
    .split('; ')
    .find(row => row.startsWith('csrf='))
    ?.split('=')[1];

// Send with request
await fetch('/api/external/quotes', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': csrfToken
    },
    credentials: 'include',
    body: JSON.stringify(data)
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
2. Check guild cache is not stale
3. Logout and login again to refresh guild data

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
