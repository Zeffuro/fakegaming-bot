import {CommandInteraction, MessageFlags} from 'discord.js';
import type {FakegamingBot} from '../../../index.js';
import { createSlashCommand, getTestOnly } from '../../../core/commandBuilder.js';
import { help as META } from '../commands.manifest.js';

const data = createSlashCommand(META);

/**
 * Executes the help command, listing all available commands and their descriptions.
 * Replies with a formatted help message.
 */
async function execute(interaction: CommandInteraction) {
    const client = interaction.client as FakegamingBot;
    const commands = Array.from(
        client.commands.entries() as IterableIterator<[string, { data: { description: string } }]>
    );
    let helpText = '**Available Commands:**\n\n';
    for (const [name, cmd] of commands.sort((a, b) => a[0].localeCompare(b[0]))) {
        helpText += `\`/${name}\` — ${cmd.data.description}\n`;
    }
    await interaction.reply({content: helpText, flags: MessageFlags.Ephemeral});
}

const testOnly = getTestOnly(META);

// noinspection JSUnusedGlobalSymbols
export default {data, execute, testOnly};