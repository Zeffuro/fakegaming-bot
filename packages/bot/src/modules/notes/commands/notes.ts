import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder, type ButtonInteraction, type InteractionReplyOptions } from 'discord.js';
import { filterNoteInbox, getConfigManager, normalizeNoteSourceUrl, type UserNoteRecord } from '@zeffuro/fakegaming-common/managers';
import { createSlashCommand, getTestOnly } from '../../../core/commandBuilder.js';
import { notes as META } from '../commands.manifest.js';
import { resolveInteractionOutputLocale, type SupportedOutputLocale } from '../../../core/localization.js';
import { getNotesCopy } from '../copy/notesCopy.js';
import { handleNoteComponent, renderNoteDetails, renderNoteActions } from '../shared/noteInbox.js';

interface NoteLike {
    id: string;
    title: string;
    body: string;
    pinned?: boolean | number | string | null;
    status?: 'unread' | 'read' | 'archived';
    tags?: string[];
    sourceUrl?: string | null;
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
                .addStringOption(option => option.setName('tags').setDescription('Comma-separated tags (up to 10)').setMaxLength(330))
                .addStringOption(option => option.setName('source-url').setDescription('Optional source link (HTTP or HTTPS)').setMaxLength(2048))
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName('list')
                .setDescription('List your personal notes')
                .addStringOption(option => option.setName('query').setDescription('Search note titles and text').setMaxLength(100))
                .addStringOption(option => option.setName('tag').setDescription('Filter by one tag').setMaxLength(32))
                .addStringOption(option => option.setName('status').setDescription('Filter by inbox state').addChoices(
                    { name: 'Active', value: 'active' }, { name: 'Unread', value: 'unread' }, { name: 'Read', value: 'read' },
                    { name: 'Archived', value: 'archived' }, { name: 'All', value: 'all' },
                ))
                .addIntegerOption(option => option.setName('page').setDescription('Page number').setMinValue(1))
        )
        .addSubcommand(subcommand => subcommand.setName('edit').setDescription('Update tags or inbox state')
            .addStringOption(option => option.setName('note').setDescription('Note short ID or number from your full list').setRequired(true))
            .addStringOption(option => option.setName('tags').setDescription('Comma-separated tags (up to 10); empty clears tags').setMaxLength(330))
            .addStringOption(option => option.setName('status').setDescription('Set inbox state').addChoices(
                { name: 'Unread', value: 'unread' }, { name: 'Read', value: 'read' }, { name: 'Archived', value: 'archived' },
            )))
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
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
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
    if (subcommand === 'edit') {
        const note = await resolveUserNote(interaction.user.id, interaction.options.getString('note', true));
        const copy = getNotesCopy(locale);
        if (!note) {
            await respond(interaction, { content: copy.notFound, flags: MessageFlags.Ephemeral });
            return;
        }
        const tags = interaction.options.getString('tags');
        const status = interaction.options.getString('status') as NoteLike['status'];
        if (tags === null && !status) {
            await respond(interaction, { content: copy.inbox.chooseEdit, flags: MessageFlags.Ephemeral });
            return;
        }
        const parsedTags = tags === null ? undefined : parseTags(tags);
        if (parsedTags === null) {
            await respond(interaction, { content: copy.inbox.invalidTags, flags: MessageFlags.Ephemeral });
            return;
        }
        const updated = await getConfigManager().userNoteManager.updateForUser(note.id, interaction.user.id, {
            ...(parsedTags ? { tags: parsedTags } : {}), ...(status ? { status } : {}),
        });
        await respond(interaction, { ...(updated ? renderNoteDetails(updated, locale) : { content: copy.notFound }), flags: MessageFlags.Ephemeral });
        return;
    }

    await respond(interaction, { content: getNotesCopy(locale).unknown, flags: MessageFlags.Ephemeral });
}

