import { randomUUID } from 'node:crypto';
import type { CreationAttributes } from 'sequelize';
import { createCommonTranslator } from '../messages/index.js';
import { BaseManager } from './baseManager.js';
import { UserNoteConfig } from '../models/user-note-config.js';
import { DEFAULT_OUTPUT_LOCALE, type SupportedOutputLocale } from '../utils/outputLocale.js';

export interface UserNoteCreateInput {
    discordId: string;
    title?: string | null;
    body: string;
    pinned?: boolean;
    locale?: SupportedOutputLocale;
    tags?: string[];
    status?: UserNoteStatus;
    sourceUrl?: string | null;
}

export interface UserNoteUpdateInput {
    title?: string;
    body?: string;
    pinned?: boolean;
    locale?: SupportedOutputLocale;
    tags?: string[];
    status?: UserNoteStatus;
    sourceUrl?: string | null;
}

export interface UserNoteRecord {
    id: string;
    discordId: string;
    title: string;
    body: string;
    pinned: boolean;
    tags: string[];
    status: UserNoteStatus;
    sourceUrl: string | null;
    createdAt?: Date | string;
    updatedAt?: Date | string;
}
export type UserNoteStatus = 'unread' | 'read' | 'archived';
export interface UserNoteInboxFilter {
    query?: string;
    tag?: string;
    status?: UserNoteStatus | 'active' | 'all';
    page?: number;
    pageSize?: number;
}

export function normalizeNoteTags(tags: string[]): string[] {
    if (tags.length > 10) throw new Error('Too many note tags');
    const normalized = tags.map(tag => tag.trim().normalize('NFKC').toLowerCase()).filter(Boolean);
    if (normalized.some(tag => tag.length > 32)) throw new Error('Note tag too long');
    return [...new Set(normalized)];
}

export function normalizeNoteSourceUrl(value: string | null | undefined): string | null {
    if (!value?.trim()) return null;
    const url = new URL(value.trim());
    if (value.length > 2048 || !['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new Error('Invalid note source URL');
    return url.href;
}

export function filterNoteInbox(notes: UserNoteRecord[], filter: UserNoteInboxFilter = {}) {
    const query = filter.query?.trim().normalize('NFKC').toLowerCase() ?? '';
    const tag = filter.tag?.trim().normalize('NFKC').toLowerCase();
    const status = filter.status ?? 'active';
    const selected = notes.filter(note => {
        const state = note.status ?? 'unread';
        if (status === 'active' ? state === 'archived' : status !== 'all' && state !== status) return false;
        if (tag && !(note.tags ?? []).includes(tag)) return false;
        return !query || `${note.title}\n${note.body}`.normalize('NFKC').toLowerCase().includes(query);
    });
    const pageSize = Math.min(50, Math.max(1, Math.trunc(filter.pageSize ?? 5)));
    const pages = Math.max(1, Math.ceil(selected.length / pageSize));
    const page = Math.min(pages, Math.max(1, Math.trunc(filter.page ?? 1)));
    return { notes: selected.slice((page - 1) * pageSize, page * pageSize), total: selected.length, page, pages };
}

function normalizeNoteRecord(note: UserNoteRecord): UserNoteRecord {
    let tags: unknown = note.tags;
    if (typeof tags === 'string') {
        try { tags = JSON.parse(tags); } catch { tags = []; }
    }
    return {
        ...note,
        tags: Array.isArray(tags) ? tags.filter((tag): tag is string => typeof tag === 'string').slice(0, 10) : [],
        status: note.status ?? 'unread',
        sourceUrl: note.sourceUrl ?? null,
    };
}

export function deriveUserNoteTitle(
    title: string | null | undefined,
    body: string,
    locale: SupportedOutputLocale = DEFAULT_OUTPUT_LOCALE,
): string {
    const trimmedTitle = title?.trim();
    if (trimmedTitle) return trimmedTitle.slice(0, 160);

    const firstBodyLine = body
        .split(/\r?\n/)
        .map((line) => line.trim())
        .find((line) => line.length > 0);
    if (!firstBodyLine) return createCommonTranslator(locale)('shared.notes.untitled');

    return firstBodyLine.replace(/\s+/g, ' ').slice(0, 160);
}

export class UserNoteManager extends BaseManager<UserNoteConfig> {
    constructor() {
        super(UserNoteConfig);
    }

    async listForUser(discordId: string): Promise<UserNoteRecord[]> {
        const notes = await this.model.findAll({
            where: { discordId },
            order: [
                ['pinned', 'DESC'],
                ['updatedAt', 'DESC'],
                ['id', 'ASC'],
            ],
            raw: true,
        });
        return (notes as unknown as UserNoteRecord[]).map(normalizeNoteRecord);
    }

    async countForUser(discordId: string): Promise<number> {
        return this.count({ discordId });
    }

    async getForUser(id: string, discordId: string): Promise<UserNoteRecord | null> {
        const note = await this.getOnePlain({ id, discordId });
        return note ? normalizeNoteRecord(note as unknown as UserNoteRecord) : null;
    }

    async createForUser(input: UserNoteCreateInput): Promise<UserNoteRecord> {
        if (input.status && !['unread', 'read', 'archived'].includes(input.status)) throw new Error('Invalid note status');
        const created = await this.addPlain({
            id: randomUUID(),
            discordId: input.discordId,
            title: deriveUserNoteTitle(input.title, input.body, input.locale),
            body: input.body,
            pinned: input.pinned ?? false,
            tags: normalizeNoteTags(input.tags ?? []),
            status: input.status ?? 'unread',
            sourceUrl: normalizeNoteSourceUrl(input.sourceUrl),
        } as CreationAttributes<UserNoteConfig>);
        return normalizeNoteRecord(created as unknown as UserNoteRecord);
    }

    async updateForUser(id: string, discordId: string, input: UserNoteUpdateInput): Promise<UserNoteRecord | null> {
        const existing = await this.getForUser(id, discordId);
        if (!existing) return null;

        const {locale, ...update} = input;
        if (update.tags) update.tags = normalizeNoteTags(update.tags);
        if (Object.hasOwn(update, 'sourceUrl')) update.sourceUrl = normalizeNoteSourceUrl(update.sourceUrl);
        if (update.status && !['unread', 'read', 'archived'].includes(update.status)) throw new Error('Invalid note status');
        if (Object.hasOwn(update, 'title')) {
            update.title = deriveUserNoteTitle(update.title, update.body ?? existing.body, locale);
        }

        await this.updatePlain(update as CreationAttributes<UserNoteConfig>, { id, discordId });
        return this.getForUser(id, discordId);
    }

    async inboxForUser(discordId: string, filter: UserNoteInboxFilter = {}) {
        return filterNoteInbox(await this.listForUser(discordId), filter);
    }

    async removeForUser(id: string, discordId: string): Promise<boolean> {
        const deleted = await this.model.destroy({ where: { id, discordId } as never });
        return deleted > 0;
    }
}
