// AUTO-GENERATED FILE. Do not edit manually.
// Run: pnpm exec tsx scripts/generate-bot-manifest.ts

export interface BotModuleDef { name: string; title: string; description: string; }
export type BotCommandType = 'chatInput' | 'user' | 'message';
export interface BotCommand { name: string; description: string; module?: string | null; permissions?: string | null; dm_permission?: boolean | null; default_member_permissions?: string | null; testOnly?: boolean | null; type?: BotCommandType | null; }
export interface BotModuleNode { module: BotModuleDef; commands: ReadonlyArray<BotCommand>; }

export const BOT_MODULES: ReadonlyArray<BotModuleDef> = [
    {
        "name": "anime",
        "title": "Anime",
        "description": "Anime module"
    },
    {
        "name": "birthdays",
        "title": "Birthdays",
        "description": "Birthdays module"
    },
    {
        "name": "bluesky",
        "title": "Bluesky",
        "description": "Bluesky module"
    },
    {
        "name": "general",
        "title": "General",
        "description": "General module"
    },
    {
        "name": "league",
        "title": "League",
        "description": "League module"
    },
    {
        "name": "patchnotes",
        "title": "Patchnotes",
        "description": "Patchnotes module"
    },
    {
        "name": "quotes",
        "title": "Quotes",
        "description": "Quotes module"
    },
    {
        "name": "reminders",
        "title": "Reminders",
        "description": "Reminders module"
    },
    {
        "name": "shared",
        "title": "Shared",
        "description": "Shared module"
    },
    {
        "name": "tiktok",
        "title": "Tiktok",
        "description": "Tiktok module"
    },
    {
        "name": "twitch",
        "title": "Twitch",
        "description": "Twitch module"
    },
    {
        "name": "youtube",
        "title": "Youtube",
        "description": "Youtube module"
    },
    {
        "name": "steam",
        "title": "Steam",
        "description": "Steam game news notification commands"
    }
] as const;

