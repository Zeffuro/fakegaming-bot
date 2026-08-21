import { ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder } from 'discord.js';
import { getConfigManager } from '@zeffuro/fakegaming-common/managers';
import { createSlashCommand, getTestOnly } from '../../../core/commandBuilder.js';
import { notes as META } from '../commands.manifest.js';
import { resolveInteractionOutputLocale, type SupportedOutputLocale } from '../../../core/localization.js';
import { getNotesCopy } from '../copy/notesCopy.js';

interface NoteLike {
    id: string;
    title: string;
    body: string;
    pinned?: boolean | number | string | null;
}

const data = createSlashCommand(META, (builder: SlashCommandBuilder) =>
    builder
        .addSubcommand((subcommand) =>
            subcommand
                .setName('add')
                .setDescription('Save a personal note')
                .addStringOption((option) =>
                    option
                        .setName('body')
                        .setDescription('Note text')
                        .setRequired(true)
                        .setMaxLength(2000)
                )
                .addStringOption((option) =>
                    option
                        .setName('title')
                        .setDescription('Optional note title')
                        .setRequired(false)
                        .setMaxLength(160)
                )
                .addBooleanOption((option) =>
                    option
                        .setName('pinned')
                        .setDescription('Pin this note to the top of your list')
                        .setRequired(false)
                )
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName('list')
                .setDescription('List your personal notes')
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName('show')
                .setDescription('Show one of your notes')
                .addStringOption((option) =>
                    option
                        .setName('note')
                        .setDescription('Note number from /notes list or its short ID')
                        .setRequired(true)
                )
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName('delete')
                .setDescription('Delete one of your notes')
                .addStringOption((option) =>
                    option
                        .setName('note')
                        .setDescription('Note number from /notes list or its short ID')
                        .setRequired(true)
                )
        )
);

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const locale = await resolveInteractionOutputLocale(interaction);
    const subcommand = interaction.options.getSubcommand(true);

    if (subcommand === 'add') {
        await addNote(interaction, locale);
        return;
    }

    if (subcommand === 'list') {
        await listNotes(interaction, locale);
        return;
    }

    if (subcommand === 'show') {
        await showNote(interaction, locale);
        return;
    }

    if (subcommand === 'delete') {
        await deleteNote(interaction, locale);
        return;
    }

    await interaction.reply({ content: getNotesCopy(locale).unknown, flags: MessageFlags.Ephemeral });
}

async function addNote(interaction: ChatInputCommandInteraction, locale: SupportedOutputLocale): Promise<void> {
    const copy = getNotesCopy(locale);
    const body = interaction.options.getString('body', true).trim();
    if (!body) {
        await interaction.reply({ content: copy.bodyRequired, flags: MessageFlags.Ephemeral });
        return;
    }

    const title = interaction.options.getString('title')?.trim();
    const pinned = interaction.options.getBoolean('pinned') ?? false;
    const note = await getConfigManager().userNoteManager.createForUser({
        discordId: interaction.user.id,
        body,
        pinned,
        locale,
        ...(title ? { title } : {}),
    }) as unknown as NoteLike;

    await interaction.reply({
        content: copy.saved(shortNoteId(note.id), singleLine(note.title)),
        flags: MessageFlags.Ephemeral,
        allowedMentions: { parse: [] },
    });
}

async function listNotes(interaction: ChatInputCommandInteraction, locale: SupportedOutputLocale): Promise<void> {
    const copy = getNotesCopy(locale);
    const notes = await getUserNotes(interaction.user.id);
    if (notes.length === 0) {
        await interaction.reply({ content: copy.none, flags: MessageFlags.Ephemeral });
        return;
    }

    const lines = notes.slice(0, 10).map((note, index) => formatNoteLine(note, index, locale));
    const suffix = notes.length > 10 ? copy.more(notes.length - 10) : '';
    await interaction.reply({
        content: `${copy.title}\n${lines.join('\n')}${suffix}`,
        flags: MessageFlags.Ephemeral,
        allowedMentions: { parse: [] },
    });
}

async function showNote(interaction: ChatInputCommandInteraction, locale: SupportedOutputLocale): Promise<void> {
    const copy = getNotesCopy(locale);
    const input = interaction.options.getString('note', true);
    const note = await resolveUserNote(interaction.user.id, input);
    if (!note) {
        await interaction.reply({ content: copy.notFound, flags: MessageFlags.Ephemeral });
        return;
    }

    const pinned = isPinned(note.pinned) ? ` [${copy.pinned}]` : '';
    const body = note.body.trim() ? truncateText(note.body.trim(), 1500) : copy.noBody;
    await interaction.reply({
        content: `**${singleLine(note.title)}**${pinned}\nID: \`${shortNoteId(note.id)}\`\n\n${body}`,
        flags: MessageFlags.Ephemeral,
        allowedMentions: { parse: [] },
    });
}

async function deleteNote(interaction: ChatInputCommandInteraction, locale: SupportedOutputLocale): Promise<void> {
    const copy = getNotesCopy(locale);
    const input = interaction.options.getString('note', true);
    const note = await resolveUserNote(interaction.user.id, input);
    if (!note) {
        await interaction.reply({ content: copy.notFound, flags: MessageFlags.Ephemeral });
        return;
    }

    await getConfigManager().userNoteManager.removeForUser(note.id, interaction.user.id);
    await interaction.reply({
        content: copy.deleted(shortNoteId(note.id), singleLine(note.title)),
        flags: MessageFlags.Ephemeral,
        allowedMentions: { parse: [] },
    });
}

async function getUserNotes(discordId: string): Promise<NoteLike[]> {
    return await getConfigManager().userNoteManager.listForUser(discordId) as unknown as NoteLike[];
}

async function resolveUserNote(discordId: string, input: string): Promise<NoteLike | null> {
    const notes = await getUserNotes(discordId);
    return resolveNoteByInput(notes, input);
}

function resolveNoteByInput(notes: NoteLike[], input: string): NoteLike | null {
    const trimmed = input.trim().toLowerCase();
    if (!trimmed) return null;

    const index = Number(trimmed);
    if (Number.isInteger(index) && index >= 1 && index <= notes.length) {
        return notes[index - 1] ?? null;
    }

    return notes.find((note) => note.id.toLowerCase() === trimmed || note.id.toLowerCase().startsWith(trimmed)) ?? null;
}

function formatNoteLine(note: NoteLike, index: number, locale: SupportedOutputLocale): string {
    const pinned = isPinned(note.pinned) ? ` [${getNotesCopy(locale).pinned}]` : '';
    const preview = previewText(note.body);
    return `${index + 1}. \`${shortNoteId(note.id)}\`${pinned} ${singleLine(note.title)}${preview ? ` - ${preview}` : ''}`;
}

function shortNoteId(id: string): string {
    return id.slice(0, 8);
}

function isPinned(value: NoteLike['pinned']): boolean {
    return value === true || value === 1 || value === '1';
}

function singleLine(value: string): string {
    return value.replace(/\s+/g, ' ').trim();
}

function previewText(value: string): string {
    return truncateText(singleLine(value), 76);
}

function truncateText(value: string, maxLength: number): string {
    if (value.length <= maxLength) return value;
    return `${value.slice(0, Math.max(0, maxLength - 3))}...`;
}

const testOnly = getTestOnly(META);

// noinspection JSUnusedGlobalSymbols
export default { data, execute, testOnly };
