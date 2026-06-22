# Bot Commands

Generated from `packages/common/src/manifest/bot-manifest.ts`. Do not edit by hand.

Total: 49 commands; 45 slash; 2 user context; 2 message context.

## Anime

| Type | Command | Description | Permissions |
| --- | --- | --- | --- |
| Slash | `/anime` | Search anime, manage subscriptions, and view upcoming episodes | All users |
| Slash | `/manga` | Search manga, manhwa, webtoons, and light novels on AniList | All users |

## Birthdays

| Type | Command | Description | Permissions |
| --- | --- | --- | --- |
| Slash | `/birthday` | Show your or another user's birthday | All users |
| Slash | `/birthdays` | Show upcoming birthdays in this server | All users |
| Slash | `/remove-birthday` | Remove your birthday or another user's birthday (admins only) | All users |
| Slash | `/set-birthday` | Set your birthday and the channel to post in | All users |
| User context | `Show Birthday` | Show a user birthday from the user context menu | All users |

## Bluesky

| Type | Command | Description | Permissions |
| --- | --- | --- | --- |
| Slash | `/add-bluesky-account` | Add a Bluesky account for post notifications | Administrator |
| Slash | `/manage-bluesky-accounts` | List, test, pause, resume, or remove Bluesky post notifications | Administrator |

## General

| Type | Command | Description | Permissions |
| --- | --- | --- | --- |
| Slash | `/calendar` | Show upcoming birthdays and your reminders | All users |
| Slash | `/help` | List all available commands and their descriptions. | All users |
| Slash | `/poll` | Create a simple poll for users to vote on | All users |
| Slash | `/roll` | Roll dice or generate a random number | All users |
| Slash | `/spin` | Spin the wheel to pick someone! | All users |
| Slash | `/test-notification` | Send a sample notification to a channel | All users |
| Slash | `/time` | Convert a time into Discord timestamp formats | All users |
| Slash | `/weather` | Get the current weather and a short forecast for a specified location | All users |

## League

| Type | Command | Description | Permissions |
| --- | --- | --- | --- |
| Slash | `/league-history` | Get recent League of Legends match history by Riot ID or linked user | All users |
| Slash | `/league-stats` | Get League of Legends stats by Riot ID or linked user | All users |
| Slash | `/link-riot` | Link your Discord account or another user to a Riot account | All users |
| Slash | `/riot-links` | Manage linked Riot accounts | All users |
| Slash | `/tft-history` | Get recent Teamfight Tactics match history by Riot ID or linked user | All users |
| Slash | `/tft-stats` | Get Teamfight Tactics ranked stats by Riot ID or linked user | All users |

## Patchnotes

| Type | Command | Description | Permissions |
| --- | --- | --- | --- |
| Slash | `/get-patchnotes` | Get the latest patch notes for a game | All users |
| Slash | `/manage-patchnotes` | List, test, pause, resume, or remove patch note subscriptions | All users |
| Slash | `/patchnotes-history` | Show stored patch note history for a game | All users |
| Slash | `/subscribe-patchnotes` | Subscribe a channel to patch notes for a game | All users |

## Quotes

| Type | Command | Description | Permissions |
| --- | --- | --- | --- |
| Slash | `/add-quote` | Add a quote | All users |
| Slash | `/delete-quote` | Delete a quote you added or authored | All users |
| Slash | `/quote-leaderboard` | Show the most quoted users in this server | All users |
| Slash | `/quotes` | Get all quotes for a user | All users |
| Slash | `/random-quote` | Get a random quote from the server | All users |
| Slash | `/search-quote` | Search quotes by text | All users |
| Message context | `Save as Quote` | Save a message as a quote from the message context menu | All users |
| User context | `Show Quotes` | Show quotes for a user from the user context menu | All users |

## Reminders

| Type | Command | Description | Permissions |
| --- | --- | --- | --- |
| Slash | `/delete-reminder` | Delete one of your pending reminders | All users |
| Slash | `/reminders` | List your pending reminders | All users |
| Slash | `/set-reminder` | Set a reminder | All users |
| Slash | `/set-timezone` | Set your timezone | All users |
| Slash | `/snooze-reminder` | Snooze one of your pending reminders | All users |
| Message context | `Remind Me in 1h` | Set a one-hour reminder for a message from the message context menu | All users |

## Tiktok

| Type | Command | Description | Permissions |
| --- | --- | --- | --- |
| Slash | `/add-tiktok-stream` | Add a TikTok account for live notifications | Administrator |
| Slash | `/manage-tiktok-streams` | List, test, pause, resume, or remove TikTok live notifications | Administrator |

## Twitch

| Type | Command | Description | Permissions |
| --- | --- | --- | --- |
| Slash | `/add-twitch-stream` | Add a Twitch stream for notifications | Administrator |
| Slash | `/manage-twitch-streams` | List, test, pause, resume, or remove Twitch stream notifications | Administrator |
| Slash | `/stream-status` | Check whether a Twitch channel is live | All users |

## Youtube

| Type | Command | Description | Permissions |
| --- | --- | --- | --- |
| Slash | `/add-youtube-channel` | Add a Youtube Channel for new video notifications | Administrator |
| Slash | `/manage-youtube-channels` | List, test, pause, resume, or remove YouTube video notifications | Administrator |
| Slash | `/youtube-latest` | Show the latest video from a YouTube channel ID | All users |
