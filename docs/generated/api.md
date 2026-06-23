# API Routes

Generated from `packages/api/openapi.json`. Do not edit by hand.

Operations: 124

| Tag | Method | Path | Summary | Auth |
| --- | --- | --- | --- | --- |
| Anime | GET | `/anime` | List anime channel subscriptions | Bearer |
| Anime | POST | `/anime` | Subscribe a guild channel to anime episode notifications | Bearer |
| Anime | PATCH | `/anime/{id}` | Pause or resume an anime subscription | Bearer |
| Anime | DELETE | `/anime/{id}` | Delete an anime subscription | Bearer |
| Anime | GET | `/anime/search` | Search AniList media | Bearer |
| Anime | GET | `/anime/season` | List AniList titles for a season | Bearer |
| Audit | GET | `/auditEvents` | List recent admin audit events | Bearer |
| Auth | POST | `/auth/login` | Login and get a JWT token | None |
| Birthdays | GET | `/birthdays` | List all birthdays | Bearer |
| Birthdays | POST | `/birthdays` | Add or update a birthday | Bearer |
| Birthdays | GET | `/birthdays/{userId}/{guildId}` | Get a birthday by userId and guildId | Bearer |
| Birthdays | PUT | `/birthdays/{userId}/{guildId}` | Update a birthday by userId and guildId | Bearer |
| Birthdays | DELETE | `/birthdays/{userId}/{guildId}` | Remove a birthday by userId and guildId | Bearer |
| Bluesky | GET | `/bluesky` | List all Bluesky post configs | Bearer |
| Bluesky | POST | `/bluesky` | Create a new Bluesky post config | Bearer |
| Bluesky | GET | `/bluesky/{id}` | Get a Bluesky post config by id | Bearer |
| Bluesky | PUT | `/bluesky/{id}` | Update a Bluesky post config by id | Bearer |
| Bluesky | DELETE | `/bluesky/{id}` | Delete a Bluesky post config by id | Bearer |
| Bluesky | GET | `/bluesky/exists` | Check if a Bluesky post config exists | Bearer |
| Bluesky | GET | `/bluesky/profile` | Resolve public Bluesky profile metadata | Bearer |
| Dashboard | GET | `/dashboard/guild/{guildId}/summary` | Get dashboard summary counts for a guild | Bearer |
| DisabledCommands | GET | `/disabledCommands` | List disabled commands (optionally filtered by guild) | Bearer |
| DisabledCommands | POST | `/disabledCommands` | Add a new disabled command | Bearer |
| DisabledCommands | GET | `/disabledCommands/{id}` | Get a disabled command by id | Bearer |
| DisabledCommands | DELETE | `/disabledCommands/{id}` | Delete a disabled command by id | Bearer |
| DisabledCommands | GET | `/disabledCommands/check` | Check if a command is disabled in a guild | Bearer |
| DisabledModules | GET | `/disabledModules` | List disabled modules (optionally filtered by guild) | Bearer |
| DisabledModules | POST | `/disabledModules` | Add a new disabled module | Bearer |
| DisabledModules | GET | `/disabledModules/{id}` | Get a disabled module by id | Bearer |
| DisabledModules | DELETE | `/disabledModules/{id}` | Delete a disabled module by id | Bearer |
| DisabledModules | GET | `/disabledModules/check` | Check if a module is disabled in a guild | Bearer |
| Discord | GET | `/discord/guilds/{guildId}/members/search` | Search guild members by query (autocomplete) | Bearer |
| Discord | POST | `/discord/users/resolve` | Resolve minimal user profiles and guild nicknames | Bearer |
| IntegrationHealth | GET | `/integrationHealth` | List integration health for a guild | Bearer |
| IntegrationHealth | GET | `/integrationHealth/admin` | List integration health across guilds | Bearer |
| Jobs | GET | `/jobs` | List allowed jobs and their capabilities | Bearer |
| Jobs | POST | `/jobs/{name}/run` | Manually trigger a job by name | Bearer |
| Jobs | GET | `/jobs/{name}/status` | Get recent runs for a job | Bearer |
| Jobs | GET | `/jobs/birthdays/today` | Get number of birthday notifications processed today | Bearer |
| Jobs | GET | `/jobs/heartbeat/last` | Get the last heartbeat payload/time | Bearer |
| Notifications | GET | `/notifications/admin` | List recent notification delivery records | Bearer |
| Notifications | GET | `/notifications/guild/{guildId}` | List recent notification delivery records for a guild | Bearer |
| PatchNotes | GET | `/patchNotes` | List all patch notes | Bearer |
| PatchNotes | POST | `/patchNotes` | Upsert (add or update) a patch note | Bearer |
| PatchNotes | GET | `/patchNotes/{game}` | Get the latest patch note for a game | Bearer |
| PatchNotes | GET | `/patchNotes/supportedGames` | List supported games for patch notes | Bearer |
| PatchSubscriptions | GET | `/patchSubscriptions` | List all patch subscriptions | Bearer |
| PatchSubscriptions | POST | `/patchSubscriptions` | Add a new patch subscription | Bearer |
| PatchSubscriptions | PUT | `/patchSubscriptions` | Upsert a patch subscription | Bearer |
| PatchSubscriptions | GET | `/patchSubscriptions/{id}` | Get a patch subscription by id | Bearer |
| PatchSubscriptions | PATCH | `/patchSubscriptions/{id}` | Pause or resume a patch subscription | Bearer |
| PatchSubscriptions | DELETE | `/patchSubscriptions/{id}` | Delete a patch subscription by id | Bearer |
| Quotes | GET | `/quotes` | List all quotes | Bearer |
| Quotes | POST | `/quotes` | Add a new quote | Bearer |
| Quotes | GET | `/quotes/{id}` | Get a quote by id | Bearer |
| Quotes | DELETE | `/quotes/{id}` | Delete a quote by id | Bearer |
| Quotes | GET | `/quotes/guild/{guildId}` | Get quotes by guild | Bearer |
| Quotes | GET | `/quotes/guild/{guildId}/author/{authorId}` | Get quotes by author in guild | Bearer |
| Quotes | GET | `/quotes/search` | Search quotes by text and guildId | Bearer |
| Reminders | GET | `/reminders` | List all reminders | Bearer |
| Reminders | POST | `/reminders` | Add a new reminder | Bearer |
| Reminders | GET | `/reminders/{id}` | Get a reminder by id | Bearer |
| Reminders | DELETE | `/reminders/{id}` | Remove a reminder by id | Bearer |
| Riot Links | GET | `/riotLinks` | List linked Riot accounts | Bearer |
| Riot Links | GET | `/riotLinks/{discordId}` | Get linked Riot account by Discord user ID | Bearer |
| Riot Links | PUT | `/riotLinks/{discordId}` | Create or update a linked Riot account for a Discord user | Bearer |
| Riot Links | DELETE | `/riotLinks/{discordId}` | Remove a linked Riot account for a Discord user | Bearer |
| Riot Links | GET | `/riotLinks/me` | Get the authenticated dashboard user's linked Riot account | Bearer |
| Servers | GET | `/servers` | List all servers | Bearer |
| Servers | POST | `/servers` | Create a new server | Bearer |
| Servers | GET | `/servers/{serverId}` | Get a server by ID | Bearer |
| Servers | PUT | `/servers/{serverId}` | Update a server by ID | Bearer |
| Servers | DELETE | `/servers/{serverId}` | Delete a server by ID | Bearer |
| SteamApps | GET | `/steamApps/resolve` | Resolve one Steam app from a name, App ID, or Steam app URL | Bearer |
| SteamApps | GET | `/steamApps/search` | Search Steam apps by name, App ID, or Steam app URL | Bearer |
| SteamNewsSubscriptions | GET | `/steamNewsSubscriptions` | List Steam news subscriptions | Bearer |
| SteamNewsSubscriptions | POST | `/steamNewsSubscriptions` | Add a Steam news subscription | Bearer |
| SteamNewsSubscriptions | PUT | `/steamNewsSubscriptions` | Upsert a Steam news subscription | Bearer |
| SteamNewsSubscriptions | GET | `/steamNewsSubscriptions/{id}` | Get a Steam news subscription by id | Bearer |
| SteamNewsSubscriptions | PATCH | `/steamNewsSubscriptions/{id}` | Pause or resume a Steam news subscription | Bearer |
| SteamNewsSubscriptions | DELETE | `/steamNewsSubscriptions/{id}` | Delete a Steam news subscription by id | Bearer |
| TikTok | GET | `/tiktok` | List all TikTok stream configs | Bearer |
| TikTok | POST | `/tiktok` | Create a new TikTok stream config | Bearer |
| TikTok | GET | `/tiktok/{id}` | Get a TikTok stream config by id | Bearer |
| TikTok | PUT | `/tiktok/{id}` | Update a TikTok stream config by id | Bearer |
| TikTok | DELETE | `/tiktok/{id}` | Delete a TikTok stream config by id | Bearer |
| TikTok | GET | `/tiktok/exists` | Check if a TikTok stream config exists | Bearer |
| TikTok | GET | `/tiktok/live` | Get current live status of a TikTok user | Bearer |
| Twitch | GET | `/twitch` | List all Twitch stream configs | Bearer |
| Twitch | POST | `/twitch` | Create a new Twitch stream config | Bearer |
| Twitch | GET | `/twitch/{id}` | Get a Twitch stream config by id | Bearer |
| Twitch | PUT | `/twitch/{id}` | Update a Twitch stream config by id | Bearer |
| Twitch | DELETE | `/twitch/{id}` | Delete a Twitch stream config by id | Bearer |
| Twitch | GET | `/twitch/exists` | Check if a Twitch stream config exists | Bearer |
| Twitch | GET | `/twitch/verify` | Verify a Twitch username exists | Bearer |
| UserNotes | GET | `/userNotes` | List notes for the authenticated dashboard user | Bearer |
| UserNotes | POST | `/userNotes` | Create a note for the authenticated dashboard user | Bearer |
| UserNotes | GET | `/userNotes/{id}` | Get one note for the authenticated dashboard user | Bearer |
| UserNotes | PUT | `/userNotes/{id}` | Update one note for the authenticated dashboard user | Bearer |
| UserNotes | DELETE | `/userNotes/{id}` | Delete one note for the authenticated dashboard user | Bearer |
| UserReminders | GET | `/userReminders` | List reminders for the authenticated dashboard user | Bearer |
| UserReminders | POST | `/userReminders` | Create a reminder for the authenticated dashboard user | Bearer |
| UserReminders | GET | `/userReminders/{id}` | Get one reminder for the authenticated dashboard user | Bearer |
| UserReminders | DELETE | `/userReminders/{id}` | Delete one reminder for the authenticated dashboard user | Bearer |
| UserReminders | PATCH | `/userReminders/{id}/snooze` | Snooze one reminder for the authenticated dashboard user | Bearer |
| Users | GET | `/users` | List all users | Bearer |
| Users | POST | `/users` | Create a new user | Bearer |
| Users | GET | `/users/{discordId}` | Get a user by Discord ID | Bearer |
| Users | PUT | `/users/{discordId}` | Update a user by Discord ID | Bearer |
| Users | DELETE | `/users/{discordId}` | Delete a user by Discord ID | Bearer |
| Users | PUT | `/users/{discordId}/defaultReminderTimeSpan` | Set default reminder timespan for a user | Bearer |
| Users | PUT | `/users/{discordId}/timezone` | Set timezone for a user | Bearer |
| UserSettings | GET | `/userSettings` | Get personal settings for the authenticated dashboard user | Bearer |
| UserSettings | PATCH | `/userSettings` | Update personal settings for the authenticated dashboard user | Bearer |
| YouTube | GET | `/youtube` | List all YouTube video configs | Bearer |
| YouTube | POST | `/youtube` | Create a new YouTube video config | Bearer |
| YouTube | PUT | `/youtube` | Upsert a YouTube video config by channel | Bearer |
| YouTube | GET | `/youtube/{id}` | Get a YouTube video config by id | Bearer |
| YouTube | PUT | `/youtube/{id}` | Update a YouTube video config by id | Bearer |
| YouTube | DELETE | `/youtube/{id}` | Delete a YouTube video config by id | Bearer |
| YouTube | GET | `/youtube/channel` | Get a YouTube video config by channel | Bearer |
| YouTube | POST | `/youtube/channel` | Create or update a YouTube video config by channel | Bearer |
| YouTube | GET | `/youtube/metadata` | Resolve public YouTube channel metadata from the channel Atom feed | Bearer |
| YouTube | GET | `/youtube/resolve` | Resolve a YouTube channel identifier (handle/username/UC-Id) to a channelId | Bearer |
