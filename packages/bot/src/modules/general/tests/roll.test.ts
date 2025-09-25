import {setupCommandWithInteraction} from '../../../test/utils/commandTestHelper.js';
import {CommandInteraction} from 'discord.js';

describe('roll command', () => {
    it('rolls default 1d6', async () => {
        const {command, interaction} = await setupCommandWithInteraction({
            managerClass: Object,
            managerKey: '',
            commandPath: '../../modules/general/commands/roll.js',
            interactionOptions: {}
        });
        await command.execute(interaction as unknown as CommandInteraction);
        expect(interaction.reply).toHaveBeenCalledWith(expect.stringContaining('You rolled a'));
    });

    it('rolls custom dice notation', async () => {
        const {command, interaction} = await setupCommandWithInteraction({
            managerClass: Object,
            managerKey: '',
            commandPath: '../../modules/general/commands/roll.js',
            interactionOptions: {stringOptions: {dice: '2d6'}}
        });
        await command.execute(interaction as unknown as CommandInteraction);
        expect(interaction.reply).toHaveBeenCalledWith(expect.stringContaining('You rolled:'));
    });

    it('handles invalid input', async () => {
        const {command, interaction} = await setupCommandWithInteraction({
            managerClass: Object,
            managerKey: '',
            commandPath: '../../modules/general/commands/roll.js',
            interactionOptions: {stringOptions: {dice: 'badinput'}}
        });
        await command.execute(interaction as unknown as CommandInteraction);

        expect(interaction.reply).toHaveBeenCalledWith(expect.stringContaining('Invalid input'));
    });
});