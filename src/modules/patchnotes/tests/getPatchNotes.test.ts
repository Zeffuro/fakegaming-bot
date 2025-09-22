import {setupCommandTest} from '../../../test/utils/commandTestHelper.js';
import {MockInteraction} from '../../../test/MockInteraction.js';
import {PatchNotesManager} from '../../../config/patchNotesManager.js';

describe('getPatchNotes command', () => {
    it('replies with the latest patch note embed for Overwatch 2', async () => {
        const {command, mockManager} = await setupCommandTest({
            managerClass: PatchNotesManager,
            managerKey: 'patchNotesManager',
            commandPath: '../../modules/patchnotes/commands/getPatchNotes.js',
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

        const interaction = new MockInteraction({
            stringOptions: {game: 'Overwatch 2'}
        });

        await command.execute(interaction as any);

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