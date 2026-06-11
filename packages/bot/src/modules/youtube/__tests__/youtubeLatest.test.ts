import {describe, it, expect, vi, afterEach} from 'vitest';
import {ChatInputCommandInteraction} from 'discord.js';
import {setupCommandTest, expectReplyTextContains} from '@zeffuro/fakegaming-common/testing';

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
});
