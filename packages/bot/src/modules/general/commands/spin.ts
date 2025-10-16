import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { createSlashCommand, getTestOnly } from '../../../core/commandBuilder.js';
import { spin as META } from '../commands.manifest.js';

const emojis = ['🌀', '🎯', '🎲', '🎉', '🕹️', '🎰', '🔄', '🥳', '🪄', '✨'];

const data = createSlashCommand(META, (b: SlashCommandBuilder) => {
    for (let i = 1; i <= 10; i++) {
        b.addStringOption(option =>
            option
                .setName(`name${i}`)
                .setDescription(`Name ${i}`)
                .setRequired(false)
        );
    }
});

async function execute(interaction: ChatInputCommandInteraction) {
    const names: string[] = [];
    for (let i = 1; i <= 10; i++) {
        const name = interaction.options.getString(`name${i}`);
        if (name) names.push(name.trim());
    }
    if (names.length < 2) {
        await interaction.reply('Please provide at least two names.');
        return;
    }

    await interaction.reply('Spinning the wheel...');

    const cycles = 10 + Math.floor(Math.random() * 5);
    let current = 0;

    for (let i = 0; i < cycles; i++) {
        await new Promise(res => setTimeout(res, 500));
        current = (current + 1) % names.length;
        const emoji = emojis[Math.floor(Math.random() * emojis.length)];
        await interaction.editReply(`${emoji} Spinning... **${names[current]}**`);
    }

    const winner = names[current];
    await new Promise(res => setTimeout(res, 700));
    await interaction.editReply(`🎉 The wheel stopped at: **${winner}**!`);
}

const testOnly = getTestOnly(META);

// noinspection JSUnusedGlobalSymbols
export default { data, execute, testOnly };
