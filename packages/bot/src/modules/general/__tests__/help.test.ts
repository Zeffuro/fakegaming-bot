import {jest} from '@jest/globals';
import {FakegamingBot} from '../../../core/FakegamingBot.js';
import {setupCommandWithInteraction} from '../../../test/utils/commandTestHelper.js';
import {Collection, CommandInteraction} from "discord.js";

describe('help command', () => {
    beforeEach(() => {
        jest.resetModules();
        jest.clearAllMocks();
    });

    it('replies with a list of available commands and descriptions', async () => {
        const {command, interaction} = await setupCommandWithInteraction({
            managerClass: Object, // No manager needed for help
            managerKey: '',       // No manager key needed
            commandPath: '../../modules/general/commands/help.js',
            interactionOptions: {}
        });
        const mockCommands = new Collection<string, {
            data: { description: string },
            execute: (interaction: CommandInteraction) => Promise<void>
        }>([
            ['birthday', {
                data: {description: 'Show your birthday.'},
                execute: async () => {
                }
            }],
            ['remove-birthday', {
                data: {description: 'Remove your birthday.'},
                execute: async () => {
                }
            }],
        ]);
        const mockClient = new FakegamingBot({intents: []});
        mockClient.commands = mockCommands;
        interaction.client = mockClient;
        await command.execute(interaction as unknown as CommandInteraction);

        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({
                content: expect.stringContaining('Available Commands:')
            })
        );
        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({
                content: expect.stringContaining('/birthday')
            })
        );
        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({
                content: expect.stringContaining('Show your birthday.')
            })
        );
        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({
                content: expect.stringContaining('/remove-birthday')
            })
        );
        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({
                content: expect.stringContaining('Remove your birthday.')
            })
        );
    });
});