import {jest} from '@jest/globals';
import {setupCommandTest} from '../../../test/utils/commandTestHelper.js';
import {MockInteraction} from '../../../test/MockInteraction.js';
import {QuoteManager} from '../../../../../common/src/managers/quoteManager.js';
import {User} from 'discord.js';

describe('quotes command', () => {
    beforeEach(() => {
        jest.resetModules();
        jest.clearAllMocks();
    });

    it('replies with all quotes for a user', async () => {
        const {command, mockManager} = await setupCommandTest({
            managerClass: QuoteManager,
            managerKey: 'quoteManager',
            commandPath: '../../modules/quotes/commands/quotes.js',
        });

        mockManager.getQuotesByAuthor.mockReturnValue([
            {
                quote: 'First quote',
                authorId: '123456789012345678',
                timestamp: 1700000000000,
            },
            {
                quote: 'Second quote',
                authorId: '123456789012345678',
                timestamp: 1700000001000,
            },
        ]);

        const interaction = new MockInteraction({
            userOptions: {user: {id: '123456789012345678', tag: 'Author#0001'} as User},
            guildId: '135381928284343204',
        });

        await command.execute(interaction as any);

        expect(mockManager.getQuotesByAuthor).toHaveBeenCalledWith({
            guildId: '135381928284343204',
            authorId: '123456789012345678',
        });
        expect(interaction.reply).toHaveBeenCalledWith(
            expect.stringContaining('Quotes for Author#0001')
        );
        expect(interaction.reply).toHaveBeenCalledWith(
            expect.stringContaining('First quote')
        );
        expect(interaction.reply).toHaveBeenCalledWith(
            expect.stringContaining('Second quote')
        );
    });

    it('replies with no quotes found', async () => {
        const {command, mockManager} = await setupCommandTest({
            managerClass: QuoteManager,
            managerKey: 'quoteManager',
            commandPath: '../../modules/quotes/commands/quotes.js',
        });

        mockManager.getQuotesByAuthor.mockReturnValue([]);

        const interaction = new MockInteraction({
            userOptions: {user: {id: '123456789012345678', tag: 'Author#0001'} as User},
            guildId: '135381928284343204',
        });

        await command.execute(interaction as any);

        expect(interaction.reply).toHaveBeenCalledWith(
            expect.stringContaining('No quotes found for Author#0001.')
        );
    });
});