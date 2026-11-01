import { randomUUID } from 'node:crypto';
import { Op, type Transaction } from 'sequelize';
import { SubmissionCategory, SubmissionLock, SubmissionPanel, SubmissionRecord } from '../models/submission.js';
import {
    submissionCategoryInputSchema,
    type SubmissionAttachment, type SubmissionCategoryData, type SubmissionCategoryInput,
    type SubmissionContentInput, type SubmissionRecordData, type SubmissionStatus,
} from '../api/submissionSchemas.js';
import { serializedTransaction } from './serializedTransaction.js';

export type { SubmissionAttachment, SubmissionCategoryData, SubmissionCategoryInput, SubmissionContentInput,
    SubmissionRecordData, SubmissionStatus } from '../api/submissionSchemas.js';

export type SubmissionErrorCode = 'invalid-content' | 'invalid-category' | 'category-limit' | 'not-found' | 'stale'
    | 'forbidden' | 'cooldown' | 'active-limit' | 'invalid-state' | 'invalid-attachments';
export class SubmissionError extends Error {
    constructor(public readonly code: SubmissionErrorCode) {
        super(code);
        this.name = 'SubmissionError';
    }
}

const activeStates: SubmissionStatus[] = ['uploading', 'upload_failed', 'pending', 'changes_requested', 'publishing', 'publish_failed', 'uncertain'];
export const SUBMISSION_COOLDOWN_MS = 60_000;
export const SUBMISSION_ACTIVE_LIMIT = 5;
export const SUBMISSION_CATEGORY_LIMIT = 25;

export class SubmissionManager {
    private readonly now: () => number;
    private readonly createId: () => string;

    constructor(options: { now?: () => number; createId?: () => string } = {}) {
        this.now = options.now ?? Date.now;
        this.createId = options.createId ?? randomUUID;
    }

    async listCategories(guildId: string, enabledOnly = false): Promise<SubmissionCategoryData[]> {
        const rows = await SubmissionCategory.findAll({
            where: { guildId, ...(enabledOnly ? { enabled: true } : {}) }, order: [['name', 'ASC'], ['id', 'ASC']],
        });
        return rows.map(categoryData);
    }

    async getCategory(guildId: string, id: string): Promise<SubmissionCategoryData | null> {
        const row = await SubmissionCategory.findOne({ where: { guildId, id } });
        return row ? categoryData(row) : null;
    }

    async saveCategory(guildId: string, input: SubmissionCategoryInput, id?: string, expectedVersion?: number): Promise<SubmissionCategoryData> {
        const parsed = submissionCategoryInputSchema.safeParse(input);
        if (!parsed.success) throw new SubmissionError('invalid-category');
        const { reviewerRoleIds, submitterRoleIds, ...fields } = parsed.data;
        if (reviewerRoleIds.includes(guildId)) throw new SubmissionError('invalid-category');
        const values = { ...fields, reviewerRoleIdsJson: JSON.stringify([...new Set(reviewerRoleIds)]),
            submitterRoleIdsJson: JSON.stringify([...new Set(submitterRoleIds)]) };
        return serializedTransaction(SubmissionCategory.sequelize!, async transaction => {
            await this.lock(`guild:${guildId}`, transaction);
            if (id) {
                const [count] = await SubmissionCategory.update({ ...values, version: (expectedVersion ?? -1) + 1 }, {
                    where: { id, guildId, version: expectedVersion ?? -1 }, transaction,
                });
                if (count !== 1) throw new SubmissionError('stale');
            } else {
                if (await SubmissionCategory.count({ where: { guildId }, transaction }) >= SUBMISSION_CATEGORY_LIMIT) {
                    throw new SubmissionError('category-limit');
                }
                id = this.createId();
                await SubmissionCategory.create({ ...values, id, guildId, version: 0 }, { transaction });
            }
            return categoryData((await SubmissionCategory.findOne({ where: { id, guildId }, transaction }))!);
        });
    }

    async getPanel(guildId: string): Promise<{ guildId: string; channelId: string; messageId: string } | null> {
        const row = await SubmissionPanel.findByPk(guildId);
        return row ? { guildId, channelId: row.channelId, messageId: row.messageId } : null;
    }

    async setPanel(guildId: string, panel: { channelId: string; messageId: string }): Promise<void> {
        await serializedTransaction(SubmissionPanel.sequelize!, async transaction => {
            await SubmissionPanel.upsert({ guildId, ...panel }, { transaction });
        });
    }

