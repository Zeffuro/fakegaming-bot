import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildTwitchEmbedAndContent, buildTwitchVodEmbedAndContent } from '../twitch.js';

describe('Twitch notification localization', () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    it('localizes live framing and formatting while preserving Twitch and custom content', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-08-20T12:30:00.000Z'));

        const result = buildTwitchEmbedAndContent({
            locale: 'nl',
            user: {
                id: 'user-1',
                login: 'provider-login',
                display_name: 'Provider Name',
                profile_image_url: 'https://provider.example/avatar.png',
            },
            stream: {
                id: 'stream-1',
                user_id: 'user-1',
                title: 'Provider-authored stream title',
                viewer_count: 1234,
                started_at: '2026-08-20T10:00:00.000Z',
            },
            gameName: 'Provider Game',
            customMessage: 'Custom: {streamer} - {title} - {viewers}',
        });
        const serialized = JSON.stringify(result.payload);

        expect(result.content).toContain('Custom: Provider Name - Provider-authored stream title - 1.234');
        expect(serialized).toContain('Provider Name is nu live!');
        expect(serialized).toContain('Provider-authored stream title');
        expect(serialized).toContain('Provider Game');
        expect(serialized).toContain('Kijkers');
        expect(serialized).toContain('Livestreamduur');
        expect(serialized).toContain('2u 30m');
        expect(serialized).toContain('Livestream bekijken');
    });

    it('localizes VOD fallbacks and labels while preserving provider values', () => {
        const result = buildTwitchVodEmbedAndContent({
            locale: 'nl',
            user: { id: 'user-1', login: 'provider-login', display_name: 'Provider Name' },
            video: {
                id: 'vod-1',
                user_id: 'user-1',
                title: '',
                duration: '1h2m3s',
                view_count: 1234,
                url: 'https://provider.example/vod-1',
            },
        });
        const serialized = JSON.stringify(result.payload);

        expect(result.content).toBe('Nieuwste VOD van Provider Name: <https://provider.example/vod-1>');
        expect(serialized).toContain('Nieuwste VOD van Provider Name');
        expect(serialized).toContain('Nieuwste Twitch-opname van Provider Name.');
        expect(serialized).toContain('Duur');
        expect(serialized).toContain('1h2m3s');
        expect(serialized).toContain('Weergaven');
        expect(serialized).toContain('1.234');
        expect(serialized).toContain('VOD bekijken');
    });

    it('keeps English as the builder default', () => {
        const result = buildTwitchEmbedAndContent({
            user: { id: 'user-1', login: 'provider-login' },
            stream: { id: 'stream-1', user_id: 'user-1', title: '', viewer_count: undefined },
        });
        const serialized = JSON.stringify(result.payload);

        expect(result.content).toContain('provider-login is now live!');
        expect(serialized).toContain('Live on Twitch!');
        expect(serialized).toContain('N/A');
        expect(serialized).toContain('Watch Stream');
    });
});
