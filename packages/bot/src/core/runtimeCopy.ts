import { resolveLocaleValue, type OutputLocaleValues } from '@zeffuro/fakegaming-common';
import { createBotTranslator, type BotMessages, type BotTranslationValues, type NestedMessageKey, type SupportedOutputLocale } from './localization.js';
import enAnime from '../messages/en/runtime/anime.json' with { type: 'json' };
import enBirthdays from '../messages/en/runtime/birthdays.json' with { type: 'json' };
import enBluesky from '../messages/en/runtime/bluesky.json' with { type: 'json' };
import enCore from '../messages/en/runtime/core.json' with { type: 'json' };
import enLeague from '../messages/en/runtime/league.json' with { type: 'json' };
import enPatchnotes from '../messages/en/runtime/patchnotes.json' with { type: 'json' };
import enQuotes from '../messages/en/runtime/quotes.json' with { type: 'json' };
import enReminders from '../messages/en/runtime/reminders.json' with { type: 'json' };
import enShared from '../messages/en/runtime/shared.json' with { type: 'json' };
import enSteam from '../messages/en/runtime/steam.json' with { type: 'json' };
import enTikTok from '../messages/en/runtime/tiktok.json' with { type: 'json' };
import enTwitch from '../messages/en/runtime/twitch.json' with { type: 'json' };
import enYouTube from '../messages/en/runtime/youtube.json' with { type: 'json' };
import nlAnime from '../messages/nl/runtime/anime.json' with { type: 'json' };
import nlBirthdays from '../messages/nl/runtime/birthdays.json' with { type: 'json' };
import nlBluesky from '../messages/nl/runtime/bluesky.json' with { type: 'json' };
import nlCore from '../messages/nl/runtime/core.json' with { type: 'json' };
import nlLeague from '../messages/nl/runtime/league.json' with { type: 'json' };
import nlPatchnotes from '../messages/nl/runtime/patchnotes.json' with { type: 'json' };
import nlQuotes from '../messages/nl/runtime/quotes.json' with { type: 'json' };
import nlReminders from '../messages/nl/runtime/reminders.json' with { type: 'json' };
import nlShared from '../messages/nl/runtime/shared.json' with { type: 'json' };
import nlSteam from '../messages/nl/runtime/steam.json' with { type: 'json' };
import nlTikTok from '../messages/nl/runtime/tiktok.json' with { type: 'json' };
import nlTwitch from '../messages/nl/runtime/twitch.json' with { type: 'json' };
import nlYouTube from '../messages/nl/runtime/youtube.json' with { type: 'json' };

export const BOT_RUNTIME_MESSAGES = {
    en: { anime: enAnime, birthdays: enBirthdays, bluesky: enBluesky, core: enCore,
        league: enLeague, patchnotes: enPatchnotes, quotes: enQuotes, reminders: enReminders, shared: enShared,
        steam: enSteam, tiktok: enTikTok, twitch: enTwitch, youtube: enYouTube },
    nl: { anime: nlAnime, birthdays: nlBirthdays, bluesky: nlBluesky, core: nlCore,
        league: nlLeague, patchnotes: nlPatchnotes, quotes: nlQuotes, reminders: nlReminders, shared: nlShared,
        steam: nlSteam, tiktok: nlTikTok, twitch: nlTwitch, youtube: nlYouTube },
} satisfies OutputLocaleValues<Record<string, BotMessages>>;

type RuntimeMessages = typeof BOT_RUNTIME_MESSAGES.en;
type RuntimeDomain = keyof RuntimeMessages;
export type RuntimeMessageKey<Domain extends RuntimeDomain> = NestedMessageKey<RuntimeMessages[Domain]>;

type RuntimeTranslator = (key: string, values?: BotTranslationValues) => string;
const TRANSLATOR_CACHE = new Map<string, RuntimeTranslator>();

export function runtimeText<Domain extends RuntimeDomain>(
    locale: SupportedOutputLocale,
    domain: Domain,
    key: RuntimeMessageKey<Domain>,
    values?: BotTranslationValues,
): string {
    const cacheKey = `${locale}:${domain}`;
    let translate = TRANSLATOR_CACHE.get(cacheKey);
    if (!translate) {
        const domainMessages = resolveLocaleValue(locale, BOT_RUNTIME_MESSAGES)[domain] as RuntimeMessages[Domain];
        translate = createBotTranslator(locale, domainMessages) as RuntimeTranslator;
        TRANSLATOR_CACHE.set(cacheKey, translate);
    }
    return translate(key, values);
}