    async create(input: SubmissionContentInput & { guildId: string; categoryId: string; userId: string }): Promise<SubmissionRecordData> {
        const content = normalizeContent(input);
        return serializedTransaction(SubmissionRecord.sequelize!, async transaction => {
            const guard = await this.lock(`owner:${input.guildId}:${input.userId}`, transaction);
            const category = await this.requireEnabledCategory(input.guildId, input.categoryId, transaction);
            const now = this.now();
            if (guard.lastSubmittedAt !== null && now - Number(guard.lastSubmittedAt) < SUBMISSION_COOLDOWN_MS) {
                throw new SubmissionError('cooldown');
            }
            await this.requireCapacity(input.guildId, input.userId, transaction);
            await guard.update({ lastSubmittedAt: now }, { transaction });
            const row = await SubmissionRecord.create({ ...content, id: this.createId(), guildId: input.guildId,
                categoryId: category.id, categoryName: category.name, destinationChannelId: category.destinationChannelId,
                userId: input.userId, status: 'uploading', version: 0, reviewChannelId: category.reviewChannelId,
                reviewMessageId: null, attachmentsJson: '[]', reviewerId: null, reason: null,
                publishedChannelId: null, publishedMessageId: null, createdAt: now, updatedAt: now,
            }, { transaction });
            return recordData(row);
        });
    }

    async get(guildId: string, id: string): Promise<SubmissionRecordData | null> {
        const row = await SubmissionRecord.findOne({ where: { guildId, id } });
        return row ? recordData(row) : null;
    }

    async listOwn(guildId: string, userId: string, page = 0): Promise<SubmissionRecordData[]> {
        if (!Number.isInteger(page) || page < 0 || page > 10_000) throw new SubmissionError('invalid-content');
        const rows = await SubmissionRecord.findAll({ where: { guildId, userId },
            order: [['createdAt', 'DESC'], ['id', 'ASC']], limit: 5, offset: page * 5 });
        return rows.map(recordData);
    }

    async listForRefresh(offset = 0, limit = 100): Promise<SubmissionRecordData[]> {
        if (!Number.isInteger(offset) || offset < 0 || !Number.isInteger(limit) || limit < 1 || limit > 100) {
            throw new SubmissionError('invalid-content');
        }
        const rows = await SubmissionRecord.findAll({ order: [['createdAt', 'ASC'], ['id', 'ASC']], limit, offset });
        return rows.map(recordData);
    }

    async finalizeUpload(guildId: string, id: string, userId: string, expectedVersion: number, input: {
        reviewChannelId: string; reviewMessageId: string; attachments: SubmissionAttachment[];
    }): Promise<SubmissionRecordData> {
        const current = await this.requireRecord(guildId, id);
        this.requireOwner(current, userId);
        if (input.reviewChannelId !== current.reviewChannelId || !input.reviewMessageId
            || input.attachments.length !== current.attachmentCount || !validAttachments(input.attachments)) {
            throw new SubmissionError('invalid-attachments');
        }
        return this.transition(guildId, id, expectedVersion, ['uploading'], {
            status: 'pending', reviewMessageId: input.reviewMessageId, attachmentsJson: JSON.stringify(input.attachments),
        }, userId);
    }

    async failUpload(guildId: string, id: string, userId: string, expectedVersion: number): Promise<SubmissionRecordData> {
        return this.transition(guildId, id, expectedVersion, ['uploading'], { status: 'upload_failed' }, userId);
    }

    async beginRevision(guildId: string, id: string, userId: string, expectedVersion: number,
        input: SubmissionContentInput): Promise<SubmissionRecordData> {
        const content = normalizeContent(input);
        return serializedTransaction(SubmissionRecord.sequelize!, async transaction => {
            const guard = await this.lock(`owner:${guildId}:${userId}`, transaction);
            const row = await this.requireRecord(guildId, id, transaction);
            this.requireOwner(row, userId);
            const category = await this.requireEnabledCategory(guildId, row.categoryId, transaction);
            const now = this.now();
            if (guard.lastSubmittedAt !== null && now - Number(guard.lastSubmittedAt) < SUBMISSION_COOLDOWN_MS) {
                throw new SubmissionError('cooldown');
            }
            const result = await this.transition(guildId, id, expectedVersion, ['changes_requested', 'upload_failed'], {
                ...content, status: 'uploading', categoryName: category.name, destinationChannelId: category.destinationChannelId,
                reviewChannelId: category.reviewChannelId, reviewerId: null, reason: null,
                reviewMessageId: null, attachmentsJson: '[]',
                publishedChannelId: null, publishedMessageId: null,
            }, userId, transaction);
            await guard.update({ lastSubmittedAt: now }, { transaction });
            return result;
        });
    }

