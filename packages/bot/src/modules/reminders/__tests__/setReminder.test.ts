import {jest} from '@jest/globals';
import {setupCommandWithInteraction} from '../../../test/utils/commandTestHelper.js';
import {ReminderManager} from '@zeffuro/fakegaming-common/dist/managers/reminderManager.js';
import {CommandInteraction, User} from "discord.js";

describe('setReminder command', () => {
    beforeEach(() => {
        jest.resetModules();
        jest.clearAllMocks();
    });

    it('sets a reminder and replies with confirmation', async () => {
        const {command, mockManager, interaction} = await setupCommandWithInteraction({
            managerClass: ReminderManager,
            managerKey: 'reminderManager',
            commandPath: '../../modules/reminders/commands/setReminder.js',
            mocks: [
                {
                    module: '../../utils/timeUtils.js',
                    factory: () => ({
                        parseTimespan: jest.fn(() => 3600000), // 1h in ms
                    }),
                },
                {
                    module: 'uuid',
                    factory: () => ({
                        v4: jest.fn(() => 'b7e6a8c2-3f4b-4e2a-9c1d-8f2e7a6b5c3d'),
                    }),
                },
            ],
            interactionOptions: {
                stringOptions: {timespan: '1h', message: 'Take a break!'},
                user: {id: '123456789012345678'} as unknown as User,
                guildId: '135381928284343204',
            }
        });
        await command.execute(interaction as unknown as CommandInteraction);
        expect(mockManager.add).toHaveBeenCalledWith(
            expect.objectContaining({
                id: 'b7e6a8c2-3f4b-4e2a-9c1d-8f2e7a6b5c3d',
                userId: '123456789012345678',
                message: 'Take a break!',
                timespan: '1h',
                timestamp: expect.any(Number),
            })
        );
        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({
                content: expect.stringContaining('⏰ I\'ll remind you in 1h: "Take a break!"'),
            })
        );
    });

    it('replies with error for invalid timespan', async () => {
        const {command, interaction} = await setupCommandWithInteraction({
            managerClass: ReminderManager,
            managerKey: 'reminderManager',
            commandPath: '../../modules/reminders/commands/setReminder.js',
            mocks: [
                {
                    module: '../../utils/timeUtils.js',
                    factory: () => ({
                        parseTimespan: jest.fn(() => null),
                    }),
                },
            ],
            interactionOptions: {
                stringOptions: {timespan: 'notatime', message: 'Test'},
                user: {id: '123456789012345678'} as unknown as User,
                guildId: '135381928284343204',
            }
        });
        await command.execute(interaction as unknown as CommandInteraction);

        expect(interaction.reply).toHaveBeenCalledWith(
            expect.stringContaining('Invalid timespan format')
        );
    });
});