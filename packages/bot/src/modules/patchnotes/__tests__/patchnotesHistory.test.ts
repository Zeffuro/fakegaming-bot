import {ChatInputCommandInteraction} from 'discord.js';
import {describe, expect, it, vi} from 'vitest';
import {
    expectReplyHasEmbedsArray,
    expectReplyText,
    setupCommandTest,
} from '@zeffuro/fakegaming-common/testing';

describe('patchnotes history command', () => {
    it('reports when no stored patch history exists', async () => {
        const getHistory = vi.fn(async () => []);
        const {command, interaction} = await setupCommandTest('modules/patchnotes/commands/patchnotesHistory.js', {
            interaction: {
                stringOptions: {game: 'LeagueOfLegends'},
            },
            managerOverrides: {
                patchNoteHistoryManager: {getHistory},
            },
        });

        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        expect(getHistory).toHaveBeenCalledWith('LeagueOfLegends', 3);
        expectReplyText(interaction, 'No stored patch history found for `LeagueOfLegends` yet.');
    });

    it('replies with stored history embeds using the requested count', async () => {
        const getHistory = vi.fn(async () => [
            {
                game: 'LeagueOfLegends',
                title: 'Patch 1.0',
                content: 'Balance changes',
                url: 'https://example.com/patch-1',
                publishedAt: 1_700_000_000_000,
                accentColor: null,
                imageUrl: null,
                logoUrl: null,
            },
        ]);
        const {command, interaction} = await setupCommandTest('modules/patchnotes/commands/patchnotesHistory.js', {
            interaction: {
                stringOptions: {game: 'LeagueOfLegends'},
                integerOptions: {count: 1},
            },
            managerOverrides: {
                patchNoteHistoryManager: {getHistory},
            },
        });

        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        expect(getHistory).toHaveBeenCalledWith('LeagueOfLegends', 1);
        expectReplyHasEmbedsArray(interaction);
    });
});