    async review(guildId: string, id: string, expectedVersion: number, reviewerId: string,
        action: 'reject' | 'changes', reason: string, expectedCategoryVersion?: number): Promise<SubmissionRecordData> {
        const normalized = reason.trim();
        if (!normalized || normalized.length > 1000 || !['reject', 'changes'].includes(action)) {
            throw new SubmissionError('invalid-content');
        }
        return this.transitionReview(guildId, id, expectedVersion, {
            status: action === 'reject' ? 'rejected' : 'changes_requested', reviewerId, reason: normalized,
        }, expectedCategoryVersion);
    }

    async claimPublish(guildId: string, id: string, expectedVersion: number, reviewerId: string,
        expectedCategoryVersion?: number): Promise<SubmissionRecordData> {
        return this.transitionReview(guildId, id, expectedVersion, { status: 'publishing', reviewerId }, expectedCategoryVersion);
    }

    async finishPublish(guildId: string, id: string, expectedVersion: number, channelId: string, messageId: string): Promise<SubmissionRecordData> {
        const current = await this.requireRecord(guildId, id);
        if (channelId !== current.destinationChannelId || !messageId) throw new SubmissionError('invalid-content');
        return this.transition(guildId, id, expectedVersion, ['publishing'], {
            status: 'published', publishedChannelId: channelId, publishedMessageId: messageId,
        });
    }

    async reconcilePublish(guildId: string, id: string, expectedVersion: number, channelId: string, messageId: string): Promise<SubmissionRecordData> {
        const current = await this.requireRecord(guildId, id);
        if (channelId !== current.destinationChannelId || !messageId) throw new SubmissionError('invalid-content');
        return this.transition(guildId, id, expectedVersion, ['uncertain'], {
            status: 'published', publishedChannelId: channelId, publishedMessageId: messageId,
        });
    }

    async pruneFinalized(guildId: string): Promise<number> {
        return serializedTransaction(SubmissionRecord.sequelize!, async transaction => {
            const statuses: SubmissionStatus[] = ['published', 'rejected'];
            let removed = await SubmissionRecord.destroy({ where: { guildId, status: { [Op.in]: statuses },
                updatedAt: { [Op.lt]: this.now() - 90 * 24 * 60 * 60 * 1000 } }, transaction });
            const excess = await SubmissionRecord.findAll({ where: { guildId, status: { [Op.in]: statuses } },
                order: [['updatedAt', 'DESC'], ['id', 'ASC']], offset: 1000, limit: 500, attributes: ['id'], transaction });
            if (excess.length > 0) removed += await SubmissionRecord.destroy({ where: { guildId,
                id: { [Op.in]: excess.map(row => row.id) }, status: { [Op.in]: statuses } }, transaction });
            return removed;
        });
    }

    async failPublish(guildId: string, id: string, expectedVersion: number, uncertain: boolean): Promise<SubmissionRecordData> {
        return this.transition(guildId, id, expectedVersion, ['publishing'], { status: uncertain ? 'uncertain' : 'publish_failed' });
    }

    async recoverInterrupted(cutoff = this.now()): Promise<number> {
        let recovered = 0;
        let afterId: string | undefined;
        while (true) {
            const rows = await serializedTransaction(SubmissionRecord.sequelize!, async transaction => {
                const batch = await SubmissionRecord.findAll({ where: { status: { [Op.in]: ['uploading', 'publishing'] },
                    updatedAt: { [Op.lt]: cutoff }, ...(afterId ? { id: { [Op.gt]: afterId } } : {}) },
                    order: [['id', 'ASC']], limit: 100, transaction });
                for (const row of batch) {
                    const [count] = await SubmissionRecord.update({ status: row.status === 'publishing' ? 'uncertain' : 'upload_failed',
                        version: row.version + 1, updatedAt: this.now() }, { where: { id: row.id, version: row.version,
                            status: row.status, updatedAt: { [Op.lt]: cutoff } }, transaction });
                    recovered += count;
                }
                return batch;
            });
            if (rows.length < 100) break;
            afterId = rows[rows.length - 1]!.id;
        }
        return recovered;
    }

    private async lock(key: string, transaction: Transaction): Promise<SubmissionLock> {
        await SubmissionLock.findOrCreate({ where: { key }, defaults: { key, lastSubmittedAt: null }, transaction });
        return (await SubmissionLock.findByPk(key, { transaction, lock: transaction.LOCK.UPDATE }))!;
    }

    private async requireCapacity(guildId: string, userId: string, transaction: Transaction): Promise<void> {
        if (await SubmissionRecord.count({ where: { guildId, userId, status: { [Op.in]: activeStates } }, transaction }) >= SUBMISSION_ACTIVE_LIMIT) {
            throw new SubmissionError('active-limit');
        }
    }

