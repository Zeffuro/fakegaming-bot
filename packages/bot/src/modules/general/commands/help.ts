import {ApplicationCommandType, CommandInteraction, MessageFlags} from 'discord.js';
import type {FakegamingBot, LoadedCommandData} from '../../../core/FakegamingBot.js';
import {createSlashCommand, getTestOnly} from '../../../core/commandBuilder.js';
import {resolveInteractionOutputLocale, type SupportedOutputLocale} from '../../../core/localization.js';
import {getGeneralCopy} from '../data/generalCopy.js';
import {help as META} from '../commands.manifest.js';

const data = createSlashCommand(META);
const maxHelpChunkLength = 1900;

function getCommandType(data: LoadedCommandData): number {
    const json = data.toJSON?.() ?? {};
    const type = json.type;
    return typeof type === 'number' ? type : ApplicationCommandType.ChatInput;
}

function formatHelpLabel(name: string, data: LoadedCommandData, locale: SupportedOutputLocale): string {
    const copy = getGeneralCopy(locale).help;
    const type = getCommandType(data);
    if (type === ApplicationCommandType.User) return `${copy.userMenu}: ${localizedCommandName(data, name, locale)}`;
    if (type === ApplicationCommandType.Message) return `${copy.messageMenu}: ${localizedCommandName(data, name, locale)}`;
    return `/${localizedCommandName(data, name, locale)}`;
}

function localizedCommandName(data: LoadedCommandData, fallback: string, locale: SupportedOutputLocale): string {
    const json = data.toJSON?.() as { name_localizations?: Record<string, string> } | undefined;
    return json?.name_localizations?.[locale] ?? fallback;
}

function chunkHelpLines(lines: readonly string[], locale: SupportedOutputLocale): string[] {
    const copy = getGeneralCopy(locale).help;
    const chunks: string[] = [];
    let current = `**${copy.available}:**\n\n`;

    for (const line of lines) {
        if (current.length + line.length > maxHelpChunkLength) {
            chunks.push(current.trimEnd());
            current = `**${copy.more}:**\n\n`;
        }
        current += line;
    }

    if (current.trim().length > 0) {
        chunks.push(current.trimEnd());
    }

    return chunks;
}

async function execute(interaction: CommandInteraction): Promise<void> {
    const locale = await resolveInteractionOutputLocale(interaction);
    const copy = getGeneralCopy(locale).help;
    const client = interaction.client as FakegamingBot;
    const commands = Array.from(client.commands.entries());
    const lines = commands
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([name, cmd]) => {
            const json = cmd.data.toJSON?.() as { description_localizations?: Record<string, string> } | undefined;
            const description = json?.description_localizations?.[locale];
            return `\`${formatHelpLabel(name, cmd.data, locale)}\` - ${description ?? cmd.description ?? cmd.data.description ?? copy.noDescription}\n`;
        });
    const chunks = chunkHelpLines(lines, locale);
    const [firstChunk, ...remainingChunks] = chunks;

    await interaction.reply({content: firstChunk ?? `**${copy.available}:**`, flags: MessageFlags.Ephemeral});
    for (const chunk of remainingChunks) {
        await interaction.followUp({content: chunk, flags: MessageFlags.Ephemeral});
    }
}

const testOnly = getTestOnly(META);

// noinspection JSUnusedGlobalSymbols
export default {data, execute, testOnly};
