import {jest} from '@jest/globals';
import {setupCommandTest} from '../../../test/utils/commandTestHelper.js';
import {MockInteraction} from '../../../test/MockInteraction.js';
import {
    PatchNotesManager,
    PatchSubscriptionManager
} from '@zeffuro/fakegaming-common/managers';
import {CommandInteraction, GuildTextBasedChannel} from "discord.js";

describe('subscribePatchNotes command', () => {
    it('subscribes a channel to patch notes and replies', async () => {
        const {command, mockManager, getConfigManager} = await setupCommandTest({
            managerClass: PatchSubscriptionManager,
            managerKey: 'patchSubscriptionManager',
            commandPath: '../../modules/patchnotes/commands/subscribePatchNotes.js',
        });

        const patchNotesManagerMock = {
            getLatestPatch: jest.fn()
        } as unknown as PatchNotesManager;

        getConfigManager().patchNotesManager = patchNotesManagerMock;

        const interaction = new MockInteraction({
            stringOptions: {game: 'League of Legends'},
            channelOptions: {channel: {id: '1234567890'} as unknown as GuildTextBasedChannel},
        });

        await command.execute(interaction as unknown as CommandInteraction);

        expect(mockManager.subscribe).toHaveBeenCalledWith('League of Legends', '1234567890', '135381928284343204');
        expect(interaction.reply).toHaveBeenCalledWith(
            expect.stringContaining('Subscribed <#1234567890> to patch notes for `League of Legends`.')
        );
    });
});