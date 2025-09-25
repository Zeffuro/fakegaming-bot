import {jest} from '@jest/globals';
import {setupCommandWithInteraction} from '../../../test/utils/commandTestHelper.js';
import {CommandInteraction, Message} from 'discord.js';

describe('poll command', () => {
    it('creates a poll with two options', async () => {
        const {command, interaction} = await setupCommandWithInteraction({
            managerClass: Object,
            managerKey: '',
            commandPath: '../../modules/general/commands/poll.js',
            interactionOptions: {
                stringOptions: {
                    question: 'Favorite color?',
                    option1: 'Red',
                    option2: 'Blue'
                },
                fetchReplyImpl: async () => ({react: jest.fn()}) as unknown as Partial<Message>
            }
        });
        await command.execute(interaction as unknown as CommandInteraction);
        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({content: expect.stringContaining('Favorite color?')})
        );
    });

    it('rejects poll with less than two options', async () => {
        const {command, interaction} = await setupCommandWithInteraction({
            managerClass: Object,
            managerKey: '',
            commandPath: '../../modules/general/commands/poll.js',
            interactionOptions: {
                stringOptions: {
                    question: 'Favorite color?',
                    option1: 'Red'
                }
            }
        });
        await command.execute(interaction as unknown as CommandInteraction);

        expect(interaction.reply).toHaveBeenCalledWith('Please provide at least two options for the poll.');
    });
});