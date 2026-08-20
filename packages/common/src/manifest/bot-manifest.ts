// AUTO-GENERATED FILE. Do not edit manually.
// Run: pnpm exec tsx scripts/generate-bot-manifest.ts

export interface BotModuleDef { name: string; title: string; description: string; }
export type BotCommandType = 'chatInput' | 'user' | 'message';
export interface BotCommandLocalization { name: string; description: string; }
export type BotCommandLocalizationLocale = "nl";
export interface BotCommand { name: string; description: string; module?: string | null; permissions?: string | null; dm_permission?: boolean | null; default_member_permissions?: string | null; testOnly?: boolean | null; type?: BotCommandType | null; localizations?: Record<BotCommandLocalizationLocale, BotCommandLocalization> | null; }
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
        "name": "game-night",
        "title": "Game Night",
        "description": "Game Night module"
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
        "name": "notes",
        "title": "Notes",
        "description": "Personal note commands"
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
        "type": null,
        "localizations": {
            "nl": {
                "name": "anime",
                "description": "Zoek anime, beheer abonnementen en bekijk komende afleveringen"
            }
        }
    },
    {
        "name": "manga",
        "description": "Search manga, manhwa, webtoons, and light novels on AniList",
        "module": "anime",
        "permissions": null,
        "dm_permission": null,
        "default_member_permissions": null,
        "testOnly": null,
        "type": null,
        "localizations": {
            "nl": {
                "name": "manga",
                "description": "Zoek manga, manhwa, webtoons en light novels op AniList"
            }
        }
    },
    {
        "name": "birthday",
        "description": "Show your or another user's birthday",
        "module": "birthdays",
        "permissions": null,
        "dm_permission": null,
        "default_member_permissions": null,
        "testOnly": null,
        "type": null,
        "localizations": {
            "nl": {
                "name": "verjaardag",
                "description": "Toon de verjaardag van jezelf of een andere gebruiker"
            }
        }
    },
    {
        "name": "birthdays",
        "description": "Show upcoming birthdays in this server",
        "module": "birthdays",
        "permissions": null,
        "dm_permission": null,
        "default_member_permissions": null,
        "testOnly": null,
        "type": null,
        "localizations": {
            "nl": {
                "name": "verjaardagen",
                "description": "Toon komende verjaardagen op deze server"
            }
        }
    },
    {
        "name": "remove-birthday",
        "description": "Remove your birthday or another user's birthday (admins only)",
        "module": "birthdays",
        "permissions": null,
        "dm_permission": null,
        "default_member_permissions": null,
        "testOnly": null,
        "type": null,
        "localizations": {
            "nl": {
                "name": "verjaardag-verwijderen",
                "description": "Verwijder jouw verjaardag of die van een ander (alleen beheerders)"
            }
        }
    },
    {
        "name": "set-birthday",
        "description": "Set your birthday and the channel to post in",
        "module": "birthdays",
        "permissions": null,
        "dm_permission": null,
        "default_member_permissions": null,
        "testOnly": null,
        "type": null,
        "localizations": {
            "nl": {
                "name": "verjaardag-instellen",
                "description": "Stel je verjaardag en het kanaal voor meldingen in"
            }
        }
    },
    {
        "name": "Show Birthday",
        "description": "Show a user birthday from the user context menu",
        "module": "birthdays",
        "permissions": null,
        "dm_permission": null,
        "default_member_permissions": null,
        "testOnly": null,
        "type": "user",
        "localizations": {
            "nl": {
                "name": "Verjaardag tonen",
                "description": "Toon een verjaardag via het gebruikersmenu"
            }
        }
    },
    {
        "name": "add-bluesky-account",
        "description": "Add a Bluesky account for post notifications",
        "module": "bluesky",
        "permissions": "Administrator",
        "dm_permission": null,
        "default_member_permissions": null,
        "testOnly": null,
        "type": null,
        "localizations": {
            "nl": {
                "name": "bluesky-account-toevoegen",
                "description": "Voeg een Bluesky-account toe voor berichtmeldingen"
            }
        }
    },
    {
        "name": "manage-bluesky-accounts",
        "description": "List, test, pause, resume, or remove Bluesky post notifications",
        "module": "bluesky",
        "permissions": "Administrator",
        "dm_permission": null,
        "default_member_permissions": null,
        "testOnly": null,
        "type": null,
        "localizations": {
            "nl": {
                "name": "bluesky-accounts-beheren",
                "description": "Bekijk, test, pauzeer, hervat of verwijder Bluesky-meldingen"
            }
        }
    },
    {
        "name": "game-night",
        "description": "Nominate and vote on games for a server game night",
        "module": "game-night",
        "permissions": null,
        "dm_permission": false,
        "default_member_permissions": null,
        "testOnly": null,
        "type": null,
        "localizations": {
            "nl": {
                "name": "spelavond",
                "description": "Nomineer en stem op spellen voor een spelavond van de server"
            }
        }
    },
    {
        "name": "help",
        "description": "List all available commands and their descriptions.",
        "module": "general",
        "permissions": null,
        "dm_permission": null,
        "default_member_permissions": null,
        "testOnly": null,
        "type": null,
        "localizations": {
            "nl": {
                "name": "help",
                "description": "Toon alle beschikbare opdrachten en hun beschrijvingen"
            }
        }
    },
    {
        "name": "calendar",
        "description": "Show upcoming birthdays and your reminders",
        "module": "general",
        "permissions": null,
        "dm_permission": null,
        "default_member_permissions": null,
        "testOnly": null,
        "type": null,
        "localizations": {
            "nl": {
                "name": "kalender",
                "description": "Toon komende verjaardagen en je herinneringen"
            }
        }
    },
    {
        "name": "poll",
        "description": "Create a button poll with live results",
        "module": "general",
        "permissions": null,
        "dm_permission": null,
        "default_member_permissions": null,
        "testOnly": null,
        "type": null,
        "localizations": {
            "nl": {
                "name": "peiling",
                "description": "Maak een peiling met knoppen en live resultaten"
            }
        }
    },
    {
        "name": "question",
        "description": "Draw a conversation question from a local deck",
        "module": "general",
        "permissions": null,
        "dm_permission": null,
        "default_member_permissions": null,
        "testOnly": null,
        "type": null,
        "localizations": {
            "nl": {
                "name": "vraag",
                "description": "Trek een gespreksvraag uit een lokaal kaartspel"
            }
        }
    },
    {
        "name": "permissions-backup",
        "description": "Save and export role, category, and channel permissions",
        "module": "general",
        "permissions": "Administrator",
        "dm_permission": null,
        "default_member_permissions": "8",
        "testOnly": null,
        "type": null,
        "localizations": {
            "nl": {
                "name": "rechten-back-up",
                "description": "Bewaar en exporteer rol-, categorie- en kanaalrechten"
            }
        }
    },
    {
        "name": "profile-card",
        "description": "Render a Discord profile card",
        "module": "general",
        "permissions": null,
        "dm_permission": null,
        "default_member_permissions": null,
        "testOnly": null,
        "type": null,
        "localizations": {
            "nl": {
                "name": "profielkaart",
                "description": "Maak een Discord-profielkaart"
            }
        }
    },
    {
        "name": "roll",
        "description": "Roll dice or generate a random number",
        "module": "general",
        "permissions": null,
        "dm_permission": null,
        "default_member_permissions": null,
        "testOnly": null,
        "type": null,
        "localizations": {
            "nl": {
                "name": "werpen",
                "description": "Werp dobbelstenen of maak een willekeurig getal"
            }
        }
    },
    {
        "name": "spin",
        "description": "Spin the wheel to pick someone!",
        "module": "general",
        "permissions": null,
        "dm_permission": null,
        "default_member_permissions": null,
        "testOnly": null,
        "type": null,
        "localizations": {
            "nl": {
                "name": "draaien",
                "description": "Draai aan het rad om iemand te kiezen"
            }
        }
    },
    {
        "name": "test-notification",
        "description": "Send a sample notification to a channel",
        "module": "general",
        "permissions": null,
        "dm_permission": null,
        "default_member_permissions": null,
        "testOnly": null,
        "type": null,
        "localizations": {
            "nl": {
                "name": "testmelding",
                "description": "Stuur een testmelding naar een kanaal"
            }
        }
    },
    {
        "name": "time",
        "description": "Convert a time into Discord timestamp formats",
        "module": "general",
        "permissions": null,
        "dm_permission": null,
        "default_member_permissions": null,
        "testOnly": null,
        "type": null,
        "localizations": {
            "nl": {
                "name": "tijd",
                "description": "Zet een tijd om naar Discord-tijdstempelindelingen"
            }
        }
    },
    {
        "name": "weather",
        "description": "Get the current weather and a short forecast for a specified location",
        "module": "general",
        "permissions": null,
        "dm_permission": null,
        "default_member_permissions": null,
        "testOnly": null,
        "type": null,
        "localizations": {
            "nl": {
                "name": "weer",
                "description": "Toon het huidige weer en een korte verwachting voor een locatie"
            }
        }
    },
    {
        "name": "league-history",
        "description": "Get recent League of Legends match history by Riot ID or linked user",
        "module": "league",
        "permissions": null,
        "dm_permission": null,
        "default_member_permissions": null,
        "testOnly": null,
        "type": null,
        "localizations": {
            "nl": {
                "name": "league-geschiedenis",
                "description": "Toon recente League of Legends-wedstrijden via Riot ID of gekoppelde gebruiker"
            }
        }
    },
    {
        "name": "league-form",
        "description": "Summarize recent League of Legends form by Riot ID or linked user",
        "module": "league",
        "permissions": null,
        "dm_permission": null,
        "default_member_permissions": null,
        "testOnly": null,
        "type": null,
        "localizations": {
            "nl": {
                "name": "league-vorm",
                "description": "Vat recente League of Legends-vorm samen via Riot ID of gekoppelde gebruiker"
            }
        }
    },
    {
        "name": "league-stats",
        "description": "Get League of Legends stats by Riot ID or linked user",
        "module": "league",
        "permissions": null,
        "dm_permission": null,
        "default_member_permissions": null,
        "testOnly": null,
        "type": null,
        "localizations": {
            "nl": {
                "name": "league-statistieken",
                "description": "Toon League of Legends-statistieken via Riot ID of gekoppelde gebruiker"
            }
        }
    },
    {
        "name": "link-riot",
        "description": "Link your Discord account or another user to a Riot account",
        "module": "league",
        "permissions": null,
        "dm_permission": null,
        "default_member_permissions": null,
        "testOnly": null,
        "type": null,
        "localizations": {
            "nl": {
                "name": "riot-koppelen",
                "description": "Koppel jouw Discord-account of een andere gebruiker aan een Riot-account"
            }
        }
    },
    {
        "name": "riot-links",
        "description": "Manage linked Riot accounts",
        "module": "league",
        "permissions": null,
        "dm_permission": null,
        "default_member_permissions": null,
        "testOnly": null,
        "type": null,
        "localizations": {
            "nl": {
                "name": "riot-koppelingen",
                "description": "Beheer gekoppelde Riot-accounts"
            }
        }
    },
    {
        "name": "tft-history",
        "description": "Get recent Teamfight Tactics match history by Riot ID or linked user",
        "module": "league",
        "permissions": null,
        "dm_permission": null,
        "default_member_permissions": null,
        "testOnly": null,
        "type": null,
        "localizations": {
            "nl": {
                "name": "tft-geschiedenis",
                "description": "Toon recente TFT-wedstrijden via Riot ID of gekoppelde gebruiker"
            }
        }
    },
    {
        "name": "tft-stats",
        "description": "Get Teamfight Tactics ranked stats by Riot ID or linked user",
        "module": "league",
        "permissions": null,
        "dm_permission": null,
        "default_member_permissions": null,
        "testOnly": null,
        "type": null,
        "localizations": {
            "nl": {
                "name": "tft-statistieken",
                "description": "Toon TFT-rangstatistieken via Riot ID of gekoppelde gebruiker"
            }
        }
    },
    {
        "name": "get-patchnotes",
        "description": "Get the latest patch notes for a game",
        "module": "patchnotes",
        "permissions": null,
        "dm_permission": null,
        "default_member_permissions": null,
        "testOnly": null,
        "type": null,
        "localizations": {
            "nl": {
                "name": "patchnotes-ophalen",
                "description": "Toon de nieuwste patchnotes voor een spel"
            }
        }
    },
    {
        "name": "patchnotes-history",
        "description": "Show stored patch note history for a game",
        "module": "patchnotes",
        "permissions": null,
        "dm_permission": null,
        "default_member_permissions": null,
        "testOnly": null,
        "type": null,
        "localizations": {
            "nl": {
                "name": "patchnotes-geschiedenis",
                "description": "Toon opgeslagen patchnote-geschiedenis voor een spel"
            }
        }
    },
    {
        "name": "subscribe-patchnotes",
        "description": "Subscribe a channel to patch notes for a game",
        "module": "patchnotes",
        "permissions": null,
        "dm_permission": null,
        "default_member_permissions": null,
        "testOnly": null,
        "type": null,
        "localizations": {
            "nl": {
                "name": "patchnotes-abonneren",
                "description": "Abonneer een kanaal op patchnotes voor een spel"
            }
        }
    },
    {
        "name": "manage-patchnotes",
        "description": "List, test, pause, resume, or remove patch note subscriptions",
        "module": "patchnotes",
        "permissions": null,
        "dm_permission": null,
        "default_member_permissions": null,
        "testOnly": null,
        "type": null,
        "localizations": {
            "nl": {
                "name": "patchnotes-beheren",
                "description": "Bekijk, test, pauzeer, hervat of verwijder patchnote-abonnementen"
            }
        }
    },
    {
        "name": "add-quote",
        "description": "Add a quote",
        "module": "quotes",
        "permissions": null,
        "dm_permission": null,
        "default_member_permissions": null,
        "testOnly": null,
        "type": null,
        "localizations": {
            "nl": {
                "name": "citaat-toevoegen",
                "description": "Voeg een citaat toe"
            }
        }
    },
    {
        "name": "delete-quote",
        "description": "Delete a quote you added or authored",
        "module": "quotes",
        "permissions": null,
        "dm_permission": null,
        "default_member_permissions": null,
        "testOnly": null,
        "type": null,
        "localizations": {
            "nl": {
                "name": "citaat-verwijderen",
                "description": "Verwijder een citaat dat je toevoegde of uitsprak"
            }
        }
    },
    {
        "name": "quote-leaderboard",
        "description": "Show the most quoted users in this server",
        "module": "quotes",
        "permissions": null,
        "dm_permission": null,
        "default_member_permissions": null,
        "testOnly": null,
        "type": null,
        "localizations": {
            "nl": {
                "name": "citaten-klassement",
                "description": "Toon de meest geciteerde gebruikers op deze server"
            }
        }
    },
    {
        "name": "quote-card",
        "description": "Render an approved quote as a shareable image",
        "module": "quotes",
        "permissions": null,
        "dm_permission": null,
        "default_member_permissions": null,
        "testOnly": null,
        "type": null,
        "localizations": {
            "nl": {
                "name": "citaatkaart",
                "description": "Maak van een goedgekeurd citaat een deelbare afbeelding"
            }
        }
    },
    {
        "name": "quotes",
        "description": "Get all quotes for a user",
        "module": "quotes",
        "permissions": null,
        "dm_permission": null,
        "default_member_permissions": null,
        "testOnly": null,
        "type": null,
        "localizations": {
            "nl": {
                "name": "citaten",
                "description": "Toon alle citaten van een gebruiker"
            }
        }
    },
    {
        "name": "random-quote",
        "description": "Get a random quote from the server",
        "module": "quotes",
        "permissions": null,
        "dm_permission": null,
        "default_member_permissions": null,
        "testOnly": null,
        "type": null,
        "localizations": {
            "nl": {
                "name": "willekeurig-citaat",
                "description": "Toon een willekeurig citaat van de server"
            }
        }
    },
    {
        "name": "Save as Quote",
        "description": "Save a message as a quote from the message context menu",
        "module": "quotes",
        "permissions": null,
        "dm_permission": null,
        "default_member_permissions": null,
        "testOnly": null,
        "type": "message",
        "localizations": {
            "nl": {
                "name": "Opslaan als citaat",
                "description": "Bewaar een bericht als citaat via het berichtenmenu"
            }
        }
    },
    {
        "name": "search-quote",
        "description": "Search quotes by text",
        "module": "quotes",
        "permissions": null,
        "dm_permission": null,
        "default_member_permissions": null,
        "testOnly": null,
        "type": null,
        "localizations": {
            "nl": {
                "name": "citaten-zoeken",
                "description": "Zoek citaten op tekst"
            }
        }
    },
    {
        "name": "Show Quotes",
        "description": "Show quotes for a user from the user context menu",
        "module": "quotes",
        "permissions": null,
        "dm_permission": null,
        "default_member_permissions": null,
        "testOnly": null,
        "type": "user",
        "localizations": {
            "nl": {
                "name": "Citaten tonen",
                "description": "Toon citaten via het gebruikersmenu"
            }
        }
    },
    {
        "name": "set-reminder",
        "description": "Set a reminder",
        "module": "reminders",
        "permissions": null,
        "dm_permission": null,
        "default_member_permissions": null,
        "testOnly": null,
        "type": null,
        "localizations": {
            "nl": {
                "name": "herinnering-instellen",
                "description": "Stel een herinnering in"
            }
        }
    },
    {
        "name": "set-timezone",
        "description": "Set your timezone",
        "module": "reminders",
        "permissions": null,
        "dm_permission": null,
        "default_member_permissions": null,
        "testOnly": null,
        "type": null,
        "localizations": {
            "nl": {
                "name": "tijdzone-instellen",
                "description": "Stel je tijdzone in"
            }
        }
    },
    {
        "name": "reminders",
        "description": "List your active and paused reminders",
        "module": "reminders",
        "permissions": null,
        "dm_permission": null,
        "default_member_permissions": null,
        "testOnly": null,
        "type": null,
        "localizations": {
            "nl": {
                "name": "herinneringen",
                "description": "Toon je actieve en gepauzeerde herinneringen"
            }
        }
    },
    {
        "name": "Remind Me in 1h",
        "description": "Set a one-hour reminder for a message from the message context menu",
        "module": "reminders",
        "permissions": null,
        "dm_permission": null,
        "default_member_permissions": null,
        "testOnly": null,
        "type": "message",
        "localizations": {
            "nl": {
                "name": "Herinner mij over 1u",
                "description": "Stel via het berichtenmenu een herinnering over één uur in"
            }
        }
    },
    {
        "name": "delete-reminder",
        "description": "Delete one of your pending reminders",
        "module": "reminders",
        "permissions": null,
        "dm_permission": null,
        "default_member_permissions": null,
        "testOnly": null,
        "type": null,
        "localizations": {
            "nl": {
                "name": "herinnering-verwijderen",
                "description": "Verwijder een openstaande herinnering"
            }
        }
    },
    {
        "name": "snooze-reminder",
        "description": "Snooze one of your pending reminders",
        "module": "reminders",
        "permissions": null,
        "dm_permission": null,
        "default_member_permissions": null,
        "testOnly": null,
        "type": null,
        "localizations": {
            "nl": {
                "name": "herinnering-uitstellen",
                "description": "Stel een openstaande herinnering uit"
            }
        }
    },
    {
        "name": "pause-reminder",
        "description": "Pause one of your recurring reminders",
        "module": "reminders",
        "permissions": null,
        "dm_permission": null,
        "default_member_permissions": null,
        "testOnly": null,
        "type": null,
        "localizations": {
            "nl": {
                "name": "herinnering-pauzeren",
                "description": "Pauzeer een herhalende herinnering"
            }
        }
    },
    {
        "name": "resume-reminder",
        "description": "Resume one of your recurring reminders",
        "module": "reminders",
        "permissions": null,
        "dm_permission": null,
        "default_member_permissions": null,
        "testOnly": null,
        "type": null,
        "localizations": {
            "nl": {
                "name": "herinnering-hervatten",
                "description": "Hervat een herhalende herinnering"
            }
        }
    },
    {
        "name": "add-tiktok-stream",
        "description": "Add a TikTok account for live notifications",
        "module": "tiktok",
        "permissions": "Administrator",
        "dm_permission": null,
        "default_member_permissions": null,
        "testOnly": null,
        "type": null,
        "localizations": {
            "nl": {
                "name": "tiktok-stream-toevoegen",
                "description": "Voeg een TikTok-account toe voor livemeldingen"
            }
        }
    },
    {
        "name": "manage-tiktok-streams",
        "description": "List, test, pause, resume, or remove TikTok live notifications",
        "module": "tiktok",
        "permissions": "Administrator",
        "dm_permission": null,
        "default_member_permissions": null,
        "testOnly": null,
        "type": null,
        "localizations": {
            "nl": {
                "name": "tiktok-streams-beheren",
                "description": "Bekijk, test, pauzeer, hervat of verwijder TikTok-livemeldingen"
            }
        }
    },
    {
        "name": "add-twitch-stream",
        "description": "Add a Twitch stream for notifications",
        "module": "twitch",
        "permissions": "Administrator",
        "dm_permission": null,
        "default_member_permissions": null,
        "testOnly": null,
        "type": null,
        "localizations": {
            "nl": {
                "name": "twitch-stream-toevoegen",
                "description": "Voeg een Twitch-stream toe voor meldingen"
            }
        }
    },
    {
        "name": "manage-twitch-streams",
        "description": "List, test, pause, resume, or remove Twitch stream notifications",
        "module": "twitch",
        "permissions": "Administrator",
        "dm_permission": null,
        "default_member_permissions": null,
        "testOnly": null,
        "type": null,
        "localizations": {
            "nl": {
                "name": "twitch-streams-beheren",
                "description": "Bekijk, test, pauzeer, hervat of verwijder Twitch-streammeldingen"
            }
        }
    },
    {
        "name": "stream-status",
        "description": "Check whether a Twitch channel is live",
        "module": "twitch",
        "permissions": null,
        "dm_permission": null,
        "default_member_permissions": null,
        "testOnly": null,
        "type": null,
        "localizations": {
            "nl": {
                "name": "streamstatus",
                "description": "Controleer of een Twitch-kanaal live is"
            }
        }
    },
    {
        "name": "twitch-latest-vod",
        "description": "Show the latest Twitch archive VOD for a channel",
        "module": "twitch",
        "permissions": null,
        "dm_permission": null,
        "default_member_permissions": null,
        "testOnly": null,
        "type": null,
        "localizations": {
            "nl": {
                "name": "nieuwste-twitch-vod",
                "description": "Toon de nieuwste Twitch-archief-VOD van een kanaal"
            }
        }
    },
    {
        "name": "add-youtube-channel",
        "description": "Add a Youtube Channel for new video notifications",
        "module": "youtube",
        "permissions": "Administrator",
        "dm_permission": null,
        "default_member_permissions": null,
        "testOnly": null,
        "type": null,
        "localizations": {
            "nl": {
                "name": "youtube-kanaal-toevoegen",
                "description": "Voeg een YouTube-kanaal toe voor nieuwe videomeldingen"
            }
        }
    },
    {
        "name": "manage-youtube-channels",
        "description": "List, test, pause, resume, or remove YouTube video notifications",
        "module": "youtube",
        "permissions": "Administrator",
        "dm_permission": null,
        "default_member_permissions": null,
        "testOnly": null,
        "type": null,
        "localizations": {
            "nl": {
                "name": "youtube-kanalen-beheren",
                "description": "Bekijk, test, pauzeer, hervat of verwijder YouTube-videomeldingen"
            }
        }
    },
    {
        "name": "youtube-latest",
        "description": "Show the latest video from a YouTube channel ID",
        "module": "youtube",
        "permissions": null,
        "dm_permission": null,
        "default_member_permissions": null,
        "testOnly": null,
        "type": null,
        "localizations": {
            "nl": {
                "name": "nieuwste-youtube-video",
                "description": "Toon de nieuwste video van een YouTube-kanaal-ID"
            }
        }
    },
    {
        "name": "notes",
        "description": "Add, list, show, and delete your personal notes",
        "module": "notes",
        "permissions": null,
        "dm_permission": null,
        "default_member_permissions": null,
        "testOnly": null,
        "type": null,
        "localizations": {
            "nl": {
                "name": "notities",
                "description": "Voeg persoonlijke notities toe, bekijk ze of verwijder ze"
            }
        }
    },
    {
        "name": "Save to Notes",
        "description": "Save a message excerpt and jump link to your private notes",
        "module": "notes",
        "permissions": null,
        "dm_permission": null,
        "default_member_permissions": null,
        "testOnly": null,
        "type": "message",
        "localizations": {
            "nl": {
                "name": "Opslaan in notities",
                "description": "Bewaar een berichtfragment en link in je privénotities"
            }
        }
    },
    {
        "name": "add-steam-news",
        "description": "Add Steam game news notifications",
        "module": "steam",
        "permissions": "Administrator",
        "dm_permission": null,
        "default_member_permissions": null,
        "testOnly": null,
        "type": null,
        "localizations": {
            "nl": {
                "name": "steamnieuws-toevoegen",
                "description": "Voeg meldingen voor Steam-spelnieuws toe"
            }
        }
    },
    {
        "name": "manage-steam-news",
        "description": "List, test, pause, resume, or remove Steam news notifications",
        "module": "steam",
        "permissions": "Administrator",
        "dm_permission": null,
        "default_member_permissions": null,
        "testOnly": null,
        "type": null,
        "localizations": {
            "nl": {
                "name": "steamnieuws-beheren",
                "description": "Bekijk, test, pauzeer, hervat of verwijder Steamnieuwsmeldingen"
            }
        }
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
                "type": null,
                "localizations": {
                    "nl": {
                        "name": "anime",
                        "description": "Zoek anime, beheer abonnementen en bekijk komende afleveringen"
                    }
                }
            },
            {
                "name": "manga",
                "description": "Search manga, manhwa, webtoons, and light novels on AniList",
                "module": "anime",
                "permissions": null,
                "dm_permission": null,
                "default_member_permissions": null,
                "testOnly": null,
                "type": null,
                "localizations": {
                    "nl": {
                        "name": "manga",
                        "description": "Zoek manga, manhwa, webtoons en light novels op AniList"
                    }
                }
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
                "type": null,
                "localizations": {
                    "nl": {
                        "name": "verjaardag",
                        "description": "Toon de verjaardag van jezelf of een andere gebruiker"
                    }
                }
            },
            {
                "name": "birthdays",
                "description": "Show upcoming birthdays in this server",
                "module": "birthdays",
                "permissions": null,
                "dm_permission": null,
                "default_member_permissions": null,
                "testOnly": null,
                "type": null,
                "localizations": {
                    "nl": {
                        "name": "verjaardagen",
                        "description": "Toon komende verjaardagen op deze server"
                    }
                }
            },
            {
                "name": "remove-birthday",
                "description": "Remove your birthday or another user's birthday (admins only)",
                "module": "birthdays",
                "permissions": null,
                "dm_permission": null,
                "default_member_permissions": null,
                "testOnly": null,
                "type": null,
                "localizations": {
                    "nl": {
                        "name": "verjaardag-verwijderen",
                        "description": "Verwijder jouw verjaardag of die van een ander (alleen beheerders)"
                    }
                }
            },
            {
                "name": "set-birthday",
                "description": "Set your birthday and the channel to post in",
                "module": "birthdays",
                "permissions": null,
                "dm_permission": null,
                "default_member_permissions": null,
                "testOnly": null,
                "type": null,
                "localizations": {
                    "nl": {
                        "name": "verjaardag-instellen",
                        "description": "Stel je verjaardag en het kanaal voor meldingen in"
                    }
                }
            },
            {
                "name": "Show Birthday",
                "description": "Show a user birthday from the user context menu",
                "module": "birthdays",
                "permissions": null,
                "dm_permission": null,
                "default_member_permissions": null,
                "testOnly": null,
                "type": "user",
                "localizations": {
                    "nl": {
                        "name": "Verjaardag tonen",
                        "description": "Toon een verjaardag via het gebruikersmenu"
                    }
                }
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
                "type": null,
                "localizations": {
                    "nl": {
                        "name": "bluesky-account-toevoegen",
                        "description": "Voeg een Bluesky-account toe voor berichtmeldingen"
                    }
                }
            },
            {
                "name": "manage-bluesky-accounts",
                "description": "List, test, pause, resume, or remove Bluesky post notifications",
                "module": "bluesky",
                "permissions": "Administrator",
                "dm_permission": null,
                "default_member_permissions": null,
                "testOnly": null,
                "type": null,
                "localizations": {
                    "nl": {
                        "name": "bluesky-accounts-beheren",
                        "description": "Bekijk, test, pauzeer, hervat of verwijder Bluesky-meldingen"
                    }
                }
            }
        ]
    },
    {
        "module": {
            "name": "game-night",
            "title": "Game Night",
            "description": "Game Night module"
        },
        "commands": [
            {
                "name": "game-night",
                "description": "Nominate and vote on games for a server game night",
                "module": "game-night",
                "permissions": null,
                "dm_permission": false,
                "default_member_permissions": null,
                "testOnly": null,
                "type": null,
                "localizations": {
                    "nl": {
                        "name": "spelavond",
                        "description": "Nomineer en stem op spellen voor een spelavond van de server"
                    }
                }
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
                "type": null,
                "localizations": {
                    "nl": {
                        "name": "help",
                        "description": "Toon alle beschikbare opdrachten en hun beschrijvingen"
                    }
                }
            },
            {
                "name": "calendar",
                "description": "Show upcoming birthdays and your reminders",
                "module": "general",
                "permissions": null,
                "dm_permission": null,
                "default_member_permissions": null,
                "testOnly": null,
                "type": null,
                "localizations": {
                    "nl": {
                        "name": "kalender",
                        "description": "Toon komende verjaardagen en je herinneringen"
                    }
                }
            },
            {
                "name": "poll",
                "description": "Create a button poll with live results",
                "module": "general",
                "permissions": null,
                "dm_permission": null,
                "default_member_permissions": null,
                "testOnly": null,
                "type": null,
                "localizations": {
                    "nl": {
                        "name": "peiling",
                        "description": "Maak een peiling met knoppen en live resultaten"
                    }
                }
            },
            {
                "name": "question",
                "description": "Draw a conversation question from a local deck",
                "module": "general",
                "permissions": null,
                "dm_permission": null,
                "default_member_permissions": null,
                "testOnly": null,
                "type": null,
                "localizations": {
                    "nl": {
                        "name": "vraag",
                        "description": "Trek een gespreksvraag uit een lokaal kaartspel"
                    }
                }
            },
            {
                "name": "permissions-backup",
                "description": "Save and export role, category, and channel permissions",
                "module": "general",
                "permissions": "Administrator",
                "dm_permission": null,
                "default_member_permissions": "8",
                "testOnly": null,
                "type": null,
                "localizations": {
                    "nl": {
                        "name": "rechten-back-up",
                        "description": "Bewaar en exporteer rol-, categorie- en kanaalrechten"
                    }
                }
            },
            {
                "name": "profile-card",
                "description": "Render a Discord profile card",
                "module": "general",
                "permissions": null,
                "dm_permission": null,
                "default_member_permissions": null,
                "testOnly": null,
                "type": null,
                "localizations": {
                    "nl": {
                        "name": "profielkaart",
                        "description": "Maak een Discord-profielkaart"
                    }
                }
            },
            {
                "name": "roll",
                "description": "Roll dice or generate a random number",
                "module": "general",
                "permissions": null,
                "dm_permission": null,
                "default_member_permissions": null,
                "testOnly": null,
                "type": null,
                "localizations": {
                    "nl": {
                        "name": "werpen",
                        "description": "Werp dobbelstenen of maak een willekeurig getal"
                    }
                }
            },
            {
                "name": "spin",
                "description": "Spin the wheel to pick someone!",
                "module": "general",
                "permissions": null,
                "dm_permission": null,
                "default_member_permissions": null,
                "testOnly": null,
                "type": null,
                "localizations": {
                    "nl": {
                        "name": "draaien",
                        "description": "Draai aan het rad om iemand te kiezen"
                    }
                }
            },
            {
                "name": "test-notification",
                "description": "Send a sample notification to a channel",
                "module": "general",
                "permissions": null,
                "dm_permission": null,
                "default_member_permissions": null,
                "testOnly": null,
                "type": null,
                "localizations": {
                    "nl": {
                        "name": "testmelding",
                        "description": "Stuur een testmelding naar een kanaal"
                    }
                }
            },
            {
                "name": "time",
                "description": "Convert a time into Discord timestamp formats",
                "module": "general",
                "permissions": null,
                "dm_permission": null,
                "default_member_permissions": null,
                "testOnly": null,
                "type": null,
                "localizations": {
                    "nl": {
                        "name": "tijd",
                        "description": "Zet een tijd om naar Discord-tijdstempelindelingen"
                    }
                }
            },
            {
                "name": "weather",
                "description": "Get the current weather and a short forecast for a specified location",
                "module": "general",
                "permissions": null,
                "dm_permission": null,
                "default_member_permissions": null,
                "testOnly": null,
                "type": null,
                "localizations": {
                    "nl": {
                        "name": "weer",
                        "description": "Toon het huidige weer en een korte verwachting voor een locatie"
                    }
                }
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
                "type": null,
                "localizations": {
                    "nl": {
                        "name": "league-geschiedenis",
                        "description": "Toon recente League of Legends-wedstrijden via Riot ID of gekoppelde gebruiker"
                    }
                }
            },
            {
                "name": "league-form",
                "description": "Summarize recent League of Legends form by Riot ID or linked user",
                "module": "league",
                "permissions": null,
                "dm_permission": null,
                "default_member_permissions": null,
                "testOnly": null,
                "type": null,
                "localizations": {
                    "nl": {
                        "name": "league-vorm",
                        "description": "Vat recente League of Legends-vorm samen via Riot ID of gekoppelde gebruiker"
                    }
                }
            },
            {
                "name": "league-stats",
                "description": "Get League of Legends stats by Riot ID or linked user",
                "module": "league",
                "permissions": null,
                "dm_permission": null,
                "default_member_permissions": null,
                "testOnly": null,
                "type": null,
                "localizations": {
                    "nl": {
                        "name": "league-statistieken",
                        "description": "Toon League of Legends-statistieken via Riot ID of gekoppelde gebruiker"
                    }
                }
            },
            {
                "name": "link-riot",
                "description": "Link your Discord account or another user to a Riot account",
                "module": "league",
                "permissions": null,
                "dm_permission": null,
                "default_member_permissions": null,
                "testOnly": null,
                "type": null,
                "localizations": {
                    "nl": {
                        "name": "riot-koppelen",
                        "description": "Koppel jouw Discord-account of een andere gebruiker aan een Riot-account"
                    }
                }
            },
            {
                "name": "riot-links",
                "description": "Manage linked Riot accounts",
                "module": "league",
                "permissions": null,
                "dm_permission": null,
                "default_member_permissions": null,
                "testOnly": null,
                "type": null,
                "localizations": {
                    "nl": {
                        "name": "riot-koppelingen",
                        "description": "Beheer gekoppelde Riot-accounts"
                    }
                }
            },
            {
                "name": "tft-history",
                "description": "Get recent Teamfight Tactics match history by Riot ID or linked user",
                "module": "league",
                "permissions": null,
                "dm_permission": null,
                "default_member_permissions": null,
                "testOnly": null,
                "type": null,
                "localizations": {
                    "nl": {
                        "name": "tft-geschiedenis",
                        "description": "Toon recente TFT-wedstrijden via Riot ID of gekoppelde gebruiker"
                    }
                }
            },
            {
                "name": "tft-stats",
                "description": "Get Teamfight Tactics ranked stats by Riot ID or linked user",
                "module": "league",
                "permissions": null,
                "dm_permission": null,
                "default_member_permissions": null,
                "testOnly": null,
                "type": null,
                "localizations": {
                    "nl": {
                        "name": "tft-statistieken",
                        "description": "Toon TFT-rangstatistieken via Riot ID of gekoppelde gebruiker"
                    }
                }
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
                "type": null,
                "localizations": {
                    "nl": {
                        "name": "patchnotes-ophalen",
                        "description": "Toon de nieuwste patchnotes voor een spel"
                    }
                }
            },
            {
                "name": "patchnotes-history",
                "description": "Show stored patch note history for a game",
                "module": "patchnotes",
                "permissions": null,
                "dm_permission": null,
                "default_member_permissions": null,
                "testOnly": null,
                "type": null,
                "localizations": {
                    "nl": {
                        "name": "patchnotes-geschiedenis",
                        "description": "Toon opgeslagen patchnote-geschiedenis voor een spel"
                    }
                }
            },
            {
                "name": "subscribe-patchnotes",
                "description": "Subscribe a channel to patch notes for a game",
                "module": "patchnotes",
                "permissions": null,
                "dm_permission": null,
                "default_member_permissions": null,
                "testOnly": null,
                "type": null,
                "localizations": {
                    "nl": {
                        "name": "patchnotes-abonneren",
                        "description": "Abonneer een kanaal op patchnotes voor een spel"
                    }
                }
            },
            {
                "name": "manage-patchnotes",
                "description": "List, test, pause, resume, or remove patch note subscriptions",
                "module": "patchnotes",
                "permissions": null,
                "dm_permission": null,
                "default_member_permissions": null,
                "testOnly": null,
                "type": null,
                "localizations": {
                    "nl": {
                        "name": "patchnotes-beheren",
                        "description": "Bekijk, test, pauzeer, hervat of verwijder patchnote-abonnementen"
                    }
                }
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
                "type": null,
                "localizations": {
                    "nl": {
                        "name": "citaat-toevoegen",
                        "description": "Voeg een citaat toe"
                    }
                }
            },
            {
                "name": "delete-quote",
                "description": "Delete a quote you added or authored",
                "module": "quotes",
                "permissions": null,
                "dm_permission": null,
                "default_member_permissions": null,
                "testOnly": null,
                "type": null,
                "localizations": {
                    "nl": {
                        "name": "citaat-verwijderen",
                        "description": "Verwijder een citaat dat je toevoegde of uitsprak"
                    }
                }
            },
            {
                "name": "quote-leaderboard",
                "description": "Show the most quoted users in this server",
                "module": "quotes",
                "permissions": null,
                "dm_permission": null,
                "default_member_permissions": null,
                "testOnly": null,
                "type": null,
                "localizations": {
                    "nl": {
                        "name": "citaten-klassement",
                        "description": "Toon de meest geciteerde gebruikers op deze server"
                    }
                }
            },
            {
                "name": "quote-card",
                "description": "Render an approved quote as a shareable image",
                "module": "quotes",
                "permissions": null,
                "dm_permission": null,
                "default_member_permissions": null,
                "testOnly": null,
                "type": null,
                "localizations": {
                    "nl": {
                        "name": "citaatkaart",
                        "description": "Maak van een goedgekeurd citaat een deelbare afbeelding"
                    }
                }
            },
            {
                "name": "quotes",
                "description": "Get all quotes for a user",
                "module": "quotes",
                "permissions": null,
                "dm_permission": null,
                "default_member_permissions": null,
                "testOnly": null,
                "type": null,
                "localizations": {
                    "nl": {
                        "name": "citaten",
                        "description": "Toon alle citaten van een gebruiker"
                    }
                }
            },
            {
                "name": "random-quote",
                "description": "Get a random quote from the server",
                "module": "quotes",
                "permissions": null,
                "dm_permission": null,
                "default_member_permissions": null,
                "testOnly": null,
                "type": null,
                "localizations": {
                    "nl": {
                        "name": "willekeurig-citaat",
                        "description": "Toon een willekeurig citaat van de server"
                    }
                }
            },
            {
                "name": "Save as Quote",
                "description": "Save a message as a quote from the message context menu",
                "module": "quotes",
                "permissions": null,
                "dm_permission": null,
                "default_member_permissions": null,
                "testOnly": null,
                "type": "message",
                "localizations": {
                    "nl": {
                        "name": "Opslaan als citaat",
                        "description": "Bewaar een bericht als citaat via het berichtenmenu"
                    }
                }
            },
            {
                "name": "search-quote",
                "description": "Search quotes by text",
                "module": "quotes",
                "permissions": null,
                "dm_permission": null,
                "default_member_permissions": null,
                "testOnly": null,
                "type": null,
                "localizations": {
                    "nl": {
                        "name": "citaten-zoeken",
                        "description": "Zoek citaten op tekst"
                    }
                }
            },
            {
                "name": "Show Quotes",
                "description": "Show quotes for a user from the user context menu",
                "module": "quotes",
                "permissions": null,
                "dm_permission": null,
                "default_member_permissions": null,
                "testOnly": null,
                "type": "user",
                "localizations": {
                    "nl": {
                        "name": "Citaten tonen",
                        "description": "Toon citaten via het gebruikersmenu"
                    }
                }
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
                "type": null,
                "localizations": {
                    "nl": {
                        "name": "herinnering-instellen",
                        "description": "Stel een herinnering in"
                    }
                }
            },
            {
                "name": "set-timezone",
                "description": "Set your timezone",
                "module": "reminders",
                "permissions": null,
                "dm_permission": null,
                "default_member_permissions": null,
                "testOnly": null,
                "type": null,
                "localizations": {
                    "nl": {
                        "name": "tijdzone-instellen",
                        "description": "Stel je tijdzone in"
                    }
                }
            },
            {
                "name": "reminders",
                "description": "List your active and paused reminders",
                "module": "reminders",
                "permissions": null,
                "dm_permission": null,
                "default_member_permissions": null,
                "testOnly": null,
                "type": null,
                "localizations": {
                    "nl": {
                        "name": "herinneringen",
                        "description": "Toon je actieve en gepauzeerde herinneringen"
                    }
                }
            },
            {
                "name": "Remind Me in 1h",
                "description": "Set a one-hour reminder for a message from the message context menu",
                "module": "reminders",
                "permissions": null,
                "dm_permission": null,
                "default_member_permissions": null,
                "testOnly": null,
                "type": "message",
                "localizations": {
                    "nl": {
                        "name": "Herinner mij over 1u",
                        "description": "Stel via het berichtenmenu een herinnering over één uur in"
                    }
                }
            },
            {
                "name": "delete-reminder",
                "description": "Delete one of your pending reminders",
                "module": "reminders",
                "permissions": null,
                "dm_permission": null,
                "default_member_permissions": null,
                "testOnly": null,
                "type": null,
                "localizations": {
                    "nl": {
                        "name": "herinnering-verwijderen",
                        "description": "Verwijder een openstaande herinnering"
                    }
                }
            },
            {
                "name": "snooze-reminder",
                "description": "Snooze one of your pending reminders",
                "module": "reminders",
                "permissions": null,
                "dm_permission": null,
                "default_member_permissions": null,
                "testOnly": null,
                "type": null,
                "localizations": {
                    "nl": {
                        "name": "herinnering-uitstellen",
                        "description": "Stel een openstaande herinnering uit"
                    }
                }
            },
            {
                "name": "pause-reminder",
                "description": "Pause one of your recurring reminders",
                "module": "reminders",
                "permissions": null,
                "dm_permission": null,
                "default_member_permissions": null,
                "testOnly": null,
                "type": null,
                "localizations": {
                    "nl": {
                        "name": "herinnering-pauzeren",
                        "description": "Pauzeer een herhalende herinnering"
                    }
                }
            },
            {
                "name": "resume-reminder",
                "description": "Resume one of your recurring reminders",
                "module": "reminders",
                "permissions": null,
                "dm_permission": null,
                "default_member_permissions": null,
                "testOnly": null,
                "type": null,
                "localizations": {
                    "nl": {
                        "name": "herinnering-hervatten",
                        "description": "Hervat een herhalende herinnering"
                    }
                }
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
                "type": null,
                "localizations": {
                    "nl": {
                        "name": "tiktok-stream-toevoegen",
                        "description": "Voeg een TikTok-account toe voor livemeldingen"
                    }
                }
            },
            {
                "name": "manage-tiktok-streams",
                "description": "List, test, pause, resume, or remove TikTok live notifications",
                "module": "tiktok",
                "permissions": "Administrator",
                "dm_permission": null,
                "default_member_permissions": null,
                "testOnly": null,
                "type": null,
                "localizations": {
                    "nl": {
                        "name": "tiktok-streams-beheren",
                        "description": "Bekijk, test, pauzeer, hervat of verwijder TikTok-livemeldingen"
                    }
                }
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
                "type": null,
                "localizations": {
                    "nl": {
                        "name": "twitch-stream-toevoegen",
                        "description": "Voeg een Twitch-stream toe voor meldingen"
                    }
                }
            },
            {
                "name": "manage-twitch-streams",
                "description": "List, test, pause, resume, or remove Twitch stream notifications",
                "module": "twitch",
                "permissions": "Administrator",
                "dm_permission": null,
                "default_member_permissions": null,
                "testOnly": null,
                "type": null,
                "localizations": {
                    "nl": {
                        "name": "twitch-streams-beheren",
                        "description": "Bekijk, test, pauzeer, hervat of verwijder Twitch-streammeldingen"
                    }
                }
            },
            {
                "name": "stream-status",
                "description": "Check whether a Twitch channel is live",
                "module": "twitch",
                "permissions": null,
                "dm_permission": null,
                "default_member_permissions": null,
                "testOnly": null,
                "type": null,
                "localizations": {
                    "nl": {
                        "name": "streamstatus",
                        "description": "Controleer of een Twitch-kanaal live is"
                    }
                }
            },
            {
                "name": "twitch-latest-vod",
                "description": "Show the latest Twitch archive VOD for a channel",
                "module": "twitch",
                "permissions": null,
                "dm_permission": null,
                "default_member_permissions": null,
                "testOnly": null,
                "type": null,
                "localizations": {
                    "nl": {
                        "name": "nieuwste-twitch-vod",
                        "description": "Toon de nieuwste Twitch-archief-VOD van een kanaal"
                    }
                }
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
                "type": null,
                "localizations": {
                    "nl": {
                        "name": "youtube-kanaal-toevoegen",
                        "description": "Voeg een YouTube-kanaal toe voor nieuwe videomeldingen"
                    }
                }
            },
            {
                "name": "manage-youtube-channels",
                "description": "List, test, pause, resume, or remove YouTube video notifications",
                "module": "youtube",
                "permissions": "Administrator",
                "dm_permission": null,
                "default_member_permissions": null,
                "testOnly": null,
                "type": null,
                "localizations": {
                    "nl": {
                        "name": "youtube-kanalen-beheren",
                        "description": "Bekijk, test, pauzeer, hervat of verwijder YouTube-videomeldingen"
                    }
                }
            },
            {
                "name": "youtube-latest",
                "description": "Show the latest video from a YouTube channel ID",
                "module": "youtube",
                "permissions": null,
                "dm_permission": null,
                "default_member_permissions": null,
                "testOnly": null,
                "type": null,
                "localizations": {
                    "nl": {
                        "name": "nieuwste-youtube-video",
                        "description": "Toon de nieuwste video van een YouTube-kanaal-ID"
                    }
                }
            }
        ]
    },
    {
        "module": {
            "name": "notes",
            "title": "Notes",
            "description": "Personal note commands"
        },
        "commands": [
            {
                "name": "notes",
                "description": "Add, list, show, and delete your personal notes",
                "module": "notes",
                "permissions": null,
                "dm_permission": null,
                "default_member_permissions": null,
                "testOnly": null,
                "type": null,
                "localizations": {
                    "nl": {
                        "name": "notities",
                        "description": "Voeg persoonlijke notities toe, bekijk ze of verwijder ze"
                    }
                }
            },
            {
                "name": "Save to Notes",
                "description": "Save a message excerpt and jump link to your private notes",
                "module": "notes",
                "permissions": null,
                "dm_permission": null,
                "default_member_permissions": null,
                "testOnly": null,
                "type": "message",
                "localizations": {
                    "nl": {
                        "name": "Opslaan in notities",
                        "description": "Bewaar een berichtfragment en link in je privénotities"
                    }
                }
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
                "type": null,
                "localizations": {
                    "nl": {
                        "name": "steamnieuws-toevoegen",
                        "description": "Voeg meldingen voor Steam-spelnieuws toe"
                    }
                }
            },
            {
                "name": "manage-steam-news",
                "description": "List, test, pause, resume, or remove Steam news notifications",
                "module": "steam",
                "permissions": "Administrator",
                "dm_permission": null,
                "default_member_permissions": null,
                "testOnly": null,
                "type": null,
                "localizations": {
                    "nl": {
                        "name": "steamnieuws-beheren",
                        "description": "Bekijk, test, pauzeer, hervat of verwijder Steamnieuwsmeldingen"
                    }
                }
            }
        ]
    }
] as const;
