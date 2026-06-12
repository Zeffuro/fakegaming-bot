# Security Policy

## Reporting a Vulnerability

Report vulnerabilities privately.

- Use GitHub Security Advisories for `Zeffuro/fakegaming-bot` when available.
- If advisories are unavailable, contact the maintainer privately. Do not include exploitable details in a public issue.

## Current Auth Model

- Dashboard login uses Discord OAuth at `/api/auth/discord/callback`.
- The dashboard sets an HttpOnly `jwt` cookie with a 20-minute lifetime.
- The dashboard sets an HttpOnly `refresh_session` cookie with a 14-day idle lifetime and a 30-day absolute lifetime.
- Refresh sessions are stored server-side in Redis under hashed keys.
- The `csrf` cookie is readable by client code and must match the `x-csrf-token` header for mutating requests.
- API requests from the dashboard are proxied through `/api/external/[...proxy]`, where the dashboard forwards `Authorization: Bearer <jwt>` to the Express API.
- Bot and trusted service calls use `X-Service-Token`, backed by `SERVICE_API_TOKEN`.

## Required Shared Cache

Redis is required when the API and dashboard run as separate processes or containers. It can be the bundled Docker Redis service or a hosted Redis instance; the API and dashboard just need the same `REDIS_URL`.

The dashboard stores refresh sessions, Discord access tokens, user profiles, and Discord guild permission lists in Redis. The API authorizes guild-scoped routes, such as birthdays and anime subscriptions, from the shared `user:<discordId>:guilds` cache key.

If Redis is missing or API and dashboard use different Redis instances, dashboard login can still issue cookies, but guild-scoped API routes can return `403 Not authorized for this guild`.

## Secret Handling

Do not paste or commit live cookies, JWTs, OAuth tokens, service tokens, API keys, database URLs, or `.env` contents.

If a dashboard cookie or token is exposed:

1. Log out of the dashboard to revoke the current refresh session when possible.
2. Delete the affected Redis refresh-session key, or clear all dashboard refresh-session keys if the exact key is not known.
3. Rotate `JWT_SECRET` if a signed JWT may have been exposed and immediate invalidation is required.
4. Redeploy API and dashboard together after changing JWT settings.

If a service secret is exposed, rotate it immediately:

- `DISCORD_BOT_TOKEN`
- `DISCORD_CLIENT_SECRET`
- `JWT_SECRET`
- `SERVICE_API_TOKEN`
- `TWITCH_CLIENT_SECRET`
- `YOUTUBE_API_KEY`
- `RIOT_*` keys
- `OPENWEATHER_API_KEY`
- `POSTGRES_PASSWORD`

After rotation, update deployment secrets, restart affected services, and verify API, bot, and dashboard startup logs.

## Local Checks

- Run `pnpm run ci:check-env` before publishing changes.
- Keep `.env*` files untracked except `.env.example`.
- Keep API, dashboard, and bot environment values aligned for `JWT_SECRET`, `JWT_AUDIENCE`, `JWT_ISSUER`, and `SERVICE_API_TOKEN`.
