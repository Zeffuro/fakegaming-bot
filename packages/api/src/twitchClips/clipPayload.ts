import { createHash } from 'node:crypto';
import type { SupportedOutputLocale } from '@zeffuro/fakegaming-common';
import { apiText } from '../localization/locale.js';
import type { TwitchClipMetadata } from './helix.js';

export function buildTwitchClipPayload(
    clip: TwitchClipMetadata,
    triggerName: string,
    configId: string,
    locale: SupportedOutputLocale,
): Record<string, unknown> {
    const fields = [
        { name: apiText(locale, 'twitchClipBroadcaster'), value: clip.broadcaster_name.slice(0, 1024), inline: true },
        { name: apiText(locale, 'twitchClipRequester'), value: triggerName.slice(0, 1024), inline: true },
    ];
    if (clip.categoryName) fields.push({ name: apiText(locale, 'twitchClipCategory'), value: clip.categoryName.slice(0, 1024), inline: true });
    if (Number.isFinite(clip.duration) && clip.duration > 0) {
        fields.push({ name: apiText(locale, 'twitchClipDuration'), value: apiText(locale, 'twitchClipSeconds', { seconds: clip.duration }), inline: true });
    }
    if (clip.downloadUrl) fields.push({ name: apiText(locale, 'twitchClipDownload'), value: `[${apiText(locale, 'twitchClipDownloadLink')}](${clip.downloadUrl})`, inline: true });
    if (clip.video_id && /^\d+$/.test(clip.video_id) && typeof clip.vod_offset === 'number' && Number.isSafeInteger(clip.vod_offset) && clip.vod_offset >= 0) {
        const seconds = clip.vod_offset;
        const time = [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60].map(value => String(value).padStart(2, '0'));
        fields.push({ name: apiText(locale, 'twitchClipBroadcast'), value: `[${time.join(':')}](https://www.twitch.tv/videos/${clip.video_id}?t=${time[0]}h${time[1]}m${time[2]}s)`, inline: true });
    }
    const createdAt = clip.created_at ? new Date(clip.created_at) : undefined;
    return {
        content: clip.url,
        allowed_mentions: { parse: [] },
        nonce: createHash('sha256').update(`twitch-clip:${clip.id}:${configId}`).digest('hex').slice(0, 24),
        enforce_nonce: true,
        embeds: [{
            title: clip.title.slice(0, 256),
            url: clip.url,
            color: 0x9146FF,
            author: { name: clip.broadcaster_name.slice(0, 256) },
            fields,
            ...(createdAt && Number.isFinite(createdAt.getTime()) ? { timestamp: createdAt.toISOString() } : {}),
            ...(clip.thumbnail_url ? { image: { url: clip.thumbnail_url } } : {}),
            footer: { text: apiText(locale, 'twitchClipTriggeredBy', { name: triggerName }) },
        }],
    };
}
