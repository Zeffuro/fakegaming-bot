import { createHash } from 'node:crypto';
import { DiscordAPIError, type Attachment, type Client, type Message } from 'discord.js';
import { getLogger, SUPPORTED_OUTPUT_LOCALES } from '@zeffuro/fakegaming-common';
import {
    getConfigManager, type SubmissionCategoryData, type SubmissionContentInput, type SubmissionManager, type SubmissionRecordData,
} from '@zeffuro/fakegaming-common/managers';
import { resolveInteractionOutputLocale } from '../../../core/localization.js';
import { canSubmit, fetchSubmissionChannels, liveMember, requireReviewer, type SubmissionTextChannel } from './access.js';
import { SubmissionControlError, submissionCopy } from './copy.js';
import { downloadSubmissionImages, validateImageInputs, type SubmissionImage } from './media.js';
import { renderPublication, renderSubmission, submissionMarker } from './presentation.js';

const log = getLogger({ name: 'bot:submissions' });

export class SubmissionRuntime {
    private timer: ReturnType<typeof setInterval> | null = null;
    private sweeping = false;
    private recovered = false;
    private readonly recoveryCutoff = Date.now();
    private readonly rendered = new Map<string, number>();
    private readonly rendering = new Map<string, Promise<void>>();

    constructor(readonly client: Client, readonly manager: SubmissionManager = getConfigManager().submissionManager) {}

    async start(): Promise<void> {
        this.stop();
        this.timer = setInterval(() => void this.sweep().catch(error => log.warn({ errorType: error instanceof Error ? error.name : 'unknown' }, 'Submission recovery failed')), 60_000);
        this.timer.unref();
        await this.sweep();
    }

    stop(): void {
        if (this.timer) clearInterval(this.timer);
        this.timer = null;
    }

    async submit(category: SubmissionCategoryData, userId: string, content: SubmissionContentInput,
        uploads: Attachment[], revision?: SubmissionRecordData): Promise<SubmissionRecordData> {
        validateImageInputs(uploads);
        const channels = await fetchSubmissionChannels(this.client, category);
        if (!canSubmit(category, await liveMember(channels.guild, userId))) throw new SubmissionControlError('unavailable');
        const item = revision
            ? await this.manager.beginRevision(category.guildId, revision.id, userId, revision.version, content)
            : await this.manager.create({ ...content, guildId: category.guildId, categoryId: category.id, userId });
        try {
            const images = await downloadSubmissionImages(uploads);
            const currentCategory = await this.manager.getCategory(item.guildId, item.categoryId);
            if (!currentCategory) throw new SubmissionControlError('unavailable');
            const latest = await fetchSubmissionChannels(this.client, currentCategory, item);
            if (!canSubmit(currentCategory, await liveMember(latest.guild, userId))) throw new SubmissionControlError('unavailable');
            const locale = await resolveInteractionOutputLocale({ guildId: item.guildId });
            const rendered = renderSubmission(item, locale, true, images.map(image => image.name));
            const message = await latest.review.send({ ...rendered, content: rendered.content ?? undefined,
                files: images.map(image => image.file), nonce: nonce(`review:${item.id}:${item.version}`), enforceNonce: true });
            const attachments = images.map(image => {
                const saved = message.attachments.find(file => file.name === image.name);
                if (!saved) throw new SubmissionControlError('imagesInvalid');
                return { id: saved.id, name: image.name, contentType: image.contentType, size: image.size };
            });
            const updated = await this.manager.finalizeUpload(item.guildId, item.id, userId, item.version, {
                reviewChannelId: message.channelId, reviewMessageId: message.id, attachments,
            });
            await this.refresh(updated.guildId, updated.id).catch(error => log.warn({ errorType: error instanceof Error ? error.name : 'unknown', submissionId: item.id }, 'Review refresh deferred'));
            if (revision?.reviewMessageId) await this.clearPreviousReview(revision, locale);
            return updated;
        } catch (error) {
            await this.manager.failUpload(item.guildId, item.id, userId, item.version).catch(() => undefined);
            log.warn({ submissionId: item.id, errorType: error instanceof Error ? error.name : 'unknown' }, 'Submission upload failed');
            throw Object.assign(new Error('Submission upload failed'), { code: 'uploadFailed' });
        }
    }

    async publish(item: SubmissionRecordData, reviewerId: string): Promise<SubmissionRecordData> {
        const access = await requireReviewer(this.client, item, reviewerId);
        const images = await this.storedImages(item, access.review);
        const locale = await resolveInteractionOutputLocale({ guildId: item.guildId });
        const payload = { ...renderPublication(item, locale), files: images.map(image => image.file), nonce: nonce(item.id), enforceNonce: true };
        const latest = await requireReviewer(this.client, item, reviewerId);
        const claimed = await this.manager.claimPublish(item.guildId, item.id, item.version, reviewerId, latest.category.version);
        let updated: SubmissionRecordData;
        try {
            const message = await latest.destination.send(payload);
            updated = await this.manager.finishPublish(item.guildId, item.id, claimed.version, message.channelId, message.id);
        } catch (error) {
            const current = await this.manager.get(item.guildId, item.id);
            if (current?.status === 'published') updated = current;
            else updated = await this.manager.failPublish(item.guildId, item.id, claimed.version, !definitiveRejection(error));
        }
        await this.refresh(item.guildId, item.id).catch(error => log.warn({ errorType: error instanceof Error ? error.name : 'unknown', submissionId: item.id }, 'Review refresh deferred'));
        if (updated.status === 'published') await this.notify(updated);
        return updated;
    }

