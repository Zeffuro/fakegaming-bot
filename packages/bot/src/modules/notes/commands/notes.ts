import { ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder } from 'discord.js';
import { getConfigManager } from '@zeffuro/fakegaming-common/managers';
import { createSlashCommand, getTestOnly } from '../../../core/commandBuilder.js';
import { notes as META } from '../commands.manifest.js';

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
    const subcommand = interaction.options.getSubcommand(true);

    if (subcommand === 'add') {
        await addNote(interaction);
        return;
    }

    if (subcommand === 'list') {
        await listNotes(interaction);
        return;
    }

    if (subcommand === 'show') {
        await showNote(interaction);
        return;
    }

    if (subcommand === 'delete') {
        await deleteNote(interaction);
        return;
    }

    await interaction.reply({ content: 'Unknown notes subcommand.', flags: MessageFlags.Ephemeral });
}

async function addNote(interaction: ChatInputCommandInteraction): Promise<void> {
    const body = interaction.options.getString('body', true).trim();
    if (!body) {
        await interaction.reply({ content: 'Add note text before saving.', flags: MessageFlags.Ephemeral });
        return;
    }

    const title = interaction.options.getString('title')?.trim();
    const pinned = interaction.options.getBoolean('pinned') ?? false;
    const note = await getConfigManager().userNoteManager.createForUser({
        discordId: interaction.user.id,
        body,
        pinned,
        ...(title ? { title } : {}),
    }) as unknown as NoteLike;

    await interaction.reply({
        content: `Saved note \`${shortNoteId(note.id)}\`: ${singleLine(note.title)}`,
        flags: MessageFlags.Ephemeral,
        allowedMentions: { parse: [] },
    });
}

async function listNotes(interaction: ChatInputCommandInteraction): Promise<void> {
    const notes = await getUserNotes(interaction.user.id);
    if (notes.length === 0) {
        await interaction.reply({ content: 'You have no saved notes.', flags: MessageFlags.Ephemeral });
        return;
    }

    const lines = notes.slice(0, 10).map(formatNoteLine);
    const suffix = notes.length > 10 ? `\n...and ${notes.length - 10} more.` : '';
    await interaction.reply({
        content: `Your notes:\n${lines.join('\n')}${suffix}`,
        flags: MessageFlags.Ephemeral,
        allowedMentions: { parse: [] },
    });
}

async function showNote(interaction: ChatInputCommandInteraction): Promise<void> {
    const input = interaction.options.getString('note', true);
    const note = await resolveUserNote(interaction.user.id, input);
    if (!note) {
        await interaction.reply({ content: 'Note not found. Use `/notes list` to see your notes.', flags: MessageFlags.Ephemeral });
        return;
    }

    const pinned = isPinned(note.pinned) ? ' [pinned]' : '';
    const body = note.body.trim() ? truncateText(note.body.trim(), 1500) : '_No body_';
    await interaction.reply({
        content: `**${singleLine(note.title)}**${pinned}\nID: \`${shortNoteId(note.id)}\`\n\n${body}`,
        flags: MessageFlags.Ephemeral,
        allowedMentions: { parse: [] },
    });
}

async function deleteNote(interaction: ChatInputCommandInteraction): Promise<void> {
    const input = interaction.options.getString('note', true);
    const note = await resolveUserNote(interaction.user.id, input);
    if (!note) {
        await interaction.reply({ content: 'Note not found. Use `/notes list` to see your notes.', flags: MessageFlags.Ephemeral });
        return;
    }

    await getConfigManager().userNoteManager.removeForUser(note.id, interaction.user.id);
    await interaction.reply({
        content: `Deleted note \`${shortNoteId(note.id)}\`: ${singleLine(note.title)}`,
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

function formatNoteLine(note: NoteLike, index: number): string {
    const pinned = isPinned(note.pinned) ? ' [pinned]' : '';
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
