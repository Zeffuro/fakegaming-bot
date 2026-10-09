import { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, type ButtonInteraction } from 'discord.js';
import { getConfigManager, normalizeNoteSourceUrl } from '@zeffuro/fakegaming-common/managers';
import { resolveInteractionOutputLocale, type SupportedOutputLocale } from '../../../core/localization.js';
import { getNotesCopy } from '../copy/notesCopy.js';

export interface InboxNote {
    id: string;
    title: string;
    body: string;
    pinned?: boolean | number | string | null;
    status?: 'unread' | 'read' | 'archived';
    tags?: string[];
    sourceUrl?: string | null;
}

export function renderNoteActions(note: InboxNote, locale: SupportedOutputLocale) {
    const copy = getNotesCopy(locale).inbox;
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(`notes:open:${note.id}`).setLabel(copy.open).setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`notes:remind:${note.id}`).setLabel(copy.remind).setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`notes:${note.status === 'archived' ? 'restore' : 'archive'}:${note.id}`)
            .setLabel(note.status === 'archived' ? copy.restore : copy.archive).setStyle(ButtonStyle.Secondary),
    );
    try {
        const url = normalizeNoteSourceUrl(note.sourceUrl);
        if (url) row.addComponents(new ButtonBuilder().setLabel(getNotesCopy(locale).source).setURL(url).setStyle(ButtonStyle.Link));
    } catch {
        // Legacy malformed URLs remain plain note text rather than actionable links.
    }
    return [row];
}

export function renderNoteDetails(note: InboxNote, locale: SupportedOutputLocale) {
    const copy = getNotesCopy(locale);
    const title = note.title.replace(/\s+/g, ' ').slice(0, 160);
    const pinned = note.pinned === true || note.pinned === 1 || note.pinned === '1' ? ` [${copy.pinned}]` : '';
    const tags = note.tags?.length ? `\n#${note.tags.join(' #')}` : '';
    const body = note.body.trim() ? note.body.trim().slice(0, 1100) : copy.noBody;
    return {
        content: `**${title}**${pinned}\nID: \`${note.id.slice(0, 8)}\` [${copy.inbox[note.status ?? 'unread']}]${tags}\n\n${body}`,
        components: renderNoteActions(note, locale), allowedMentions: { parse: [] as const },
    };
}

export async function handleNoteComponent(interaction: ButtonInteraction): Promise<boolean> {
    const [prefix, action, id, extra] = interaction.customId.split(':');
    if (prefix !== 'notes') return false;
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const locale = await resolveInteractionOutputLocale(interaction);
    const copy = getNotesCopy(locale);
    const manager = getConfigManager();
    const note = id && !extra && ['open', 'remind', 'archive', 'restore'].includes(action ?? '')
        ? await manager.userNoteManager.getForUser(id, interaction.user.id) : null;
    if (!note) {
        await interaction.editReply({ content: copy.notFound, allowedMentions: { parse: [] } });
        return true;
    }
    if (action === 'remind') {
        const source = note.sourceUrl && note.sourceUrl.length <= 1400 ? `\n${note.sourceUrl}` : '';
        const message = `${note.title}\n${note.body.slice(0, Math.max(0, 1750 - note.title.length - source.length))}${source}`;
        const draft = await manager.reminderInteractionManager.createDraft(interaction.user.id, message);
        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId(`reminder:draft:${draft.id}:600`).setLabel(copy.inbox.tenMinutes).setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`reminder:draft:${draft.id}:3600`).setLabel(copy.inbox.oneHour).setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`reminder:draft:${draft.id}:tomorrow`).setLabel(copy.inbox.tomorrow).setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`reminder:custom-draft:${draft.id}`).setLabel(copy.inbox.custom).setStyle(ButtonStyle.Secondary),
        );
        await interaction.editReply({ content: copy.inbox.chooseTime, components: [row], allowedMentions: { parse: [] } });
        return true;
    }
    const status = action === 'archive' ? 'archived' : action === 'restore' || note.status !== 'archived' ? 'read' : 'archived';
    const updated = await manager.userNoteManager.updateForUser(note.id, interaction.user.id, { status });
    await interaction.editReply(updated ? renderNoteDetails(updated, locale) : { content: copy.notFound });
    return true;
}
