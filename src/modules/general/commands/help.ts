import {MessageFlags, SlashCommandBuilder} from 'discord.js';

export const data = new SlashCommandBuilder()
    .setName('help')
    .setDescription('List all available commands and their descriptions.');

export const testOnly = false;

export async function execute(interaction: any) {
    const commands = Array.from(
        interaction.client.commands.entries() as IterableIterator<[string, { data: { description: string } }]>
    );
    let helpText = '**Available Commands:**\n\n';
    for (const [name, cmd] of commands.sort((a, b) => a[0].localeCompare(b[0]))) {
        helpText += `\`/${name}\` — ${cmd.data.description}\n`;
    }
    await interaction.reply({content: helpText, flags: MessageFlags.Ephemeral});
}