    private async requireEnabledCategory(guildId: string, id: string, transaction?: Transaction): Promise<SubmissionCategory> {
        const category = await SubmissionCategory.findOne({ where: { guildId, id, enabled: true }, transaction,
            lock: transaction ? transaction.LOCK.UPDATE : undefined });
        if (!category) throw new SubmissionError('invalid-category');
        return category;
    }

    private async requireRecord(guildId: string, id: string, transaction?: Transaction): Promise<SubmissionRecord> {
        const row = await SubmissionRecord.findOne({ where: { guildId, id }, transaction });
        if (!row) throw new SubmissionError('not-found');
        return row;
    }

    private requireOwner(row: SubmissionRecord, userId: string): void {
        if (row.userId !== userId) throw new SubmissionError('forbidden');
    }

    private async transitionReview(guildId: string, id: string, expectedVersion: number,
        values: Record<string, unknown>, expectedCategoryVersion?: number): Promise<SubmissionRecordData> {
        return serializedTransaction(SubmissionRecord.sequelize!, async transaction => {
            const current = await this.requireRecord(guildId, id, transaction);
            const category = await this.requireEnabledCategory(guildId, current.categoryId, transaction);
            if (expectedCategoryVersion !== undefined && category.version !== expectedCategoryVersion) {
                throw new SubmissionError('stale');
            }
            return this.transition(guildId, id, expectedVersion, ['pending', 'publish_failed'], values, undefined, transaction);
        });
    }

    private async transition(guildId: string, id: string, expectedVersion: number, states: SubmissionStatus[],
        values: Record<string, unknown>, userId?: string, transaction?: Transaction): Promise<SubmissionRecordData> {
        if (!transaction) {
            return serializedTransaction(SubmissionRecord.sequelize!, scopedTransaction =>
                this.transition(guildId, id, expectedVersion, states, values, userId, scopedTransaction));
        }
        const row = await this.requireRecord(guildId, id, transaction);
        if (userId) this.requireOwner(row, userId);
        if (row.version !== expectedVersion) throw new SubmissionError('stale');
        if (!states.includes(row.status)) throw new SubmissionError('invalid-state');
        const [count] = await SubmissionRecord.update({ ...values, version: expectedVersion + 1, updatedAt: this.now() }, {
            where: { guildId, id, version: expectedVersion, status: { [Op.in]: states }, ...(userId ? { userId } : {}) }, transaction,
        });
        if (count !== 1) throw new SubmissionError('stale');
        return recordData(await this.requireRecord(guildId, id, transaction));
    }
}

function categoryData(row: SubmissionCategory): SubmissionCategoryData {
    return { id: row.id, guildId: row.guildId, name: row.name, destinationChannelId: row.destinationChannelId,
        reviewChannelId: row.reviewChannelId, reviewerRoleIds: JSON.parse(row.reviewerRoleIdsJson) as string[],
        submitterRoleIds: JSON.parse(row.submitterRoleIdsJson) as string[], enabled: Boolean(row.enabled), version: row.version };
}

function recordData(row: SubmissionRecord): SubmissionRecordData {
    const { attachmentsJson, ...values } = row.get({ plain: true }) as Omit<SubmissionRecordData, 'attachments'> & { attachmentsJson: string };
    return { ...values, attachments: JSON.parse(attachmentsJson) as SubmissionAttachment[],
        createdAt: Number(values.createdAt), updatedAt: Number(values.updatedAt) };
}

function normalizeContent(input: SubmissionContentInput): SubmissionContentInput {
    const explanation = input.explanation.trim();
    const link = input.link?.trim() || null;
    const credit = input.credit?.trim() || null;
    if (!explanation || explanation.length > 1000 || (credit && credit.length > 100)
        || !Number.isInteger(input.attachmentCount) || input.attachmentCount < 0 || input.attachmentCount > 4
        || (!link && input.attachmentCount === 0)) throw new SubmissionError('invalid-content');
    if (link) {
        try {
            const url = new URL(link);
            if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || link.length > 1000) throw new Error();
        } catch { throw new SubmissionError('invalid-content'); }
    }
    return { explanation, link, credit, attachmentCount: input.attachmentCount };
}

function validAttachments(attachments: SubmissionAttachment[]): boolean {
    return attachments.reduce((sum, item) => sum + item.size, 0) <= 20 * 1024 * 1024
        && new Set(attachments.map(item => item.id)).size === attachments.length && attachments.every((item, index) =>
        /^\d{1,32}$/.test(item.id) && item.name === `screenshot-${index + 1}.${({ 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' } as Record<string, string>)[item.contentType]}`
        && ['image/png', 'image/jpeg', 'image/webp'].includes(item.contentType)
        && Number.isSafeInteger(item.size) && item.size > 0 && item.size <= 8 * 1024 * 1024);
}