export const BOT_COMMANDS: ReadonlyArray<BotCommand> = [
    {
        "name": "anime",
        "description": "Search anime, manage subscriptions, and view upcoming episodes",
        "module": "anime",
        "permissions": null,
        "dm_permission": null,
        "default_member_permissions": null,
        "testOnly": null,
        "type": null
    },
    {
        "name": "manga",
        "description": "Search manga, manhwa, webtoons, and light novels on AniList",
        "module": "anime",
        "permissions": null,
        "dm_permission": null,
        "default_member_permissions": null,
        "testOnly": null,
        "type": null
    },
    {
        "name": "birthday",
        "description": "Show your or another user's birthday",
        "module": "birthdays",
        "permissions": null,
        "dm_permission": null,
        "default_member_permissions": null,
        "testOnly": null,
        "type": null
    },
    {
        "name": "birthdays",
        "description": "Show upcoming birthdays in this server",
        "module": "birthdays",
        "permissions": null,
        "dm_permission": null,
        "default_member_permissions": null,
        "testOnly": null,
        "type": null
    },
    {
        "name": "remove-birthday",
        "description": "Remove your birthday or another user's birthday (admins only)",
        "module": "birthdays",
        "permissions": null,
        "dm_permission": null,
        "default_member_permissions": null,
        "testOnly": null,
        "type": null
    },
    {
        "name": "set-birthday",
        "description": "Set your birthday and the channel to post in",
        "module": "birthdays",
        "permissions": null,
        "dm_permission": null,
        "default_member_permissions": null,
        "testOnly": null,
        "type": null
    },
    {
        "name": "Show Birthday",
        "description": "Show a user birthday from the user context menu",
        "module": "birthdays",
        "permissions": null,
        "dm_permission": null,
        "default_member_permissions": null,
        "testOnly": null,
        "type": "user"
    },
    {
        "name": "add-bluesky-account",
        "description": "Add a Bluesky account for post notifications",
        "module": "bluesky",
        "permissions": "Administrator",
        "dm_permission": null,
        "default_member_permissions": null,
        "testOnly": null,
        "type": null
    },
    {
        "name": "manage-bluesky-accounts",
        "description": "List, test, pause, resume, or remove Bluesky post notifications",
        "module": "bluesky",
        "permissions": "Administrator",
        "dm_permission": null,
        "default_member_permissions": null,
        "testOnly": null,
        "type": null
    },
    {
        "name": "help",
        "description": "List all available commands and their descriptions.",
        "module": "general",
        "permissions": null,
        "dm_permission": null,
        "default_member_permissions": null,
        "testOnly": null,
        "type": null
    },
    {
        "name": "calendar",
        "description": "Show upcoming birthdays and your reminders",
        "module": "general",
        "permissions": null,
        "dm_permission": null,
        "default_member_permissions": null,
        "testOnly": null,
        "type": null
    },
    {
        "name": "poll",
        "description": "Create a simple poll for users to vote on",
        "module": "general",
        "permissions": null,
        "dm_permission": null,
        "default_member_permissions": null,
        "testOnly": null,
        "type": null
    },
    {
        "name": "roll",
        "description": "Roll dice or generate a random number",
        "module": "general",
        "permissions": null,
        "dm_permission": null,
        "default_member_permissions": null,
        "testOnly": null,
        "type": null
    },
    {
        "name": "spin",
        "description": "Spin the wheel to pick someone!",
        "module": "general",
        "permissions": null,
        "dm_permission": null,
        "default_member_permissions": null,
        "testOnly": null,
        "type": null
    },
    {
        "name": "test-notification",
        "description": "Send a sample notification to a channel",
        "module": "general",
        "permissions": null,
        "dm_permission": null,
        "default_member_permissions": null,
        "testOnly": null,
        "type": null
    },
    {
        "name": "time",
        "description": "Convert a time into Discord timestamp formats",
        "module": "general",
        "permissions": null,
        "dm_permission": null,
        "default_member_permissions": null,
        "testOnly": null,
        "type": null
    },
    {
        "name": "weather",
        "description": "Get the current weather and a short forecast for a specified location",
        "module": "general",
        "permissions": null,
        "dm_permission": null,
        "default_member_permissions": null,
        "testOnly": null,
        "type": null
    },
    {
        "name": "league-history",
        "description": "Get recent League of Legends match history by Riot ID or linked user",
        "module": "league",
        "permissions": null,
        "dm_permission": null,
        "default_member_permissions": null,
        "testOnly": null,
        "type": null
    },
    {
        "name": "league-stats",
        "description": "Get League of Legends stats by Riot ID or linked user",
        "module": "league",
        "permissions": null,
        "dm_permission": null,
        "default_member_permissions": null,
        "testOnly": null,
        "type": null
    },
    {
        "name": "link-riot",
        "description": "Link your Discord account or another user to a Riot account",
        "module": "league",
        "permissions": null,
        "dm_permission": null,
        "default_member_permissions": null,
        "testOnly": null,
        "type": null
    },
    {
        "name": "riot-links",
        "description": "Manage linked Riot accounts",
        "module": "league",
        "permissions": null,
        "dm_permission": null,
        "default_member_permissions": null,
        "testOnly": null,
        "type": null
    },
    {
        "name": "tft-history",
        "description": "Get recent Teamfight Tactics match history by Riot ID or linked user",
        "module": "league",
        "permissions": null,
        "dm_permission": null,
        "default_member_permissions": null,
        "testOnly": null,
        "type": null
    },
    {
        "name": "tft-stats",
        "description": "Get Teamfight Tactics ranked stats by Riot ID or linked user",
        "module": "league",
        "permissions": null,
        "dm_permission": null,
        "default_member_permissions": null,
        "testOnly": null,
        "type": null
    },
    {
        "name": "get-patchnotes",
        "description": "Get the latest patch notes for a game",
        "module": "patchnotes",
        "permissions": null,
        "dm_permission": null,
        "default_member_permissions": null,
        "testOnly": null,
        "type": null
    },
    {
        "name": "patchnotes-history",
        "description": "Show stored patch note history for a game",
        "module": "patchnotes",
        "permissions": null,
        "dm_permission": null,
        "default_member_permissions": null,
        "testOnly": null,
        "type": null
    },
    {
        "name": "subscribe-patchnotes",
        "description": "Subscribe a channel to patch notes for a game",
        "module": "patchnotes",
        "permissions": null,
        "dm_permission": null,
        "default_member_permissions": null,
        "testOnly": null,
        "type": null
    },
    {
        "name": "manage-patchnotes",
        "description": "List, test, pause, resume, or remove patch note subscriptions",
        "module": "patchnotes",
        "permissions": null,
        "dm_permission": null,
        "default_member_permissions": null,
        "testOnly": null,
        "type": null
    },
    {
        "name": "add-quote",
        "description": "Add a quote",
        "module": "quotes",
        "permissions": null,
        "dm_permission": null,
        "default_member_permissions": null,
        "testOnly": null,
        "type": null
    },
    {
        "name": "delete-quote",
        "description": "Delete a quote you added or authored",
        "module": "quotes",
        "permissions": null,
        "dm_permission": null,
        "default_member_permissions": null,
        "testOnly": null,
        "type": null
    },
    {
        "name": "quote-leaderboard",
        "description": "Show the most quoted users in this server",
        "module": "quotes",
        "permissions": null,
        "dm_permission": null,
        "default_member_permissions": null,
        "testOnly": null,
        "type": null
    },
    {
        "name": "quotes",
        "description": "Get all quotes for a user",
        "module": "quotes",
        "permissions": null,
        "dm_permission": null,
        "default_member_permissions": null,
        "testOnly": null,
        "type": null
    },
    {
        "name": "random-quote",
        "description": "Get a random quote from the server",
        "module": "quotes",
        "permissions": null,
        "dm_permission": null,
        "default_member_permissions": null,
        "testOnly": null,
        "type": null
    },
    {
        "name": "Save as Quote",
        "description": "Save a message as a quote from the message context menu",
        "module": "quotes",
        "permissions": null,
        "dm_permission": null,
        "default_member_permissions": null,
        "testOnly": null,
        "type": "message"
    },
    {
        "name": "search-quote",
        "description": "Search quotes by text",
        "module": "quotes",
        "permissions": null,
        "dm_permission": null,
        "default_member_permissions": null,
        "testOnly": null,
        "type": null
    },
    {
        "name": "Show Quotes",
        "description": "Show quotes for a user from the user context menu",
        "module": "quotes",
        "permissions": null,
        "dm_permission": null,
        "default_member_permissions": null,
        "testOnly": null,
        "type": "user"
    },
    {
        "name": "set-reminder",
        "description": "Set a reminder",
        "module": "reminders",
        "permissions": null,
        "dm_permission": null,
        "default_member_permissions": null,
        "testOnly": null,
        "type": null
    },
    {
        "name": "set-timezone",
        "description": "Set your timezone",
        "module": "reminders",
        "permissions": null,
        "dm_permission": null,
        "default_member_permissions": null,
        "testOnly": null,
        "type": null
    },
    {
        "name": "reminders",
        "description": "List your pending reminders",
        "module": "reminders",
        "permissions": null,
        "dm_permission": null,
        "default_member_permissions": null,
        "testOnly": null,
        "type": null
    },
    {
        "name": "Remind Me in 1h",
        "description": "Set a one-hour reminder for a message from the message context menu",
        "module": "reminders",
        "permissions": null,
        "dm_permission": null,
        "default_member_permissions": null,
        "testOnly": null,
        "type": "message"
    },
    {
        "name": "delete-reminder",
        "description": "Delete one of your pending reminders",
        "module": "reminders",
        "permissions": null,
        "dm_permission": null,
        "default_member_permissions": null,
        "testOnly": null,
        "type": null
    },
    {
        "name": "snooze-reminder",
        "description": "Snooze one of your pending reminders",
        "module": "reminders",
        "permissions": null,
        "dm_permission": null,
        "default_member_permissions": null,
        "testOnly": null,
        "type": null
    },
    {
        "name": "add-tiktok-stream",
        "description": "Add a TikTok account for live notifications",
        "module": "tiktok",
        "permissions": "Administrator",
        "dm_permission": null,
        "default_member_permissions": null,
        "testOnly": null,
        "type": null
    },
    {
        "name": "manage-tiktok-streams",
        "description": "List, test, pause, resume, or remove TikTok live notifications",
        "module": "tiktok",
        "permissions": "Administrator",
        "dm_permission": null,
        "default_member_permissions": null,
        "testOnly": null,
        "type": null
    },
    {
        "name": "add-twitch-stream",
        "description": "Add a Twitch stream for notifications",
        "module": "twitch",
        "permissions": "Administrator",
        "dm_permission": null,
        "default_member_permissions": null,
        "testOnly": null,
        "type": null
    },
    {
        "name": "manage-twitch-streams",
        "description": "List, test, pause, resume, or remove Twitch stream notifications",
        "module": "twitch",
        "permissions": "Administrator",
        "dm_permission": null,
        "default_member_permissions": null,
        "testOnly": null,
        "type": null
    },
    {
        "name": "stream-status",
        "description": "Check whether a Twitch channel is live",
        "module": "twitch",
        "permissions": null,
        "dm_permission": null,
        "default_member_permissions": null,
        "testOnly": null,
        "type": null
    },
    {
        "name": "add-youtube-channel",
        "description": "Add a Youtube Channel for new video notifications",
        "module": "youtube",
        "permissions": "Administrator",
        "dm_permission": null,
        "default_member_permissions": null,
        "testOnly": null,
        "type": null
    },
    {
        "name": "manage-youtube-channels",
        "description": "List, test, pause, resume, or remove YouTube video notifications",
        "module": "youtube",
        "permissions": "Administrator",
        "dm_permission": null,
        "default_member_permissions": null,
        "testOnly": null,
        "type": null
    },
    {
        "name": "youtube-latest",
        "description": "Show the latest video from a YouTube channel ID",
        "module": "youtube",
        "permissions": null,
        "dm_permission": null,
        "default_member_permissions": null,
        "testOnly": null,
        "type": null
    },
    {
        "name": "add-steam-news",
        "description": "Add Steam game news notifications",
        "module": "steam",
        "permissions": "Administrator",
        "dm_permission": null,
        "default_member_permissions": null,
        "testOnly": null,
        "type": null
    },
    {
        "name": "manage-steam-news",
        "description": "List, test, pause, resume, or remove Steam news notifications",
        "module": "steam",
        "permissions": "Administrator",
        "dm_permission": null,
        "default_member_permissions": null,
        "testOnly": null,
        "type": null
    }
] as const;

