import {jest} from '@jest/globals';
import {setupCommandWithInteraction} from '../../../test/utils/commandTestHelper.js';
import {CommandInteraction} from 'discord.js';

describe('spin command', () => {

    it('spins and picks a winner from provided names', async () => {
        jest.useRealTimers();
        const {command, interaction} = await setupCommandWithInteraction({
            managerClass: Object,
            managerKey: '',
            commandPath: '../../modules/general/commands/spin.js',
            interactionOptions: {
                stringOptions: {
                    name1: 'Alice',
                    name2: 'Bob',
                    name3: 'Charlie'
                }
            }
        });

        interaction.editReply = jest.fn(() => Promise.resolve());

        await command.execute(interaction as unknown as CommandInteraction);

        expect(interaction.reply).toHaveBeenCalledWith('Spinning the wheel...');
        expect(interaction.editReply).toHaveBeenCalledWith(expect.stringMatching(/Spinning\.\.\. \*\*.+\*\*/));
        expect(interaction.editReply).toHaveBeenCalledWith(expect.stringMatching(/The wheel stopped at: \*\*.+\*\*!/));
    }, 10000); // Increase the timeout for this test to account for the real timers

    it('rejects if less than two names are provided', async () => {
        jest.useFakeTimers();
        const {command, interaction} = await setupCommandWithInteraction({
            managerClass: Object,
            managerKey: '',
            commandPath: '../../modules/general/commands/spin.js',
            interactionOptions: {
                stringOptions: {
                    name1: 'OnlyOne'
                }
            }
        });

        await command.execute(interaction as unknown as CommandInteraction);

        expect(interaction.reply).toHaveBeenCalledWith('Please provide at least two names.');
    });
});