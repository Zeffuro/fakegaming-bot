import {
    NON_DEFAULT_OUTPUT_LOCALES,
    type NonDefaultOutputLocale,
} from '@zeffuro/fakegaming-common';
import {Locale} from 'discord.js';
import enAnime from '../messages/en/commands/anime.json' with { type: 'json' };
import enBirthdays from '../messages/en/commands/birthdays.json' with { type: 'json' };
import enBluesky from '../messages/en/commands/bluesky.json' with { type: 'json' };
import enGameNight from '../messages/en/commands/game-night.json' with { type: 'json' };
import enGeneral from '../messages/en/commands/general.json' with { type: 'json' };
import enLeague from '../messages/en/commands/league.json' with { type: 'json' };
import enMedia from '../messages/en/commands/media.json' with { type: 'json' };
import enNotes from '../messages/en/commands/notes.json' with { type: 'json' };
import enPatchnotes from '../messages/en/commands/patchnotes.json' with { type: 'json' };
import enQuotes from '../messages/en/commands/quotes.json' with { type: 'json' };
import enReminders from '../messages/en/commands/reminders.json' with { type: 'json' };
import enSteam from '../messages/en/commands/steam.json' with { type: 'json' };
import enTikTok from '../messages/en/commands/tiktok.json' with { type: 'json' };
import enTwitch from '../messages/en/commands/twitch.json' with { type: 'json' };
import enYouTube from '../messages/en/commands/youtube.json' with { type: 'json' };
import nlAnime from '../messages/nl/commands/anime.json' with { type: 'json' };
import nlBirthdays from '../messages/nl/commands/birthdays.json' with { type: 'json' };
import nlBluesky from '../messages/nl/commands/bluesky.json' with { type: 'json' };
import nlGameNight from '../messages/nl/commands/game-night.json' with { type: 'json' };
import nlGeneral from '../messages/nl/commands/general.json' with { type: 'json' };
import nlLeague from '../messages/nl/commands/league.json' with { type: 'json' };
import nlMedia from '../messages/nl/commands/media.json' with { type: 'json' };
import nlNotes from '../messages/nl/commands/notes.json' with { type: 'json' };
import nlPatchnotes from '../messages/nl/commands/patchnotes.json' with { type: 'json' };
import nlQuotes from '../messages/nl/commands/quotes.json' with { type: 'json' };
import nlReminders from '../messages/nl/commands/reminders.json' with { type: 'json' };
import nlSteam from '../messages/nl/commands/steam.json' with { type: 'json' };
import nlTikTok from '../messages/nl/commands/tiktok.json' with { type: 'json' };
import nlTwitch from '../messages/nl/commands/twitch.json' with { type: 'json' };
import nlYouTube from '../messages/nl/commands/youtube.json' with { type: 'json' };

interface CommandCatalogNode {
    readonly name: string;
    readonly description?: string;
    readonly choices?: Readonly<Record<string, string>>;
    readonly options?: Readonly<Record<string, CommandCatalogNode>>;
}

type CommandCatalog = Readonly<Record<string, CommandCatalogNode>>;

const COMMAND_CATALOGS = {
    en: Object.assign({}, enAnime, enBirthdays, enBluesky, enGameNight, enGeneral, enLeague, enMedia, enNotes,
        enPatchnotes, enQuotes, enReminders, enSteam, enTikTok, enTwitch, enYouTube),
    nl: Object.assign({}, nlAnime, nlBirthdays, nlBluesky, nlGameNight, nlGeneral, nlLeague, nlMedia, nlNotes,
        nlPatchnotes, nlQuotes, nlReminders, nlSteam, nlTikTok, nlTwitch, nlYouTube),
} satisfies Readonly<Record<'en' | NonDefaultOutputLocale, CommandCatalog>>;

const DISCORD_LOCALES = {
    nl: Locale.Dutch,
} satisfies Readonly<Record<NonDefaultOutputLocale, Locale>>;

