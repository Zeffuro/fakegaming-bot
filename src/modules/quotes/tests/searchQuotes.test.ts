import {jest} from '@jest/globals';
import {setupCommandTest} from '../../../test/utils/commandTestHelper.js';
import {MockInteraction} from '../../../test/MockInteraction.js';
import {QuoteManager} from '../../../config/quoteManager.js';

describe('searchQuote command', () => {
    beforeEach(() => {
        jest.resetModules();
        jest.clearAllMocks();
    });

    it('replies with matching quotes', async () => {
        const {command, mockManager} = await setupCommandTest({
            managerClass: QuoteManager,
            managerKey: 'quoteManager',
            commandPath: '../../modules/quotes/commands/searchQuote.js',
        });

        mockManager.searchQuotes.mockReturnValue([
            {
                quote: 'Test quote match',
                authorId: '123456789012345678',
                timestamp: 1700000000000,
            },
        ]);

        const interaction = new MockInteraction({
            stringOptions: {text: 'match'},
            guildId: '135381928284343204',
        });

        await command.execute(interaction as any);

        expect(mockManager.searchQuotes).toHaveBeenCalledWith({
            guildId: '135381928284343204',
            text: 'match',
        });
        expect(interaction.reply).toHaveBeenCalledWith(
            expect.stringContaining('Quotes matching "match"')
        );
        expect(interaction.reply).toHaveBeenCalledWith(
            expect.stringContaining('Test quote match')
        );
    });

    it('replies with no quotes found', async () => {
        const {command, mockManager} = await setupCommandTest({
            managerClass: QuoteManager,
            managerKey: 'quoteManager',
            commandPath: '../../modules/quotes/commands/searchQuote.js',
        });

        mockManager.searchQuotes.mockReturnValue([]);

        const interaction = new MockInteraction({
            stringOptions: {text: 'missing'},
            guildId: '135381928284343204',
        });

        await command.execute(interaction as any);

        expect(interaction.reply).toHaveBeenCalledWith(
            expect.stringContaining('No quotes found matching your search.')
        );
    });
});