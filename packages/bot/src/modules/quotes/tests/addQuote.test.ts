import {jest} from '@jest/globals';
import {setupCommandTest} from '../../../test/utils/commandTestHelper.js';
import {MockInteraction} from '../../../test/MockInteraction.js';
import {QuoteManager} from '@zeffuro/fakegaming-common/dist/managers/quoteManager.js';
import {User} from 'discord.js';

describe('addQuote command', () => {
    beforeEach(() => {
        jest.resetModules();
        jest.clearAllMocks();
    });

    it('adds a quote and replies', async () => {
        const {command, mockManager} = await setupCommandTest({
            managerClass: QuoteManager,
            managerKey: 'quoteManager',
            commandPath: '../../modules/quotes/commands/addQuote.js',
        });

        const interaction = new MockInteraction({
            stringOptions: {quote: 'Test quote'},
            userOptions: {author: {id: '123456789012345678', tag: 'Author#0001'} as User},
            user: {id: '292685065920446469', tag: 'Submitter#0002'} as User,
            guildId: '135381928284343204',
        });

        await command.execute(interaction as any);

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