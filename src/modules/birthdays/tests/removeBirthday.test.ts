import {jest} from '@jest/globals';
import {setupCommandTest} from '../../../test/utils/commandTestHelper.js';
import {BirthdayManager} from '../../../config/birthdayManager.js';
import {MockInteraction} from '../../../test/MockInteraction.js';
import {PermissionFlagsBits} from 'discord.js';

describe('removeBirthday command', () => {
    beforeEach(() => {
        jest.resetModules();
        jest.clearAllMocks();
    });
    it('removes the user\'s birthday', async () => {
        const {command, mockManager} = await setupCommandTest({
            managerClass: BirthdayManager,
            managerKey: 'birthdayManager',
            commandPath: '../../modules/birthdays/commands/removeBirthday.js',
        });

        const interaction = new MockInteraction({
            user: {id: '123456789012345678'},
            guildId: '135381928284343204',
        });

        await command.execute(interaction as any);

        expect(mockManager.removeBirthday).toHaveBeenCalledWith({
            userId: '123456789012345678',
            guildId: '135381928284343204',
        });
        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({
                content: expect.stringContaining('Your birthday has been removed.'),
            })
        );
    });

    it('removes another user\'s birthday (admin)', async () => {
        const {command, mockManager} = await setupCommandTest({
            managerClass: BirthdayManager,
            managerKey: 'birthdayManager',
            commandPath: '../../modules/birthdays/commands/removeBirthday.js',
        });

        const {requireAdmin} = await import('../../../utils/permissions.js');

        const interaction = new MockInteraction({
            user: {id: '098765432987654321'},
            guildId: '135381928284343204',
            userOptions: {user: {id: '987654321098765432'}},
        });
        interaction.memberPermissions = {
            has: (perm: bigint) => perm === PermissionFlagsBits.Administrator,
        };

        await command.execute(interaction as any);

        expect(requireAdmin).toHaveBeenCalled();
        expect(mockManager.removeBirthday).toHaveBeenCalledWith({
            userId: '987654321098765432',
            guildId: '135381928284343204',
        });
        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({
                content: expect.stringContaining('<@987654321098765432>\'s birthday has been removed.'),
            })
        );
    });
});