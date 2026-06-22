import {describe, it, expect, vi, afterEach} from 'vitest';
import {ChatInputCommandInteraction} from 'discord.js';
import {setupCommandTest, expectReplyTextContains} from '@zeffuro/fakegaming-common/testing';
import {resolveYoutubeChannelIdApi} from '../../../utils/apiClient.js';

vi.mock('../../../utils/apiClient.js', () => ({
    resolveYoutubeChannelIdApi: vi.fn(),
}));

describe('youtube-latest command', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('reads the latest video from the public RSS feed', async () => {
        const xml = `
<feed>
  <entry>
    <yt:videoId>abc123</yt:videoId>
    <title>Latest &amp; Greatest</title>
    <published>2026-06-11T10:00:00Z</published>
    <author><name>Test Channel</name></author>
  </entry>
</feed>`;
        (globalThis as any).fetch = vi.fn().mockResolvedValue({ok: true, text: async () => xml});
        const {command, interaction} = await setupCommandTest(
            'modules/youtube/commands/youtubeLatest.js',
            {interaction: {stringOptions: {channel: 'UC123'}}}
        );

        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        expect(globalThis.fetch).toHaveBeenCalledWith(expect.stringContaining('channel_id=UC123'));
        expectReplyTextContains(interaction, 'Latest video from Test Channel');
        expectReplyTextContains(interaction, 'Latest & Greatest');
        expectReplyTextContains(interaction, 'https://www.youtube.com/watch?v=abc123');
    });

    it('resolves handles before fetching latest YouTube videos', async () => {
        vi.mocked(resolveYoutubeChannelIdApi).mockResolvedValue('UCresolved');
        const xml = `
<feed>
  <entry>
    <yt:videoId>resolved123</yt:videoId>
    <title>Handle video</title>
  </entry>
</feed>`;
        (globalThis as any).fetch = vi.fn().mockResolvedValue({ok: true, text: async () => xml});
        const {command, interaction} = await setupCommandTest(
            'modules/youtube/commands/youtubeLatest.js',
            {interaction: {stringOptions: {channel: ' @fakegaming '}}}
        );

        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        expect(resolveYoutubeChannelIdApi).toHaveBeenCalledWith('@fakegaming');
        expect(globalThis.fetch).toHaveBeenCalledWith(expect.stringContaining('channel_id=UCresolved'));
        expectReplyTextContains(interaction, 'Latest video from Unknown channel');
        expectReplyTextContains(interaction, 'Handle video');
    });

    it('reports when a YouTube channel cannot be resolved', async () => {
        vi.mocked(resolveYoutubeChannelIdApi).mockResolvedValue(null);
        (globalThis as any).fetch = vi.fn();
        const {command, interaction} = await setupCommandTest(
            'modules/youtube/commands/youtubeLatest.js',
            {interaction: {stringOptions: {channel: 'missing-channel'}}}
        );

        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        expect(globalThis.fetch).not.toHaveBeenCalled();
        expectReplyTextContains(interaction, 'Could not resolve YouTube channel `missing-channel`.');
    });

    it('reports when the YouTube feed request fails', async () => {
        (globalThis as any).fetch = vi.fn().mockResolvedValue({ok: false, text: async () => ''});
        const {command, interaction} = await setupCommandTest(
            'modules/youtube/commands/youtubeLatest.js',
            {interaction: {stringOptions: {channel: 'UC404'}}}
        );

        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        expectReplyTextContains(interaction, 'Could not fetch YouTube feed for `UC404`.');
    });

    it('reports when the YouTube feed has no usable video entries', async () => {
        (globalThis as any).fetch = vi.fn().mockResolvedValue({
            ok: true,
            text: async () => '<feed><entry><title>Missing ID</title></entry></feed>',
        });
        const {command, interaction} = await setupCommandTest(
            'modules/youtube/commands/youtubeLatest.js',
            {interaction: {stringOptions: {channel: 'UCempty'}}}
        );

        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        expectReplyTextContains(interaction, 'No videos found for `UCempty`.');
    });
});
