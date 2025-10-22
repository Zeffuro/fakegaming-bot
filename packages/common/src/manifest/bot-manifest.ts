// AUTO-GENERATED FILE. Do not edit manually.
// Run: pnpm exec tsx scripts/generate-bot-manifest.ts

export interface BotModuleDef { name: string; title: string; description: string; }
export interface BotCommand { name: string; description: string; module?: string | null; permissions?: string | null; dm_permission?: boolean | null; default_member_permissions?: string | null; testOnly?: boolean | null; }
export interface BotModuleNode { module: BotModuleDef; commands: ReadonlyArray<BotCommand>; }

export const BOT_MODULES: ReadonlyArray<BotModuleDef> = [
    {
        "name": "birthdays",
        "title": "Birthdays",
        "description": "Birthdays module"
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
    }
] as const;

export const BOT_COMMANDS: ReadonlyArray<BotCommand> = [
    {
        "name": "birthday",
        "description": "Show your or another user's birthday",
        "module": "birthdays",
        "permissions": null,
        "dm_permission": null,
        "default_member_permissions": null,
        "testOnly": null
    },
    {
        "name": "remove-birthday",
        "description": "Remove your birthday or another user's birthday (admins only)",
        "module": "birthdays",
        "permissions": null,
        "dm_permission": null,
        "default_member_permissions": null,
        "testOnly": null
    },
    {
        "name": "set-birthday",
        "description": "Set your birthday and the channel to post in",
        "module": "birthdays",
        "permissions": null,
        "dm_permission": null,
        "default_member_permissions": null,
        "testOnly": null
    },
    {
        "name": "help",
        "description": "List all available commands and their descriptions.",
        "module": "general",
        "permissions": null,
        "dm_permission": null,
        "default_member_permissions": null,
        "testOnly": null
    },
    {
        "name": "poll",
        "description": "Create a simple poll for users to vote on",
        "module": "general",
        "permissions": null,
        "dm_permission": null,
        "default_member_permissions": null,
        "testOnly": null
    },
    {
        "name": "roll",
        "description": "Roll dice or generate a random number",
        "module": "general",
        "permissions": null,
        "dm_permission": null,
        "default_member_permissions": null,
        "testOnly": null
    },
    {
        "name": "spin",
        "description": "Spin the wheel to pick someone!",
        "module": "general",
        "permissions": null,
        "dm_permission": null,
        "default_member_permissions": null,
        "testOnly": null
    },
    {
        "name": "weather",
        "description": "Get the current weather and a short forecast for a specified location",
        "module": "general",
        "permissions": null,
        "dm_permission": null,
        "default_member_permissions": null,
        "testOnly": null
    },
    {
        "name": "league-history",
        "description": "Get recent League of Legends match history for a summoner",
        "module": "league",
        "permissions": null,
        "dm_permission": null,
        "default_member_permissions": null,
        "testOnly": null
    },
    {
        "name": "league-stats",
        "description": "Get League of Legends stats for a summoner or linked user",
        "module": "league",
        "permissions": null,
        "dm_permission": null,
        "default_member_permissions": null,
        "testOnly": null
    },
    {
        "name": "link-riot",
        "description": "Link your Discord account or another user to a Riot account",
        "module": "league",
        "permissions": null,
        "dm_permission": null,
        "default_member_permissions": null,
        "testOnly": null
    },
    {
        "name": "tft-history",
        "description": "Get recent Teamfight Tactics match history for a summoner",
        "module": "league",
        "permissions": null,
        "dm_permission": null,
        "default_member_permissions": null,
        "testOnly": null
    },
    {
        "name": "get-patchnotes",
        "description": "Get the latest patch notes for a game",
        "module": "patchnotes",
        "permissions": null,
        "dm_permission": null,
        "default_member_permissions": null,
        "testOnly": null
    },
    {
        "name": "subscribe-patchnotes",
        "description": "Subscribe a channel to patch notes for a game",
        "module": "patchnotes",
        "permissions": null,
        "dm_permission": null,
        "default_member_permissions": null,
        "testOnly": null
    },
    {
        "name": "add-quote",
        "description": "Add a quote",
        "module": "quotes",
        "permissions": null,
        "dm_permission": null,
        "default_member_permissions": null,
        "testOnly": null
    },
    {
        "name": "quotes",
        "description": "Get all quotes for a user",
        "module": "quotes",
        "permissions": null,
        "dm_permission": null,
        "default_member_permissions": null,
        "testOnly": null
    },
    {
        "name": "random-quote",
        "description": "Get a random quote from the server",
        "module": "quotes",
        "permissions": null,
        "dm_permission": null,
        "default_member_permissions": null,
        "testOnly": null
    },
    {
        "name": "search-quote",
        "description": "Search quotes by text",
        "module": "quotes",
        "permissions": null,
        "dm_permission": null,
        "default_member_permissions": null,
        "testOnly": null
    },
    {
        "name": "set-reminder",
        "description": "Set a reminder",
        "module": "reminders",
        "permissions": null,
        "dm_permission": null,
        "default_member_permissions": null,
        "testOnly": null
    },
    {
        "name": "set-timezone",
        "description": "Set your timezone",
        "module": "reminders",
        "permissions": null,
        "dm_permission": null,
        "default_member_permissions": null,
        "testOnly": null
    },
    {
        "name": "add-tiktok-stream",
        "description": "Add a TikTok account for live notifications",
        "module": "tiktok",
        "permissions": null,
        "dm_permission": null,
        "default_member_permissions": null,
        "testOnly": null
    },
    {
        "name": "add-twitch-stream",
        "description": "Add a Twitch stream for notifications",
        "module": "twitch",
        "permissions": null,
        "dm_permission": null,
        "default_member_permissions": null,
        "testOnly": null
    },
    {
        "name": "add-youtube-channel",
        "description": "Add a Youtube Channel for new video notifications",
        "module": "youtube",
        "permissions": null,
        "dm_permission": null,
        "default_member_permissions": null,
        "testOnly": null
    }
] as const;

