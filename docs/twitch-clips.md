# Twitch command clips

Viewers type a configurable command such as `!clip` in Twitch chat. The API
creates a clip on Twitch, waits for it to become available, and posts its link
and preview in the configured Discord channel. No Discord webhook is needed.
Clip settings are independent of live-stream notifications.

## Credentials and environment

Use a dedicated Twitch account for the bot. Twitch supports ordinary accounts
operated by chatbots; verified bot status is not needed for this feature.
The application's owner and the authorized bot account can be different. For
convenient administration, register/manage the application under your personal
account, then authorize as `fakegamingbot` when connecting it in the dashboard.

1. Sign into the [Twitch developer console](https://dev.twitch.tv/console/apps).
   Manage the existing application used for live notifications, or register a
   confidential application in the Chat Bot category. Twitch requires two-factor
   authentication on the account registering the application.
2. Add the exact dashboard callback URL to **OAuth Redirect URLs**:
   `https://your-dashboard.example/api/auth/twitch/callback`. For development,
   also add `http://localhost:3000/api/auth/twitch/callback`.
3. Copy **Client ID** to `TWITCH_CLIENT_ID`. The **New Secret** button generates
   the value for `TWITCH_CLIENT_SECRET`. Reuse existing valid credentials;
   regenerating a secret invalidates the old one.
4. Set `TWITCH_BOT_USERNAME` to the bot account's Twitch login, without `@` or a
   URL. Set a stable, random `TWITCH_TOKEN_ENC_KEY` for token encryption. Generate
   one locally with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`.
   Keep this key with your deployment secrets and database backups. Changing it
   requires reconnecting the bot account.
5. `TWITCH_REDIRECT_URI` is optional when `DASHBOARD_URL` already identifies the
   dashboard origin. Its default is that origin plus `/api/auth/twitch/callback`.
   If set explicitly, it must match a registered OAuth redirect URL exactly.

For production Docker Compose, put these settings in the repository's root
`.env`; `docker-compose.yml` passes them to the API service. The dashboard and
Discord bot containers do not need Twitch secrets. The existing Compose setting
`PRODUCTION_DASHBOARD_URL` supplies the dashboard origin.

For manual API development, put them in `packages/api/.env.development` (or
`packages/api/.env` for a manual production run). Local Docker uses
`packages/api/.env.development`; `docker-compose.local.yml` supplies the localhost
callback, with an optional `TWITCH_REDIRECT_URI` override from root `.env`.
Enable `JOBS_ENABLED=1`; SQLite development also needs `JOBS_BACKEND=memory`.
Production Compose already enables jobs.

No access token or refresh token needs to be pasted into an environment file.
The dashboard connection performs OAuth and stores both tokens encrypted in the
database. The API refreshes tokens automatically and validates their identity,
client ID, scopes, and continuing validity.

## Connect and configure

1. Restart/recreate the API after changing its environment. Sign into the
   dashboard using a Discord account in `DASHBOARD_ADMINS`.
2. Open **Admin > Twitch** (`/dashboard/admin/twitch`) and choose **Connect Twitch bot**. Authorize as
   the account named in `TWITCH_BOT_USERNAME`. Twitch may ask which account to
   use; signing into the streamer account instead will be rejected.
3. Approve `user:read:chat` and `clips:edit`. This authorizes receiving chat and
   creating clips as the bot. The integration does not need to write Twitch chat
   or moderate it.
4. Open the server's **Twitch** dashboard page. Add the Twitch channel, Discord
   destination, command and optional aliases. Choose who may trigger it, the
   cooldown, and duration. Enable the configuration.
5. Allow up to 30 seconds for configuration changes to reach the chat listener.
   When the broadcaster is live with clips enabled, type the command. Clip
   creation is asynchronous; the link normally appears after a short delay.

Commands are case-insensitive and match the first whole word: `!clip Nice play`
triggers `!clip`, while `!clipper` does not. The rest of the message is currently
ignored. Subscriber access includes founders, moderators and the broadcaster.
Moderator access includes the broadcaster. Aliases share the channel cooldown.
Repeated events do not request another clip.

If several Discord servers configure the same Twitch channel and match the same
command, one clip is created and delivered to each eligible destination. The
longest configured cooldown and duration among those matching configurations
apply to that clip. The cooldown covers the whole Twitch channel, including
different commands and aliases.

## Streamer authorization and managers

`channel:bot` is an OAuth permission granted by the broadcaster signing into
Twitch and authorizing an application. A manager or editor signing in as their
own account grants permissions for their own account, not the broadcaster's.
For app-token chat subscriptions, Twitch also accepts the bot account having
moderator status in the target channel as an alternative to `channel:bot`.

This implementation receives EventSub through a WebSocket with the bot's user
token. Twitch's authorization requirements for that transport do **not** require
`channel:bot`, so streamers do not need that extra OAuth step. Managers with the
required Discord server dashboard permissions can configure destinations and
commands after the instance operator connects the shared bot account.

## Operations and limits

- Run one API instance with the clip listener enabled. This release does not
  elect a chat-listener leader across API replicas.
- The listener supports up to 100 distinct Twitch channels, respecting the
  normal account chat join limit. Multiple Discord destinations for the same
  Twitch channel share one subscription.
- Twitch must permit the bot account to clip the stream. Disabled clips,
  follower/subscriber clipping restrictions, bans/timeouts, and offline streams
  can cause Twitch to reject creation.
- Shared Chat messages originating from another broadcaster are ignored so they
  cannot clip the wrong stream.
- Configuration, tokens, cooldowns and requests survive restarts. Known clip IDs
  are retried for Discord delivery without creating another clip. An interrupted
  creation with an unknown result is not recreated automatically.
- Twitch does not replay chat events lost during an outage. A command typed while
  the listener is disconnected must be typed again after it reconnects.
- Delivery retries stop after 24 hours; completed/failed request records are
  retained for seven days. Discord notification history remains in the existing
  notification store. Stored delivery IDs and Discord nonces reduce duplicates;
  delivery is not an atomic transaction with the external Discord API.
- A revoked authorization requires reconnecting the bot account. The dashboard
  shows persisted connection state and live listener health separately.

Official references: [Register an app](https://dev.twitch.tv/docs/authentication/register-app/),
[Chat message authorization](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#channel-chat-message),
[EventSub WebSockets](https://dev.twitch.tv/docs/eventsub/handling-websocket-events/),
[Create Clip](https://dev.twitch.tv/docs/api/reference/#create-clip),
[Chatbot limits](https://dev.twitch.tv/docs/chat/).
