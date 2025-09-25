import {jest} from '@jest/globals';
import {setupCommandWithInteraction} from '../../../test/utils/commandTestHelper.js';
import {UserManager} from '@zeffuro/fakegaming-common/dist/managers/userManager.js';
import {CommandInteraction, User} from "discord.js";

describe('setTimezone command', () => {
    beforeEach(() => {
        jest.resetModules();
        jest.clearAllMocks();
    });

    it('sets timezone and replies with confirmation', async () => {
        const {command, mockManager, interaction} = await setupCommandWithInteraction({
            managerClass: UserManager,
            managerKey: 'userManager',
            commandPath: '../../modules/reminders/commands/setTimezone.js',
            mocks: [
                {
                    module: '../../utils/timezoneUtils.js',
                    factory: () => ({
                        isValidTimezone: jest.fn(() => true),
                        getTimezoneSuggestions: jest.fn(() => []),
                    }),
                },
            ],
            interactionOptions: {
                stringOptions: {timezone: 'Europe/Berlin'},
                user: {id: '123456789012345678'} as unknown as User,
                guildId: '135381928284343204',
            }
        });
        await command.execute(interaction as unknown as CommandInteraction);
        expect(mockManager.setTimezone).toHaveBeenCalledWith({
            discordId: '123456789012345678',
            timezone: 'Europe/Berlin',
        });
        expect(interaction.reply).toHaveBeenCalledWith(
            expect.stringContaining('Timezone set to `Europe/Berlin`.')
        );
    });

    it('replies with error for invalid timezone', async () => {
        const {command, interaction} = await setupCommandWithInteraction({
            managerClass: UserManager,
            managerKey: 'userManager',
            commandPath: '../../modules/reminders/commands/setTimezone.js',
            mocks: [
                {
                    module: '../../utils/timezoneUtils.js',
                    factory: () => ({
                        isValidTimezone: jest.fn(() => false),
                        getTimezoneSuggestions: jest.fn(() => []),
                    }),
                },
            ],
            interactionOptions: {
                stringOptions: {timezone: 'Invalid/Zone'},
                user: {id: '123456789012345678'} as unknown as User,
                guildId: '135381928284343204',
            }
        });
        await command.execute(interaction as unknown as CommandInteraction);

        expect(interaction.reply).toHaveBeenCalledWith(
            expect.stringContaining('Invalid timezone')
        );
    });
});