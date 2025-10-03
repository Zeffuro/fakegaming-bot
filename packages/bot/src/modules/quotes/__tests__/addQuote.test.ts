import {jest} from '@jest/globals';
import {setupCommandWithInteraction} from '../../../test/utils/commandTestHelper.js';
import {QuoteManager} from '@zeffuro/fakegaming-common/managers';
import {CommandInteraction, User} from 'discord.js';

describe('addQuote command', () => {
    beforeEach(() => {
        jest.resetModules();
        jest.clearAllMocks();
    });

    it('adds a quote and replies', async () => {
        const {command, mockManager, interaction} = await setupCommandWithInteraction({
            managerClass: QuoteManager,
            managerKey: 'quoteManager',
            commandPath: '../../modules/quotes/commands/addQuote.js',
            interactionOptions: {
                stringOptions: {quote: 'Test quote'},
                userOptions: {author: {id: '123456789012345678', tag: 'Author#0001'} as User},
                user: {id: '292685065920446469', tag: 'Submitter#0002'} as User,
                guildId: '135381928284343204',
            }
        });

        await command.execute(interaction as unknown as CommandInteraction);

        expect(mockManager.add).toHaveBeenCalledWith(
            expect.objectContaining({
                quote: 'Test quote',
                authorId: '123456789012345678',
                submitterId: '292685065920446469',
                guildId: '135381928284343204',
            })
        );
        expect(interaction.reply).toHaveBeenCalledWith(
            expect.stringContaining('Quote added for Author#0001')
        );
    });
});