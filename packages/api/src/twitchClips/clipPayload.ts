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
            ...(clip.thumbnail_url ? { image: { url: clip.thumbnail_url } } : {}),
            footer: { text: apiText(locale, 'twitchClipTriggeredBy', { name: triggerName }) },
        }],
    };
}
