import {jest} from '@jest/globals';
import {setupCommandWithInteraction} from '../../../test/utils/commandTestHelper.js';
import {QuoteManager} from '@zeffuro/fakegaming-common/managers';
import {CommandInteraction} from 'discord.js';

describe('randomQuote command', () => {
    beforeEach(() => {
        jest.resetModules();
        jest.clearAllMocks();
    });

    it('replies with a random quote', async () => {
        const {command, mockManager, interaction} = await setupCommandWithInteraction({
            managerClass: QuoteManager,
            managerKey: 'quoteManager',
            commandPath: '../../modules/quotes/commands/randomQuote.js',
            interactionOptions: {guildId: 'guild1'}
        });

        const quotes = [
            {quote: 'Quote 1', authorId: '1', timestamp: 1700000000000},
            {quote: 'Quote 2', authorId: '2', timestamp: 1700000001000},
        ];
        mockManager.getQuotesByGuild.mockReturnValue(quotes);

        await command.execute(interaction as unknown as CommandInteraction);

        expect(mockManager.getQuotesByGuild).toHaveBeenCalledWith({guildId: 'guild1'});
        expect(interaction.reply).toHaveBeenCalledWith(
            expect.stringMatching(/> (Quote 1|Quote 2)\n— <@\d+> \(.+\)/)
        );
    });

    it('replies with no quotes found', async () => {
        const {command, mockManager, interaction} = await setupCommandWithInteraction({
            managerClass: QuoteManager,
            managerKey: 'quoteManager',
            commandPath: '../../modules/quotes/commands/randomQuote.js',
            interactionOptions: {guildId: 'guild1'}
        });
        mockManager.getQuotesByGuild.mockReturnValue([]);
        await command.execute(interaction as unknown as CommandInteraction);
        expect(interaction.reply).toHaveBeenCalledWith('No quotes found for this server.');
    });
});
