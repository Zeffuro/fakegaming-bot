import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { createSlashCommand, getTestOnly } from '../../../core/commandBuilder.js';
import { resolveInteractionOutputLocale } from '../../../core/localization.js';
import { spin as META } from '../commands.manifest.js';
import { getGeneralCopy } from '../data/generalCopy.js';

const emojis = ['🌀', '🎯', '🎲', '🎉', '🕹️', '🎰', '🔄', '🥳', '🪄', '✨'];

const data = createSlashCommand(META, (builder: SlashCommandBuilder) => {
    for (let index = 1; index <= 10; index += 1) {
        builder.addStringOption(option => option
            .setName(`name${index}`)
            .setNameLocalization('nl', `naam${index}`)
            .setDescription(`Name ${index}`)
            .setDescriptionLocalization('nl', `Naam ${index}`));
    }
});

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const copy = getGeneralCopy(await resolveInteractionOutputLocale(interaction));
    const names: string[] = [];
    for (let index = 1; index <= 10; index += 1) {
        const name = interaction.options.getString(`name${index}`);
        if (name) names.push(name.trim());
    }
    if (names.length < 2) {
        await interaction.reply(copy.spin.twoNames);
        return;
    }

    await interaction.reply(copy.spin.starting);
    const cycles = 10 + Math.floor(Math.random() * 5);
    let current = 0;
    for (let index = 0; index < cycles; index += 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
        current = (current + 1) % names.length;
        const emoji = emojis[Math.floor(Math.random() * emojis.length)] ?? '🔄';
        await interaction.editReply(`${emoji} ${copy.spin.spinning(names[current] ?? '')}`);
    }
    await new Promise(resolve => setTimeout(resolve, 700));
    await interaction.editReply(copy.spin.winner(names[current] ?? ''));
}

const testOnly = getTestOnly(META);
export default { data, execute, testOnly };
