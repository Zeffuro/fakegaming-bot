import {SlashCommandBuilder, ChatInputCommandInteraction} from 'discord.js';

const data = new SlashCommandBuilder()
    .setName('roll')
    .setDescription('Roll dice or generate a random number')
    .addStringOption(option =>
        option.setName('dice')
            .setDescription('Dice notation (e.g., 1d20) or a max number (e.g., 100)')
            .setRequired(false)
    );

function parseDice(input: string): { count: number, sides: number } | null {
    const match = input.match(/^(\d*)d(\d+)$/i);
    if (match) {
        return {
            count: match[1] ? parseInt(match[1], 10) : 1,
            sides: parseInt(match[2], 10)
        };
    }
    return null;
}

async function execute(interaction: ChatInputCommandInteraction) {
    const diceInput = interaction.options.getString('dice');
    if (!diceInput) {
        // Default: roll 1d6
        const roll = Math.floor(Math.random() * 6) + 1;
        await interaction.reply(`🎲 You rolled a **${roll}** (1d6)`);
        return;
    }
    const dice = parseDice(diceInput);
    if (dice) {
        if (dice.count < 1 || dice.count > 20 || dice.sides < 2 || dice.sides > 1000) {
            await interaction.reply('Please use a reasonable dice notation (e.g., 1d20, max 20 dice, 1000 sides).');
            return;
        }
        const rolls = Array.from({length: dice.count}, () => Math.floor(Math.random() * dice.sides) + 1);
        const total = rolls.reduce((a, b) => a + b, 0);
        await interaction.reply(`🎲 You rolled: ${rolls.join(', ')} (Total: **${total}**) [${dice.count}d${dice.sides}]`);
        return;
    }
    // Try as a max number
    const max = parseInt(diceInput, 10);
    if (!isNaN(max) && max > 1 && max <= 1000000) {
        const roll = Math.floor(Math.random() * max) + 1;
        await interaction.reply(`🎲 You rolled a **${roll}** (1-${max})`);
        return;
    }
    await interaction.reply('Invalid input. Use dice notation (e.g., 2d6) or a max number (e.g., 100).');
}

const testOnly = false;

// noinspection JSUnusedGlobalSymbols
export default {data, execute, testOnly};