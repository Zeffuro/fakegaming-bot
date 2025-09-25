import {jest} from '@jest/globals';
import {setupCommandWithInteraction} from '../../../test/utils/commandTestHelper.js';
import {BirthdayManager} from '@zeffuro/fakegaming-common/dist/managers/birthdayManager.js';
import {CommandInteraction, PermissionFlagsBits, User} from 'discord.js';

describe('removeBirthday command', () => {
    beforeEach(() => {
        jest.resetModules();
        jest.clearAllMocks();
    });
    it('removes the user\'s birthday', async () => {
        const {command, mockManager, interaction} = await setupCommandWithInteraction({
            managerClass: BirthdayManager,
            managerKey: 'birthdayManager',
            commandPath: '../../modules/birthdays/commands/removeBirthday.js',
            interactionOptions: {
                user: {id: '123456789012345678'} as unknown as User,
                guildId: '135381928284343204',
            }
        });
        await command.execute(interaction as unknown as CommandInteraction);
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
        const {command, mockManager, interaction} = await setupCommandWithInteraction({
            managerClass: BirthdayManager,
            managerKey: 'birthdayManager',
            commandPath: '../../modules/birthdays/commands/removeBirthday.js',
            interactionOptions: {
                user: {id: '098765432987654321'} as unknown as User,
                guildId: '135381928284343204',
                userOptions: {user: {id: '987654321098765432'} as unknown as User},
                memberPermissions: {
                    has: (perm: bigint) => perm === PermissionFlagsBits.Administrator,
                },
            }
        });
        const {requireAdmin} = await import('../../../utils/permissions.js');
        await command.execute(interaction as unknown as CommandInteraction);

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