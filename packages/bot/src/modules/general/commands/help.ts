import {ApplicationCommandType, CommandInteraction, MessageFlags} from 'discord.js';
import type {FakegamingBot, LoadedCommandData} from '../../../core/FakegamingBot.js';
import {createSlashCommand, getTestOnly} from '../../../core/commandBuilder.js';
import {help as META} from '../commands.manifest.js';

const data = createSlashCommand(META);
const maxHelpChunkLength = 1900;

function getCommandType(data: LoadedCommandData): number {
    const json = data.toJSON?.() ?? {};
    const type = json.type;
    return typeof type === 'number' ? type : ApplicationCommandType.ChatInput;
}

function formatHelpLabel(name: string, data: LoadedCommandData): string {
    const type = getCommandType(data);
    if (type === ApplicationCommandType.User) return `User menu: ${name}`;
    if (type === ApplicationCommandType.Message) return `Message menu: ${name}`;
    return `/${name}`;
}

function chunkHelpLines(lines: readonly string[]): string[] {
    const chunks: string[] = [];
    let current = '**Available Commands:**\n\n';

    for (const line of lines) {
        if (current.length + line.length > maxHelpChunkLength) {
            chunks.push(current.trimEnd());
            current = '**More Commands:**\n\n';
        }
        current += line;
    }

    if (current.trim().length > 0) {
        chunks.push(current.trimEnd());
    }

    return chunks;
}

async function execute(interaction: CommandInteraction): Promise<void> {
    const client = interaction.client as FakegamingBot;
    const commands = Array.from(client.commands.entries());
    const lines = commands
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([name, cmd]) => {
            const description = cmd.description ?? cmd.data.description ?? 'No description available';
            return `\`${formatHelpLabel(name, cmd.data)}\` - ${description}\n`;
        });
    const chunks = chunkHelpLines(lines);
    const [firstChunk, ...remainingChunks] = chunks;

    await interaction.reply({content: firstChunk ?? '**Available Commands:**', flags: MessageFlags.Ephemeral});
    for (const chunk of remainingChunks) {
        await interaction.followUp({content: chunk, flags: MessageFlags.Ephemeral});
    }
}

const testOnly = getTestOnly(META);

// noinspection JSUnusedGlobalSymbols
export default {data, execute, testOnly};
