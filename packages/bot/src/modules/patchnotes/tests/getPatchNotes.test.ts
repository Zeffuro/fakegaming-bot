import {setupCommandWithInteraction} from '../../../test/utils/commandTestHelper.js';
import {PatchNotesManager} from '@zeffuro/fakegaming-common/dist/managers/patchNotesManager.js';
import {CommandInteraction} from "discord.js";

describe('getPatchNotes command', () => {
    it('replies with the latest patch note embed for Overwatch 2', async () => {
        const {command, mockManager, interaction} = await setupCommandWithInteraction({
            managerClass: PatchNotesManager,
            managerKey: 'patchNotesManager',
            commandPath: '../../modules/patchnotes/commands/getPatchNotes.js',
            interactionOptions: {stringOptions: {game: 'Overwatch 2'}}
        });
        // Mock the latest patch note
        mockManager.getLatestPatch.mockReturnValue({
            game: 'Overwatch 2',
            title: 'Patch Notes - June 2025',
            content: 'Balance changes and bug fixes.',
            url: 'https://overwatch.blizzard.com/en-us/news/patch-notes/',
            publishedAt: Date.now(),
            logoUrl: 'https://commons.wikimedia.org/w/index.php?title=Special:Redirect/file/Overwatch_2_logo.webp',
            imageUrl: undefined,
            version: '2025-06-01',
            accentColor: 0xFF8000
        });
        await command.execute(interaction as unknown as CommandInteraction);

        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({
                embeds: [expect.objectContaining({
                    data: expect.objectContaining({
                        title: 'Patch Notes - June 2025',
                        description: expect.stringContaining('Balance changes and bug fixes.')
                    })
                })]
            })
        );
    });
});