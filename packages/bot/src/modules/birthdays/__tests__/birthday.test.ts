import {jest} from '@jest/globals';
import {setupCommandWithInteraction} from '../../../test/utils/commandTestHelper.js';
import {BirthdayManager} from '@zeffuro/fakegaming-common/managers';
import {CommandInteraction, User} from "discord.js";

describe('birthday command', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('replies with the user\'s birthday if set', async () => {
        const {command, mockManager, interaction} = await setupCommandWithInteraction({
            managerClass: BirthdayManager,
            managerKey: 'birthdayManager',
            commandPath: '../../modules/birthdays/commands/birthday.js',
            interactionOptions: {
                userOptions: {},
                user: {id: '123456789012345678'} as unknown as User,
                guildId: '135381928284343204',
            }
        });
        mockManager.getBirthday.mockImplementation((args: unknown) => {
            const {userId, guildId} = args as { userId: string; guildId: string };
            if (userId === '123456789012345678' && guildId === '135381928284343204') {
                return {
                    userId,
                    day: 5,
                    month: 1,
                    year: 1990,
                    guildId,
                    channelId: '929533532185956352',
                };
            }
            return undefined;
        });
        await command.execute(interaction as unknown as CommandInteraction);
        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({
                content: expect.stringContaining('Your birthday: 5 January 1990'),
            })
        );
    });

    it('replies with an error if no birthday is set', async () => {
        const {command, mockManager, interaction} = await setupCommandWithInteraction({
            managerClass: BirthdayManager,
            managerKey: 'birthdayManager',
            commandPath: '../../modules/birthdays/commands/birthday.js',
            interactionOptions: {
                userOptions: {},
                user: {id: '987654321098765432'} as unknown as User,
                guildId: '246813579246813579',
            }
        });
        mockManager.getBirthday.mockImplementation(() => undefined);
        await command.execute(interaction as unknown as CommandInteraction);

        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({
                content: expect.stringContaining('You do not have a birthday set in this channel.'),
            })
        );
    });
});