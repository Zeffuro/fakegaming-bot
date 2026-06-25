import { createHmac, timingSafeEqual } from 'node:crypto';
import type { CreationAttributes } from 'sequelize';
import type { AnimeEpisode, AnimeSubscriptionConfig, AnimeTitle } from '@zeffuro/fakegaming-common/models';

const TOKEN_VERSION = 1;
const CALENDAR_WINDOW_PAST_DAYS = 7;
const CALENDAR_WINDOW_FUTURE_DAYS = 370;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface AnimeCalendarTokenPayload {
    u: string;
    v: number;
}

export interface AnimeCalendarLink {
    path: string;
    token: string;
    url: string;
}

export interface AnimeCalendarFeedInput {
    episodesByAnilistId: Map<number, CreationAttributes<AnimeEpisode>[]>;
    generatedAt?: Date;
    subscriptions: CreationAttributes<AnimeSubscriptionConfig>[];
    titlesByAnilistId: Map<number, CreationAttributes<AnimeTitle>>;
    userId: string;
}

interface AnimeCalendarEvent {
    airingAt: number;
    anilistId: number;
    description: string;
    durationMinutes: number;
    episode: number;
    siteUrl: string | null;
    summary: string;
    title: string;
    uid: string;
}

export function signAnimeCalendarToken(userId: string, secret: string): string {
    const payload = encodeBase64Url(JSON.stringify({ u: userId, v: TOKEN_VERSION } satisfies AnimeCalendarTokenPayload));
    const signature = signPayload(payload, secret);
    return `${payload}.${signature}`;
}

export function verifyAnimeCalendarToken(token: string, secret: string): AnimeCalendarTokenPayload | null {
    const [payload, signature, extra] = token.split('.');
    if (!payload || !signature || extra !== undefined) return null;

    const expected = signPayload(payload, secret);
    if (!timingSafeEqualBuffer(signature, expected)) return null;

    try {
        const parsed = JSON.parse(decodeBase64Url(payload)) as unknown;
        if (!isCalendarTokenPayload(parsed)) return null;
        return parsed;
    } catch {
        return null;
    }
}

export function buildAnimeCalendarLink(args: { publicBaseUrl: string; token: string }): AnimeCalendarLink {
    const path = `/api/anime/calendar.ics?token=${encodeURIComponent(args.token)}`;
    return {
        path,
        token: args.token,
        url: `${args.publicBaseUrl.replace(/\/$/, '')}${path}`,
    };
}

export function buildAnimeCalendarFeed(input: AnimeCalendarFeedInput): string {
    const generatedAt = input.generatedAt ?? new Date();
    const events = buildAnimeCalendarEvents(input, generatedAt);
    const lines = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Fakegaming//Anime Calendar//EN',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        'X-WR-CALNAME:Fakegaming Anime Reminders',
        'X-WR-TIMEZONE:UTC',
        `DTSTAMP:${formatIcsDate(generatedAt.getTime())}`,
        ...events.flatMap(event => serializeAnimeCalendarEvent(event, generatedAt)),
        'END:VCALENDAR',
    ];

    return `${lines.flatMap(foldIcsLine).join('\r\n')}\r\n`;
}