async function addNote(interaction: ChatInputCommandInteraction, locale: SupportedOutputLocale): Promise<void> {
    const copy = getNotesCopy(locale);
    const body = interaction.options.getString('body', true).trim();
    if (!body) {
        await respond(interaction, { content: copy.bodyRequired, flags: MessageFlags.Ephemeral });
        return;
    }

    const title = interaction.options.getString('title')?.trim();
    const pinned = interaction.options.getBoolean('pinned') ?? false;
    const tags = parseTags(interaction.options.getString('tags') ?? '');
    const sourceInput = interaction.options.getString('source-url');
    let sourceUrl: string | null = null;
    try { sourceUrl = normalizeNoteSourceUrl(sourceInput); } catch {
        await respond(interaction, { content: copy.inbox.invalidSource });
        return;
    }
    if (!tags) {
        await respond(interaction, { content: copy.inbox.invalidTags, flags: MessageFlags.Ephemeral });
        return;
    }
    const note = await getConfigManager().userNoteManager.createForUser({
        discordId: interaction.user.id,
        body,
        pinned,
        locale,
        ...(title ? { title } : {}),
        ...(tags.length ? { tags } : {}),
        ...(sourceUrl ? { sourceUrl } : {}),
    }) as unknown as NoteLike;

    await respond(interaction, {
        content: copy.saved(shortNoteId(note.id), singleLine(note.title)),
        flags: MessageFlags.Ephemeral,
        allowedMentions: { parse: [] },
        components: renderNoteActions(note, locale),
    });
}

async function listNotes(interaction: ChatInputCommandInteraction, locale: SupportedOutputLocale): Promise<void> {
    const copy = getNotesCopy(locale);
    const notes = await getUserNotes(interaction.user.id);
    if (notes.length === 0) {
        await respond(interaction, { content: copy.none, flags: MessageFlags.Ephemeral });
        return;
    }

    const status = interaction.options.getString('status') ?? 'active';
    const inbox = filterNoteInbox(notes as unknown as UserNoteRecord[], {
        query: interaction.options.getString('query') ?? '', tag: interaction.options.getString('tag') ?? '',
        status: status as 'active', page: interaction.options.getInteger('page') ?? 1, pageSize: 5,
    });
    const lines = (inbox.notes as unknown as NoteLike[]).map(note => {
        const index = notes.findIndex(item => item.id === note.id);
        const state = copy.inbox[note.status ?? 'unread'];
        const tags = note.tags?.length ? ` #${note.tags.join(' #').slice(0, 64)}` : '';
        return `${formatNoteLine(note, index, locale)} [${state}]${tags}`;
    });
    const open = new ActionRowBuilder<ButtonBuilder>().addComponents(inbox.notes.map((note, index) => new ButtonBuilder()
        .setCustomId(`notes:open:${note.id}`).setLabel(`${copy.inbox.open} ${index + 1}`).setStyle(ButtonStyle.Secondary)));
    await respond(interaction, {
        content: `${copy.title}\n${lines.join('\n') || copy.none}\n${copy.inbox.page(inbox.page, inbox.pages, inbox.total)}`,
        components: inbox.notes.length ? [open] : [],
        flags: MessageFlags.Ephemeral,
        allowedMentions: { parse: [] },
    });
}

async function showNote(interaction: ChatInputCommandInteraction, locale: SupportedOutputLocale): Promise<void> {
    const copy = getNotesCopy(locale);
    const input = interaction.options.getString('note', true);
    const note = await resolveUserNote(interaction.user.id, input);
    if (!note) {
        await respond(interaction, { content: copy.notFound, flags: MessageFlags.Ephemeral });
        return;
    }

    if (note.status === 'unread') await getConfigManager().userNoteManager.updateForUser(note.id, interaction.user.id, { status: 'read' });
    await respond(interaction, { ...renderNoteDetails({ ...note, status: note.status === 'unread' ? 'read' : note.status }, locale), flags: MessageFlags.Ephemeral });
}

async function deleteNote(interaction: ChatInputCommandInteraction, locale: SupportedOutputLocale): Promise<void> {
    const copy = getNotesCopy(locale);
    const input = interaction.options.getString('note', true);
    const note = await resolveUserNote(interaction.user.id, input);
    if (!note) {
        await respond(interaction, { content: copy.notFound, flags: MessageFlags.Ephemeral });
        return;
    }

    await getConfigManager().userNoteManager.removeForUser(note.id, interaction.user.id);
    await respond(interaction, {
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

function parseTags(value: string): string[] | null {
    const tags = value.split(',').map(tag => tag.trim()).filter(Boolean);
    return tags.length <= 10 && tags.every(tag => tag.length <= 32) ? tags : null;
}

async function respond(interaction: ChatInputCommandInteraction, payload: InteractionReplyOptions): Promise<void> {
    const { flags: _flags, ...edit } = payload;
    await interaction.editReply(edit);
}

const testOnly = getTestOnly(META);

// noinspection JSUnusedGlobalSymbols
export default { data, execute, handleComponent: (interaction: ButtonInteraction) => handleNoteComponent(interaction), testOnly };