export const BOT_TREE: ReadonlyArray<BotModuleNode> = [
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
                "testOnly": null
            },
            {
                "name": "remove-birthday",
                "description": "Remove your birthday or another user's birthday (admins only)",
                "module": "birthdays",
                "permissions": null,
                "dm_permission": null,
                "default_member_permissions": null,
                "testOnly": null
            },
            {
                "name": "set-birthday",
                "description": "Set your birthday and the channel to post in",
                "module": "birthdays",
                "permissions": null,
                "dm_permission": null,
                "default_member_permissions": null,
                "testOnly": null
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
                "testOnly": null
            },
            {
                "name": "poll",
                "description": "Create a simple poll for users to vote on",
                "module": "general",
                "permissions": null,
                "dm_permission": null,
                "default_member_permissions": null,
                "testOnly": null
            },
            {
                "name": "roll",
                "description": "Roll dice or generate a random number",
                "module": "general",
                "permissions": null,
                "dm_permission": null,
                "default_member_permissions": null,
                "testOnly": null
            },
            {
                "name": "spin",
                "description": "Spin the wheel to pick someone!",
                "module": "general",
                "permissions": null,
                "dm_permission": null,
                "default_member_permissions": null,
                "testOnly": null
            },
            {
                "name": "weather",
                "description": "Get the current weather and a short forecast for a specified location",
                "module": "general",
                "permissions": null,
                "dm_permission": null,
                "default_member_permissions": null,
                "testOnly": null
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
                "description": "Get recent League of Legends match history for a summoner",
                "module": "league",
                "permissions": null,
                "dm_permission": null,
                "default_member_permissions": null,
                "testOnly": null
            },
            {
                "name": "league-stats",
                "description": "Get League of Legends stats for a summoner or linked user",
                "module": "league",
                "permissions": null,
                "dm_permission": null,
                "default_member_permissions": null,
                "testOnly": null
            },
            {
                "name": "link-riot",
                "description": "Link your Discord account or another user to a Riot account",
                "module": "league",
                "permissions": null,
                "dm_permission": null,
                "default_member_permissions": null,
                "testOnly": null
            },
            {
                "name": "tft-history",
                "description": "Get recent Teamfight Tactics match history for a summoner",
                "module": "league",
                "permissions": null,
                "dm_permission": null,
                "default_member_permissions": null,
                "testOnly": null
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
                "testOnly": null
            },
            {
                "name": "subscribe-patchnotes",
                "description": "Subscribe a channel to patch notes for a game",
                "module": "patchnotes",
                "permissions": null,
                "dm_permission": null,
                "default_member_permissions": null,
                "testOnly": null
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
                "testOnly": null
            },
            {
                "name": "quotes",
                "description": "Get all quotes for a user",
                "module": "quotes",
                "permissions": null,
                "dm_permission": null,
                "default_member_permissions": null,
                "testOnly": null
            },
            {
                "name": "random-quote",
                "description": "Get a random quote from the server",
                "module": "quotes",
                "permissions": null,
                "dm_permission": null,
                "default_member_permissions": null,
                "testOnly": null
            },
            {
                "name": "search-quote",
                "description": "Search quotes by text",
                "module": "quotes",
                "permissions": null,
                "dm_permission": null,
                "default_member_permissions": null,
                "testOnly": null
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
                "testOnly": null
            },
            {
                "name": "set-timezone",
                "description": "Set your timezone",
                "module": "reminders",
                "permissions": null,
                "dm_permission": null,
                "default_member_permissions": null,
                "testOnly": null
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
                "permissions": null,
                "dm_permission": null,
                "default_member_permissions": null,
                "testOnly": null
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
                "permissions": null,
                "dm_permission": null,
                "default_member_permissions": null,
                "testOnly": null
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
                "permissions": null,
                "dm_permission": null,
                "default_member_permissions": null,
                "testOnly": null
            }
        ]
    }
] as const;
