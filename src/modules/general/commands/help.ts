import {MessageFlags, SlashCommandBuilder} from 'discord.js';

export const data = new SlashCommandBuilder()
    .setName('help')
    .setDescription('List all available commands and their descriptions.');

export const testOnly = false;

export async function execute(interaction: any) {
    const commands = interaction.client.commands;
    let helpText = '**Available Commands:**\n\n';
    for (const [name, cmd] of commands) {
        helpText += `\`/${name}\` — ${cmd.data.description}\n`;
    }
    await interaction.reply({content: helpText, flags: MessageFlags.Ephemeral});
}