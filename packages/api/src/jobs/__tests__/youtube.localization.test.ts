import { describe, expect, it } from 'vitest';
import { buildYoutubeEmbedPayload } from '../youtube.js';

describe('YouTube notification localization', () => {
    it('localizes framing and formatting while preserving feed content', () => {
        const result = buildYoutubeEmbedPayload({
            'yt:videoId': 'video-1',
            title: 'Provider video title',
            author: 'Provider channel',
            link: 'https://youtube.example/video-1',
            published: '2026-08-20T08:00:00.000Z',
        }, 'channel-1', {
            duration: 'PT1H2M3S',
            viewCount: '1234',
        }, null, 'nl');
        const serialized = JSON.stringify(result.payload);

        expect(result.content).toBe('Hallo @everyone, nieuwe video van Provider channel: <https://youtube.example/video-1>');
        expect(serialized).toContain('Provider video title');
        expect(serialized).toContain('Provider channel');
        expect(serialized).toContain('Duur');
        expect(serialized).toContain('1u 2m 3s');
        expect(serialized).toContain('Weergaven');
        expect(serialized).toContain('1.234');
        expect(serialized).toContain('Video bekijken');
    });

    it('localizes the missing provider author fallback', () => {
        const result = buildYoutubeEmbedPayload({
            'yt:videoId': 'video-2',
            title: 'Provider video title',
        }, 'channel-1', null, null, 'nl');

        expect(result.content).toContain('nieuwe video van Onbekend');
    });
});
