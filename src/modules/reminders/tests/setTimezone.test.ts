import {jest} from '@jest/globals';
import {setupCommandTest} from '../../../test/utils/commandTestHelper.js';
import {MockInteraction} from '../../../test/MockInteraction.js';
import {UserManager} from '../../../config/userManager.js';

describe('setTimezone command', () => {
    beforeEach(() => {
        jest.resetModules();
        jest.clearAllMocks();
    });

    it('sets timezone and replies with confirmation', async () => {
        const {command, mockManager} = await setupCommandTest({
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
        });

        const interaction = new MockInteraction({
            stringOptions: {timezone: 'Europe/Berlin'},
            user: {id: '123456789012345678'},
            guildId: '135381928284343204',
        });

        await command.execute(interaction as any);

        expect(mockManager.setTimezone).toHaveBeenCalledWith({
            discordId: '123456789012345678',
            timezone: 'Europe/Berlin',
        });
        expect(interaction.reply).toHaveBeenCalledWith(
            expect.stringContaining('Timezone set to `Europe/Berlin`.')
        );
    });

    it('replies with error for invalid timezone', async () => {
        const {command} = await setupCommandTest({
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
        });

        const interaction = new MockInteraction({
            stringOptions: {timezone: 'Invalid/Zone'},
            user: {id: '123456789012345678'},
            guildId: '135381928284343204',
        });

        await command.execute(interaction as any);

        expect(interaction.reply).toHaveBeenCalledWith(
            expect.stringContaining('Invalid timezone')
        );
    });
});