interface DiscordCommandNode {
    name?: string;
    description?: string;
    name_localizations?: Record<string, string> | null;
    description_localizations?: Record<string, string> | null;
    choices?: Array<{
        name?: string;
        value?: string | number;
        name_localizations?: Record<string, string> | null;
    }>;
    options?: DiscordCommandNode[];
    [key: string]: unknown;
}

interface SerializableCommand {
    toJSON(): unknown;
}

type RootLocalizations = Readonly<Record<string, { readonly name: string; readonly description: string }>>;

/**
 * Applies package-owned command catalogs at serialization time. Some shared
 * builders add options after createSlashCommand returns, so decorating toJSON
 * is the only point at which the complete command tree is guaranteed.
 */
export function attachCommandLocalizations<T extends SerializableCommand>(
    builder: T,
    commandName: string,
    fallbackLocalizations?: RootLocalizations,
): T {
    const serialize = builder.toJSON.bind(builder);
    builder.toJSON = () => localizeCommandJson(serialize(), commandName, fallbackLocalizations);
    return builder;
}

function localizeCommandJson(value: unknown, commandName: string, fallbackLocalizations?: RootLocalizations): unknown {
    if (!isRecord(value)) return value;

    const english = (COMMAND_CATALOGS.en as CommandCatalog)[commandName];
    if (!english) {
        const node = value as DiscordCommandNode;
        for (const [locale, copy] of Object.entries(fallbackLocalizations ?? {})) {
            node.name_localizations = { ...(node.name_localizations ?? {}), [locale]: copy.name };
            if (typeof node.description === 'string' && copy.description) {
                node.description_localizations = { ...(node.description_localizations ?? {}), [locale]: copy.description };
            }
        }
        return value;
    }

    applyNode(value as DiscordCommandNode, english, commandName);
    return value;
}

function applyNode(node: DiscordCommandNode, english: CommandCatalogNode, path: string): void {
    if (node.name !== english.name) {
        throw new Error(`Command catalog name mismatch at ${path}: expected ${String(node.name)}, found ${english.name}`);
    }
    if (typeof node.description === 'string' && node.description !== english.description) {
        throw new Error(`Command catalog description mismatch at ${path}`);
    }

    for (const locale of NON_DEFAULT_OUTPUT_LOCALES) {
        const discordLocale = DISCORD_LOCALES[locale];
        const localizedRoot = (COMMAND_CATALOGS[locale] as CommandCatalog)[path.split(' > ')[0]!];
        const localized = descendCatalog(localizedRoot, path);
        if (!localized) throw new Error(`Missing ${locale} command catalog entry at ${path}`);

        node.name_localizations = { ...(node.name_localizations ?? {}), [discordLocale]: localized.name };
        if (typeof node.description === 'string') {
            if (!localized.description) throw new Error(`Missing ${locale} command description at ${path}`);
            node.description_localizations = {
                ...(node.description_localizations ?? {}),
                [discordLocale]: localized.description,
            };
        }

        for (const choice of node.choices ?? []) {
            const localizedChoice = localized.choices?.[String(choice.value)];
            if (!localizedChoice) throw new Error(`Missing ${locale} choice localization at ${path}`);
            choice.name_localizations = {
                ...(choice.name_localizations ?? {}),
                [discordLocale]: localizedChoice,
            };
        }
    }

    for (const option of node.options ?? []) {
        if (!option.name) continue;
        const englishOption = english.options?.[option.name];
        if (!englishOption) throw new Error(`Missing English command catalog entry at ${path} > ${option.name}`);
        applyNode(option, englishOption, `${path} > ${option.name}`);
    }
}

function descendCatalog(root: CommandCatalogNode | undefined, path: string): CommandCatalogNode | undefined {
    const [, ...segments] = path.split(' > ');
    return segments.reduce<CommandCatalogNode | undefined>((node, segment) => node?.options?.[segment], root);
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}
