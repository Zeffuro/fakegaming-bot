import { describe, expect, it } from 'vitest';
import { buildTwitchClipPayload } from '../clipPayload.js';
import { apiText } from '../../localization/locale.js';

const clip = {
    id: 'clip', url: 'https://clips.twitch.tv/clip', title: 'Nice play',
    thumbnail_url: 'https://example.com/thumbnail.jpg', broadcaster_name: 'Streamer', broadcaster_id: '123', duration: 30,
};

describe('localized clip metadata', () => {
    it.each(['en', 'nl'] as const)('uses server %s labels and valid VOD start time', locale => {
        const payload = buildTwitchClipPayload({ ...clip, categoryName: 'Minecraft', video_id: '2260998054', vod_offset: 2449, created_at: '2026-10-04T17:24:07Z' }, 'Viewer', 'config', locale);
        expect(payload).toMatchObject({ allowed_mentions: { parse: [] }, embeds: [{
            title: clip.title, timestamp: '2026-10-04T17:24:07.000Z', fields: expect.arrayContaining([
                { name: apiText(locale, 'twitchClipRequester'), value: 'Viewer', inline: true },
                { name: apiText(locale, 'twitchClipCategory'), value: 'Minecraft', inline: true },
                { name: apiText(locale, 'twitchClipBroadcast'), value: '[00:40:49](https://www.twitch.tv/videos/2260998054?t=00h40m49s)', inline: true },
            ]),
        }] });
    });

    it('omits unknown or invalid VOD metadata without inventing a download link', () => {
        for (const vod_offset of [undefined, null, -1, NaN, Infinity, 0.5]) {
            const payload = buildTwitchClipPayload({ ...clip, video_id: '2260998054', vod_offset, created_at: 'invalid' }, 'Viewer', 'config', 'en');
            expect(JSON.stringify(payload)).not.toContain('twitch.tv/videos/');
            expect(JSON.stringify(payload)).not.toContain('timestamp');
            expect(JSON.stringify(payload)).not.toContain('.mp4');
        }
        const start = buildTwitchClipPayload({ ...clip, video_id: '123', vod_offset: 0 }, 'Viewer', 'config', 'en');
        expect(JSON.stringify(start)).toContain('00h00m00s');
    });
});
