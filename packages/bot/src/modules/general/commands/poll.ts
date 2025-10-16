import {SlashCommandBuilder, ChatInputCommandInteraction, Message} from 'discord.js';
import { createSlashCommand, getTestOnly } from '../../../core/commandBuilder.js';
import { poll as META } from '../commands.manifest.js';

const MAX_OPTIONS = 5;
const EMOJIS = ['1\ufe0f\u20e3', '2\ufe0f\u20e3', '3\ufe0f\u20e3', '4\ufe0f\u20e3', '5\ufe0f\u20e3'];

const data = createSlashCommand(META, (b: SlashCommandBuilder) =>
    b
        .addStringOption(option => option.setName('question').setDescription('The poll question').setRequired(true))
        .addStringOption(option => option.setName('option1').setDescription('Option 1').setRequired(true))
        .addStringOption(option => option.setName('option2').setDescription('Option 2').setRequired(true))
        .addStringOption(option => option.setName('option3').setDescription('Option 3').setRequired(false))
        .addStringOption(option => option.setName('option4').setDescription('Option 4').setRequired(false))
        .addStringOption(option => option.setName('option5').setDescription('Option 5').setRequired(false))
);

async function execute(interaction: ChatInputCommandInteraction) {
    const question = interaction.options.getString('question', true);
    const options = [];
    for (let i = 1; i <= MAX_OPTIONS; i++) {
        const opt = interaction.options.getString(`option${i}`);
        if (opt) options.push(opt);
    }
    if (options.length < 2) {
        await interaction.reply('Please provide at least two options for the poll.');
        return;
    }
    let pollText = `📊 ${question}\n`;
    for (let i = 0; i < options.length; i++) {
        pollText += `${EMOJIS[i]} ${options[i]}\n`;
    }
    await interaction.reply({content: pollText});
    const pollMsg = await interaction.fetchReply();

    for (let i = 0; i < options.length; i++) {
        try {
            await (pollMsg as Message).react(EMOJIS[i]);
        } catch {
        }
    }
}

const testOnly = getTestOnly(META);

// noinspection JSUnusedGlobalSymbols
export default {data, execute, testOnly};