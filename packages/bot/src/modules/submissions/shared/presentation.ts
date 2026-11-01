import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, escapeMarkdown } from 'discord.js';
import type { SubmissionRecordData } from '@zeffuro/fakegaming-common/managers';
import type { SupportedOutputLocale } from '../../../core/localization.js';
import { submissionCopy } from './copy.js';

export const submissionMarker = (item: SubmissionRecordData) => `Submission ${item.id}`;

function action(label: string, customId: string, style = ButtonStyle.Secondary) {
    return new ButtonBuilder().setCustomId(`submissions:${customId}`).setLabel(label).setStyle(style);
}

export function renderSubmissionPanel(locale: SupportedOutputLocale) {
    const t = submissionCopy(locale);
    return {
        embeds: [new EmbedBuilder().setTitle(t('panelTitle')).setDescription(t('panelBody')).setColor(0x5865f2)],
        components: [new ActionRowBuilder<ButtonBuilder>().addComponents(
            action(t('submit'), 'submit', ButtonStyle.Primary), action(t('mine'), 'mine:0'),
        )],
        allowedMentions: { parse: [] as never[] },
    };
}

export function renderSubmission(item: SubmissionRecordData, locale: SupportedOutputLocale, review: boolean) {
    const t = submissionCopy(locale);
    const embed = new EmbedBuilder().setTitle(item.categoryName).setDescription(escapeMarkdown(item.explanation))
        .setColor(item.status === 'published' ? 0x57f287 : item.status === 'rejected' ? 0xed4245 : 0x5865f2)
        .setFooter({ text: submissionMarker(item) }).setTimestamp(item.createdAt)
        .addFields({ name: t('statusLabel'), value: t(`status.${item.status}`) },
            { name: t('credits'), value: item.credit ? escapeMarkdown(item.credit) : t('anonymous') });
    if (item.link) embed.addFields({ name: t('link'), value: item.link });
    if (review) {
        embed.addFields({ name: t('submittedBy'), value: `<@${item.userId}>` },
            { name: t('destination'), value: `<#${item.destinationChannelId}>` });
        if (item.reviewerId) embed.addFields({ name: t('reviewer'), value: `<@${item.reviewerId}>` });
    }
    if (item.reason) embed.addFields({ name: t('reasonLabel'), value: escapeMarkdown(item.reason).slice(0, 1024) });
    // Embedded uploads disappear from Discord's attachment list; keep screenshots as native attachments.
    const embeds = [embed];
    const buttons: ButtonBuilder[] = [];
    if (review) {
        if (item.status === 'pending' || item.status === 'publish_failed') buttons.push(
            action(t('approve'), `approve:${item.id}:${item.version}`, ButtonStyle.Success),
            action(t('changes'), `changes:${item.id}:${item.version}`),
            action(t('reject'), `reject:${item.id}:${item.version}`, ButtonStyle.Danger),
        );
        if (item.status === 'uncertain') buttons.push(action(t('reconcile'), `reconcile:${item.id}:${item.version}`));
        buttons.push(action(t('refresh'), `review:${item.id}`));
    } else {
        if (item.status === 'changes_requested' || item.status === 'upload_failed') buttons.push(
            action(t('revise'), `edit:${item.id}:${item.version}`, ButtonStyle.Primary),
        );
        buttons.push(action(t('refresh'), `show:${item.id}`), action(t('mine'), 'mine:0'));
    }
    if (item.publishedChannelId && item.publishedMessageId) buttons.push(new ButtonBuilder()
        .setStyle(ButtonStyle.Link).setLabel(t('publication'))
        .setURL(`https://discord.com/channels/${item.guildId}/${item.publishedChannelId}/${item.publishedMessageId}`));
    const hint = item.status === 'changes_requested' || item.status === 'upload_failed' ? t('reviseHint')
        : item.status === 'uncertain' ? t('uncertain') : item.status === 'publish_failed' ? t('publishFailed') : undefined;
    return { content: hint ?? null, embeds, components: [new ActionRowBuilder<ButtonBuilder>().addComponents(buttons)], allowedMentions: { parse: [] as never[] } };
}

export function renderPublication(item: SubmissionRecordData, locale: SupportedOutputLocale) {
    const t = submissionCopy(locale);
    const embed = new EmbedBuilder().setTitle(item.categoryName).setDescription(escapeMarkdown(item.explanation))
        .setColor(0x57f287).setFooter({ text: submissionMarker(item) })
        .addFields({ name: t('credits'), value: item.credit ? escapeMarkdown(item.credit) : t('anonymous') });
    if (item.link) embed.addFields({ name: t('link'), value: item.link });
    return { embeds: [embed],
        allowedMentions: { parse: [] as never[] } };
}

export function renderOwnList(items: SubmissionRecordData[], page: number, locale: SupportedOutputLocale) {
    const t = submissionCopy(locale);
    const embed = new EmbedBuilder().setTitle(t('listTitle', { page: page + 1 })).setColor(0x5865f2)
        .setDescription(items.length ? items.map((item, index) => `${index + 1}. **${escapeMarkdown(item.categoryName)}** — ${t(`status.${item.status}`)}`).join('\n') : t('empty'));
    const components: ActionRowBuilder<ButtonBuilder>[] = [];
    if (items.length) components.push(new ActionRowBuilder<ButtonBuilder>().addComponents(items.map((item, index) =>
        action(t('open', { number: index + 1 }), `show:${item.id}`))));
    const paging = [action(t('previous'), `mine:${Math.max(0, page - 1)}`).setDisabled(page === 0),
        action(t('next'), `mine:${page + 1}`).setDisabled(items.length < 5)];
    components.push(new ActionRowBuilder<ButtonBuilder>().addComponents(paging));
    return { content: null, embeds: [embed], components, allowedMentions: { parse: [] as never[] } };
}
