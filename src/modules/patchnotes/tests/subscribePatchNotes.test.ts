import {setupCommandTest} from '../../../test/utils/commandTestHelper.js';
import {MockInteraction} from '../../../test/MockInteraction.js';
import {PatchSubscriptionManager} from '../../../config/patchNotesManager.js';

describe('subscribePatchNotes command', () => {
    it('subscribes a channel to patch notes and replies', async () => {
        const {command, mockManager} = await setupCommandTest({
            managerClass: PatchSubscriptionManager,
            managerKey: 'patchSubscriptionManager',
            commandPath: '../../modules/patchnotes/commands/subscribePatchNotes.js',
        });

        const interaction = new MockInteraction({
            stringOptions: {game: 'League of Legends'},
            channelOptions: {channel: {id: '1234567890'}},
        });

        await command.execute(interaction as any);

        expect(mockManager.subscribe).toHaveBeenCalledWith('League of Legends', '1234567890');
        expect(interaction.reply).toHaveBeenCalledWith(
            expect.stringContaining('Subscribed <#1234567890> to patch notes for `League of Legends`.')
        );
    });
});