export const BOT_TREE: ReadonlyArray<BotModuleNode> = [
    {
        "module": {
            "name": "anime",
            "title": "Anime",
            "description": "Anime module"
        },
        "commands": [
            {
                "name": "anime",
                "description": "Search anime, manage subscriptions, and view upcoming episodes",
                "module": "anime",
                "permissions": null,
                "dm_permission": null,
                "default_member_permissions": null,
                "testOnly": null,
                "type": null
            },
            {
                "name": "manga",
                "description": "Search manga, manhwa, webtoons, and light novels on AniList",
                "module": "anime",
                "permissions": null,
                "dm_permission": null,
                "default_member_permissions": null,
                "testOnly": null,
                "type": null
            }
        ]
    },
    {
        "module": {
            "name": "birthdays",
            "title": "Birthdays",
            "description": "Birthdays module"
        },
        "commands": [
            {
                "name": "birthday",
                "description": "Show your or another user's birthday",
                "module": "birthdays",
                "permissions": null,
                "dm_permission": null,
                "default_member_permissions": null,
                "testOnly": null,
                "type": null
            },
            {
                "name": "birthdays",
                "description": "Show upcoming birthdays in this server",
                "module": "birthdays",
                "permissions": null,
                "dm_permission": null,
                "default_member_permissions": null,
                "testOnly": null,
                "type": null
            },
            {
                "name": "remove-birthday",
                "description": "Remove your birthday or another user's birthday (admins only)",
                "module": "birthdays",
                "permissions": null,
                "dm_permission": null,
                "default_member_permissions": null,
                "testOnly": null,
                "type": null
            },
            {
                "name": "set-birthday",
                "description": "Set your birthday and the channel to post in",
                "module": "birthdays",
                "permissions": null,
                "dm_permission": null,
                "default_member_permissions": null,
                "testOnly": null,
                "type": null
            },
            {
                "name": "Show Birthday",
                "description": "Show a user birthday from the user context menu",
                "module": "birthdays",
                "permissions": null,
                "dm_permission": null,
                "default_member_permissions": null,
                "testOnly": null,
                "type": "user"
            }
        ]
    },
    {
        "module": {
            "name": "bluesky",
            "title": "Bluesky",
            "description": "Bluesky module"
        },
        "commands": [
            {
                "name": "add-bluesky-account",
                "description": "Add a Bluesky account for post notifications",
                "module": "bluesky",
                "permissions": "Administrator",
                "dm_permission": null,
                "default_member_permissions": null,
                "testOnly": null,
                "type": null
            },
            {
                "name": "manage-bluesky-accounts",
                "description": "List, test, pause, resume, or remove Bluesky post notifications",
                "module": "bluesky",
                "permissions": "Administrator",
                "dm_permission": null,
                "default_member_permissions": null,
                "testOnly": null,
                "type": null
            }
        ]
    },
    {
        "module": {
            "name": "general",
            "title": "General",
            "description": "General module"
        },
        "commands": [
            {
                "name": "help",
                "description": "List all available commands and their descriptions.",
                "module": "general",
                "permissions": null,
                "dm_permission": null,
                "default_member_permissions": null,
                "testOnly": null,
                "type": null
            },
            {
                "name": "calendar",
                "description": "Show upcoming birthdays and your reminders",
                "module": "general",
                "permissions": null,
                "dm_permission": null,
                "default_member_permissions": null,
                "testOnly": null,
                "type": null
            },
            {
                "name": "poll",
                "description": "Create a simple poll for users to vote on",
                "module": "general",
                "permissions": null,
                "dm_permission": null,
                "default_member_permissions": null,
                "testOnly": null,
                "type": null
            },
            {
                "name": "roll",
                "description": "Roll dice or generate a random number",
                "module": "general",
                "permissions": null,
                "dm_permission": null,
                "default_member_permissions": null,
                "testOnly": null,
                "type": null
            },
            {
                "name": "spin",
                "description": "Spin the wheel to pick someone!",
                "module": "general",
                "permissions": null,
                "dm_permission": null,
                "default_member_permissions": null,
                "testOnly": null,
                "type": null
            },
            {
                "name": "test-notification",
                "description": "Send a sample notification to a channel",
                "module": "general",
                "permissions": null,
                "dm_permission": null,
                "default_member_permissions": null,
                "testOnly": null,
                "type": null
            },
            {
                "name": "time",
                "description": "Convert a time into Discord timestamp formats",
                "module": "general",
                "permissions": null,
                "dm_permission": null,
                "default_member_permissions": null,
                "testOnly": null,
                "type": null
            },
            {
                "name": "weather",
                "description": "Get the current weather and a short forecast for a specified location",
                "module": "general",
                "permissions": null,
                "dm_permission": null,
                "default_member_permissions": null,
                "testOnly": null,
                "type": null
            }
        ]
    },
    {
        "module": {
            "name": "league",
            "title": "League",
            "description": "League module"
        },
        "commands": [
            {
                "name": "league-history",
                "description": "Get recent League of Legends match history by Riot ID or linked user",
                "module": "league",
                "permissions": null,
                "dm_permission": null,
                "default_member_permissions": null,
                "testOnly": null,
                "type": null
            },
            {
                "name": "league-stats",
                "description": "Get League of Legends stats by Riot ID or linked user",
                "module": "league",
                "permissions": null,
                "dm_permission": null,
                "default_member_permissions": null,
                "testOnly": null,
                "type": null
            },
            {
                "name": "link-riot",
                "description": "Link your Discord account or another user to a Riot account",
                "module": "league",
                "permissions": null,
                "dm_permission": null,
                "default_member_permissions": null,
                "testOnly": null,
                "type": null
            },
            {
                "name": "riot-links",
                "description": "Manage linked Riot accounts",
                "module": "league",
                "permissions": null,
                "dm_permission": null,
                "default_member_permissions": null,
                "testOnly": null,
                "type": null
            },
            {
                "name": "tft-history",
                "description": "Get recent Teamfight Tactics match history by Riot ID or linked user",
                "module": "league",
                "permissions": null,
                "dm_permission": null,
                "default_member_permissions": null,
                "testOnly": null,
                "type": null
            },
            {
                "name": "tft-stats",
                "description": "Get Teamfight Tactics ranked stats by Riot ID or linked user",
                "module": "league",
                "permissions": null,
                "dm_permission": null,
                "default_member_permissions": null,
                "testOnly": null,
                "type": null
            }
        ]
    },
    {
        "module": {
            "name": "patchnotes",
            "title": "Patchnotes",
            "description": "Patchnotes module"
        },
        "commands": [
            {
                "name": "get-patchnotes",
                "description": "Get the latest patch notes for a game",
                "module": "patchnotes",
                "permissions": null,
                "dm_permission": null,
                "default_member_permissions": null,
                "testOnly": null,
                "type": null
            },
            {
                "name": "patchnotes-history",
                "description": "Show stored patch note history for a game",
                "module": "patchnotes",
                "permissions": null,
                "dm_permission": null,
                "default_member_permissions": null,
                "testOnly": null,
                "type": null
            },
            {
                "name": "subscribe-patchnotes",
                "description": "Subscribe a channel to patch notes for a game",
                "module": "patchnotes",
                "permissions": null,
                "dm_permission": null,
                "default_member_permissions": null,
                "testOnly": null,
                "type": null
            },
            {
                "name": "manage-patchnotes",
                "description": "List, test, pause, resume, or remove patch note subscriptions",
                "module": "patchnotes",
                "permissions": null,
                "dm_permission": null,
                "default_member_permissions": null,
                "testOnly": null,
                "type": null
            }
        ]
    },
    {
        "module": {
            "name": "quotes",
            "title": "Quotes",
            "description": "Quotes module"
        },
        "commands": [
            {
                "name": "add-quote",
                "description": "Add a quote",
                "module": "quotes",
                "permissions": null,
                "dm_permission": null,
                "default_member_permissions": null,
                "testOnly": null,
                "type": null
            },
            {
                "name": "delete-quote",
                "description": "Delete a quote you added or authored",
                "module": "quotes",
                "permissions": null,
                "dm_permission": null,
                "default_member_permissions": null,
                "testOnly": null,
                "type": null
            },
            {
                "name": "quote-leaderboard",
                "description": "Show the most quoted users in this server",
                "module": "quotes",
                "permissions": null,
                "dm_permission": null,
                "default_member_permissions": null,
                "testOnly": null,
                "type": null
            },
            {
                "name": "quotes",
                "description": "Get all quotes for a user",
                "module": "quotes",
                "permissions": null,
                "dm_permission": null,
                "default_member_permissions": null,
                "testOnly": null,
                "type": null
            },
            {
                "name": "random-quote",
                "description": "Get a random quote from the server",
                "module": "quotes",
                "permissions": null,
                "dm_permission": null,
                "default_member_permissions": null,
                "testOnly": null,
                "type": null
            },
            {
                "name": "Save as Quote",
                "description": "Save a message as a quote from the message context menu",
                "module": "quotes",
                "permissions": null,
                "dm_permission": null,
                "default_member_permissions": null,
                "testOnly": null,
                "type": "message"
            },
            {
                "name": "search-quote",
                "description": "Search quotes by text",
                "module": "quotes",
                "permissions": null,
                "dm_permission": null,
                "default_member_permissions": null,
                "testOnly": null,
                "type": null
            },
            {
                "name": "Show Quotes",
                "description": "Show quotes for a user from the user context menu",
                "module": "quotes",
                "permissions": null,
                "dm_permission": null,
                "default_member_permissions": null,
                "testOnly": null,
                "type": "user"
            }
        ]
    },
    {
        "module": {
            "name": "reminders",
            "title": "Reminders",
            "description": "Reminders module"
        },
        "commands": [
            {
                "name": "set-reminder",
                "description": "Set a reminder",
                "module": "reminders",
                "permissions": null,
                "dm_permission": null,
                "default_member_permissions": null,
                "testOnly": null,
                "type": null
            },
            {
                "name": "set-timezone",
                "description": "Set your timezone",
                "module": "reminders",
                "permissions": null,
                "dm_permission": null,
                "default_member_permissions": null,
                "testOnly": null,
                "type": null
            },
            {
                "name": "reminders",
                "description": "List your pending reminders",
                "module": "reminders",
                "permissions": null,
                "dm_permission": null,
                "default_member_permissions": null,
                "testOnly": null,
                "type": null
            },
            {
                "name": "Remind Me in 1h",
                "description": "Set a one-hour reminder for a message from the message context menu",
                "module": "reminders",
                "permissions": null,
                "dm_permission": null,
                "default_member_permissions": null,
                "testOnly": null,
                "type": "message"
            },
            {
                "name": "delete-reminder",
                "description": "Delete one of your pending reminders",
                "module": "reminders",
                "permissions": null,
                "dm_permission": null,
                "default_member_permissions": null,
                "testOnly": null,
                "type": null
            },
            {
                "name": "snooze-reminder",
                "description": "Snooze one of your pending reminders",
                "module": "reminders",
                "permissions": null,
                "dm_permission": null,
                "default_member_permissions": null,
                "testOnly": null,
                "type": null
            }
        ]
    },
    {
        "module": {
            "name": "shared",
            "title": "Shared",
            "description": "Shared module"
        },
        "commands": []
    },
    {
        "module": {
            "name": "tiktok",
            "title": "Tiktok",
            "description": "Tiktok module"
        },
        "commands": [
            {
                "name": "add-tiktok-stream",
                "description": "Add a TikTok account for live notifications",
                "module": "tiktok",
                "permissions": "Administrator",
                "dm_permission": null,
                "default_member_permissions": null,
                "testOnly": null,
                "type": null
            },
            {
                "name": "manage-tiktok-streams",
                "description": "List, test, pause, resume, or remove TikTok live notifications",
                "module": "tiktok",
                "permissions": "Administrator",
                "dm_permission": null,
                "default_member_permissions": null,
                "testOnly": null,
                "type": null
            }
        ]
    },
    {
        "module": {
            "name": "twitch",
            "title": "Twitch",
            "description": "Twitch module"
        },
        "commands": [
            {
                "name": "add-twitch-stream",
                "description": "Add a Twitch stream for notifications",
                "module": "twitch",
                "permissions": "Administrator",
                "dm_permission": null,
                "default_member_permissions": null,
                "testOnly": null,
                "type": null
            },
            {
                "name": "manage-twitch-streams",
                "description": "List, test, pause, resume, or remove Twitch stream notifications",
                "module": "twitch",
                "permissions": "Administrator",
                "dm_permission": null,
                "default_member_permissions": null,
                "testOnly": null,
                "type": null
            },
            {
                "name": "stream-status",
                "description": "Check whether a Twitch channel is live",
                "module": "twitch",
                "permissions": null,
                "dm_permission": null,
                "default_member_permissions": null,
                "testOnly": null,
                "type": null
            }
        ]
    },
    {
        "module": {
            "name": "youtube",
            "title": "Youtube",
            "description": "Youtube module"
        },
        "commands": [
            {
                "name": "add-youtube-channel",
                "description": "Add a Youtube Channel for new video notifications",
                "module": "youtube",
                "permissions": "Administrator",
                "dm_permission": null,
                "default_member_permissions": null,
                "testOnly": null,
                "type": null
            },
            {
                "name": "manage-youtube-channels",
                "description": "List, test, pause, resume, or remove YouTube video notifications",
                "module": "youtube",
                "permissions": "Administrator",
                "dm_permission": null,
                "default_member_permissions": null,
                "testOnly": null,
                "type": null
            },
            {
                "name": "youtube-latest",
                "description": "Show the latest video from a YouTube channel ID",
                "module": "youtube",
                "permissions": null,
                "dm_permission": null,
                "default_member_permissions": null,
                "testOnly": null,
                "type": null
            }
        ]
    },
    {
        "module": {
            "name": "steam",
            "title": "Steam",
            "description": "Steam game news notification commands"
        },
        "commands": [
            {
                "name": "add-steam-news",
                "description": "Add Steam game news notifications",
                "module": "steam",
                "permissions": "Administrator",
                "dm_permission": null,
                "default_member_permissions": null,
                "testOnly": null,
                "type": null
            },
            {
                "name": "manage-steam-news",
                "description": "List, test, pause, resume, or remove Steam news notifications",
                "module": "steam",
                "permissions": "Administrator",
                "dm_permission": null,
                "default_member_permissions": null,
                "testOnly": null,
                "type": null
            }
        ]
    }
] as const;