function buildAnimeCalendarEvents(input: AnimeCalendarFeedInput, generatedAt: Date): AnimeCalendarEvent[] {
    const from = generatedAt.getTime() - (CALENDAR_WINDOW_PAST_DAYS * DAY_MS);
    const to = generatedAt.getTime() + (CALENDAR_WINDOW_FUTURE_DAYS * DAY_MS);
    const events = new Map<string, AnimeCalendarEvent>();

    for (const subscription of input.subscriptions) {
        if (Boolean(subscription.paused)) continue;
        const title = input.titlesByAnilistId.get(subscription.anilistId);
        const titleText = resolveAnimeTitle(subscription.anilistId, title);
        const siteUrl = title?.siteUrl ?? `https://anilist.co/anime/${subscription.anilistId}`;
        const durationMinutes = title?.duration && title.duration > 0 ? title.duration : 30;
        const sourceEpisodes = input.episodesByAnilistId.get(subscription.anilistId) ?? [];
        const fallbackEpisode = title?.nextEpisode && title?.nextAiringAt
            ? [{ anilistId: subscription.anilistId, episode: title.nextEpisode, airingAt: title.nextAiringAt } as CreationAttributes<AnimeEpisode>]
            : [];

        for (const episode of [...sourceEpisodes, ...fallbackEpisode]) {
            if (!Number.isFinite(episode.airingAt) || episode.airingAt < from || episode.airingAt > to) continue;
            const key = `${subscription.anilistId}:${episode.episode}`;
            if (events.has(key)) continue;
            const summary = `${titleText} Episode ${episode.episode}`;
            events.set(key, {
                airingAt: episode.airingAt,
                anilistId: subscription.anilistId,
                description: [
                    `AniList #${subscription.anilistId}`,
                    `Reminder ${subscription.reminderMinutes ?? 30} minutes before airing`,
                    siteUrl,
                ].filter(Boolean).join('\n'),
                durationMinutes,
                episode: episode.episode,
                siteUrl,
                summary,
                title: titleText,
                uid: `anime-${subscription.anilistId}-${episode.episode}@fakegaming`,
            });
        }
    }

    return [...events.values()].sort((left, right) => left.airingAt - right.airingAt || left.anilistId - right.anilistId || left.episode - right.episode);
}

function serializeAnimeCalendarEvent(event: AnimeCalendarEvent, generatedAt: Date): string[] {
    const start = event.airingAt;
    const end = start + (event.durationMinutes * 60 * 1000);
    return [
        'BEGIN:VEVENT',
        `UID:${escapeIcsText(event.uid)}`,
        `DTSTAMP:${formatIcsDate(generatedAt.getTime())}`,
        `DTSTART:${formatIcsDate(start)}`,
        `DTEND:${formatIcsDate(end)}`,
        `SUMMARY:${escapeIcsText(event.summary)}`,
        `DESCRIPTION:${escapeIcsText(event.description)}`,
        event.siteUrl ? `URL:${escapeIcsText(event.siteUrl)}` : null,
        'END:VEVENT',
    ].filter((line): line is string => Boolean(line));
}

function resolveAnimeTitle(anilistId: number, title: CreationAttributes<AnimeTitle> | undefined): string {
    return title?.titleEnglish ?? title?.titleRomaji ?? title?.titleNative ?? `AniList #${anilistId}`;
}

function isCalendarTokenPayload(value: unknown): value is AnimeCalendarTokenPayload {
    return typeof value === 'object'
        && value !== null
        && (value as { v?: unknown }).v === TOKEN_VERSION
        && typeof (value as { u?: unknown }).u === 'string'
        && (value as { u: string }).u.length > 0;
}

function signPayload(payload: string, secret: string): string {
    return createHmac('sha256', secret)
        .update(payload)
        .digest('base64url');
}

function timingSafeEqualBuffer(left: string, right: string): boolean {
    const leftBuffer = Buffer.from(left);
    const rightBuffer = Buffer.from(right);
    return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function encodeBase64Url(value: string): string {
    return Buffer.from(value, 'utf8').toString('base64url');
}

function decodeBase64Url(value: string): string {
    return Buffer.from(value, 'base64url').toString('utf8');
}

function formatIcsDate(value: number): string {
    return new Date(value)
        .toISOString()
        .replace(/[-:]/g, '')
        .replace(/\.\d{3}Z$/, 'Z');
}

function escapeIcsText(value: string): string {
    return value
        .replace(/\\/g, '\\\\')
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .replace(/\n/g, '\\n')
        .replace(/;/g, '\\;')
        .replace(/,/g, '\\,');
}

function foldIcsLine(line: string): string[] {
    if (line.length <= 75) return [line];
    const chunks: string[] = [];
    let remaining = line;
    chunks.push(remaining.slice(0, 75));
    remaining = remaining.slice(75);
    while (remaining.length > 0) {
        chunks.push(` ${remaining.slice(0, 74)}`);
        remaining = remaining.slice(74);
    }
    return chunks;
}
