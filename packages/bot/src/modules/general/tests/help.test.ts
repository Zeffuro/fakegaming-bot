import {jest} from '@jest/globals';
import {setupCommandTest} from '../../../test/utils/commandTestHelper.js';
import {MockInteraction} from '../../../test/MockInteraction.js';

describe('help command', () => {
    beforeEach(() => {
        jest.resetModules();
        jest.clearAllMocks();
    });

    it('replies with a list of available commands and descriptions', async () => {
        const {command} = await setupCommandTest({
            managerClass: Object, // No manager needed for help
            managerKey: '',       // No manager key needed
            commandPath: '../../modules/general/commands/help.js',
        });

        const mockCommands = new Map([
            ['birthday', {data: {description: 'Show your birthday.'}}],
            ['remove-birthday', {data: {description: 'Remove your birthday.'}}],
        ]);

        const interaction = new MockInteraction();
        interaction.client = {commands: mockCommands};

        await command.execute(interaction as any);

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