    async reconcile(item: SubmissionRecordData, reviewerId: string): Promise<SubmissionRecordData | null> {
        if (item.status !== 'uncertain') throw new SubmissionControlError('missing');
        const access = await requireReviewer(this.client, item, reviewerId);
        const expected = SUPPORTED_OUTPUT_LOCALES.map(locale => renderPublication(item, locale).embeds[0]!.toJSON());
        const messages = await access.destination.messages.fetch({ limit: 100 });
        const matches = messages.filter(message => message.author.id === this.client.user?.id
            && message.embeds[0]?.footer?.text === submissionMarker(item)
            && expected.some(embed => message.embeds[0]?.title === embed.title && message.embeds[0]?.description === embed.description
                && JSON.stringify(message.embeds[0]?.fields.map(field => field.value)) === JSON.stringify(embed.fields?.map(field => field.value)))
            && message.attachments.size === item.attachments.length
            && item.attachments.every(saved => message.attachments.some(file => file.name === saved.name && file.size === saved.size)));
        if (matches.size !== 1) return null;
        const message = matches.first()!;
        const updated = await this.manager.reconcilePublish(item.guildId, item.id, item.version, message.channelId, message.id);
        await this.refresh(item.guildId, item.id).catch(() => undefined);
        await this.notify(updated);
        return updated;
    }

    async refresh(guildId: string, id: string): Promise<void> {
        const prior = this.rendering.get(id) ?? Promise.resolve();
        const next = prior.catch(() => undefined).then(async () => {
            const item = await this.manager.get(guildId, id);
            if (!item?.reviewMessageId) return;
            const category = await this.manager.getCategory(guildId, item.categoryId);
            if (!category) return;
            const { review } = await fetchSubmissionChannels(this.client, category, item);
            const message = await this.reviewMessage(item, review);
            const locale = await resolveInteractionOutputLocale({ guildId });
            await message.edit(renderSubmission(item, locale, true));
            this.rendered.set(id, item.version);
        });
        this.rendering.set(id, next);
        try { await next; }
        finally { if (this.rendering.get(id) === next) this.rendering.delete(id); }
    }

    async notify(item: SubmissionRecordData): Promise<void> {
        try {
            const locale = await resolveInteractionOutputLocale({ guildId: item.guildId });
            const guild = await this.client.guilds.fetch(item.guildId);
            const user = await this.client.users.fetch(item.userId);
            await user.send({ content: submissionCopy(locale)('notification', { server: guild.name }), allowedMentions: { parse: [] } });
        } catch { /* Status remains available in the server when DMs are closed. */ }
    }

    private async reviewMessage(item: SubmissionRecordData, channel: SubmissionTextChannel): Promise<Message> {
        if (!item.reviewMessageId) throw new SubmissionControlError('missing');
        const message = await channel.messages.fetch({ message: item.reviewMessageId, force: true });
        if (message.author.id !== this.client.user?.id || message.embeds[0]?.footer?.text !== submissionMarker(item)) throw new SubmissionControlError('missing');
        return message;
    }

    private async storedImages(item: SubmissionRecordData, channel: SubmissionTextChannel): Promise<SubmissionImage[]> {
        if (!item.attachments.length) return [];
        const message = await this.reviewMessage(item, channel);
        const inputs = item.attachments.map(saved => {
            const attachment = message.attachments.get(saved.id);
            if (!attachment || attachment.name !== saved.name || attachment.size !== saved.size
                || attachment.contentType !== saved.contentType) throw new SubmissionControlError('imagesInvalid');
            return attachment;
        });
        return downloadSubmissionImages(inputs);
    }

    private async clearPreviousReview(item: SubmissionRecordData, locale: Parameters<typeof submissionCopy>[0]): Promise<void> {
        try {
            const channel = await this.client.channels.fetch(item.reviewChannelId);
            if (!channel || channel.type !== 0) return;
            const message = await this.reviewMessage(item, channel);
            await message.edit({ content: submissionCopy(locale)('stale'), embeds: [], components: [], attachments: [], allowedMentions: { parse: [] } });
        } catch { /* The old version's controls are also rejected by persisted version checks. */ }
    }

    private async sweep(): Promise<void> {
        if (this.sweeping) return;
        this.sweeping = true;
        try {
            if (!this.recovered) {
                await this.manager.recoverInterrupted(this.recoveryCutoff);
                this.recovered = true;
            }
            const retained = new Set<string>();
            const guilds = new Set<string>();
            for (let offset = 0;; offset += 100) {
                const items = await this.manager.listForRefresh(offset, 100);
                for (const item of items) {
                    retained.add(item.id);
                    guilds.add(item.guildId);
                    if (this.rendered.get(item.id) === item.version) continue;
                    await this.refresh(item.guildId, item.id).catch(error => log.warn({ submissionId: item.id,
                        errorType: error instanceof Error ? error.name : 'unknown' }, 'Submission review remains unavailable'));
                }
                if (items.length < 100) break;
            }
            for (const id of this.rendered.keys()) if (!retained.has(id)) this.rendered.delete(id);
            for (const guildId of guilds) await this.manager.pruneFinalized(guildId);
        } finally { this.sweeping = false; }
    }
}

export function definitiveRejection(error: unknown): boolean {
    return error instanceof DiscordAPIError && error.status >= 400 && error.status < 500 && error.status !== 408;
}

function nonce(value: string): string { return createHash('sha256').update(value).digest('hex').slice(0, 24); }
