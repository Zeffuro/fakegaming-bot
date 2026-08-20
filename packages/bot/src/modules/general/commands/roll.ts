import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { createSlashCommand, getTestOnly } from '../../../core/commandBuilder.js';
import { resolveInteractionOutputLocale } from '../../../core/localization.js';
import { roll as META } from '../commands.manifest.js';
import { getGeneralCopy } from '../data/generalCopy.js';

const data = createSlashCommand(META, (builder: SlashCommandBuilder) =>
    builder.addStringOption(option => option
        .setName('dice')
        .setNameLocalization('nl', 'dobbelstenen')
        .setDescription('Dice notation or max number (e.g., 2d6, d20, or 100)')
        .setDescriptionLocalization('nl', 'Dobbelnotatie of maximumgetal (bijv. 2d6, d20 of 100)'))
);

function parseDice(input: string): { count: number; sides: number } | null {
    const match = input.match(/^(\d*)d(\d+)$/i);
    if (!match) return null;
    return { count: match[1] ? Number.parseInt(match[1], 10) : 1, sides: Number.parseInt(match[2] ?? '', 10) };
}

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const copy = getGeneralCopy(await resolveInteractionOutputLocale(interaction));
    const diceInput = interaction.options.getString('dice');
    if (!diceInput) {
        const roll = Math.floor(Math.random() * 6) + 1;
        await interaction.reply(copy.roll.rolled(roll, '1d6'));
        return;
    }
    const dice = parseDice(diceInput);
    if (dice) {
        if (dice.count < 1 || dice.count > 20 || dice.sides < 2 || dice.sides > 1000) {
            await interaction.reply(copy.roll.reasonable);
            return;
        }
        const rolls = Array.from({ length: dice.count }, () => Math.floor(Math.random() * dice.sides) + 1);
        const total = rolls.reduce((sum, value) => sum + value, 0);
        await interaction.reply(copy.roll.rolls(rolls.join(', '), total, `${dice.count}d${dice.sides}`));
        return;
    }
    const max = Number.parseInt(diceInput, 10);
    if (!Number.isNaN(max) && max > 1 && max <= 1_000_000) {
        await interaction.reply(copy.roll.rolled(Math.floor(Math.random() * max) + 1, `1-${max}`));
        return;
    }
    await interaction.reply(copy.roll.invalid);
}

const testOnly = getTestOnly(META);
export default { data, execute, testOnly };
