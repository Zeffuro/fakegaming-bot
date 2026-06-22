import { randomUUID } from 'node:crypto';
import type { CreationAttributes } from 'sequelize';
import { BaseManager } from './baseManager.js';
import { UserNoteConfig } from '../models/user-note-config.js';

export interface UserNoteCreateInput {
    discordId: string;
    title?: string | null;
    body: string;
    pinned?: boolean;
}

export interface UserNoteUpdateInput {
    title?: string;
    body?: string;
    pinned?: boolean;
}

export type UserNoteRecord = CreationAttributes<UserNoteConfig>;

export function deriveUserNoteTitle(title: string | null | undefined, body: string): string {
    const trimmedTitle = title?.trim();
    if (trimmedTitle) return trimmedTitle.slice(0, 160);

    const firstBodyLine = body
        .split(/\r?\n/)
        .map((line) => line.trim())
        .find((line) => line.length > 0);
    if (!firstBodyLine) return 'Untitled note';

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
            ],
            raw: true,
        });
        return notes as unknown as UserNoteRecord[];
    }

    async countForUser(discordId: string): Promise<number> {
        return this.count({ discordId });
    }

    async getForUser(id: string, discordId: string): Promise<UserNoteRecord | null> {
        return this.getOnePlain({ id, discordId });
    }

    async createForUser(input: UserNoteCreateInput): Promise<UserNoteRecord> {
        return this.addPlain({
            id: randomUUID(),
            discordId: input.discordId,
            title: deriveUserNoteTitle(input.title, input.body),
            body: input.body,
            pinned: input.pinned ?? false,
        } as CreationAttributes<UserNoteConfig>);
    }

    async updateForUser(id: string, discordId: string, input: UserNoteUpdateInput): Promise<UserNoteRecord | null> {
        const existing = await this.getForUser(id, discordId);
        if (!existing) return null;

        const update = { ...input };
        if (Object.hasOwn(update, 'title')) {
            update.title = deriveUserNoteTitle(update.title, update.body ?? existing.body);
        }

        await this.updatePlain(update as CreationAttributes<UserNoteConfig>, { id, discordId });
        return this.getForUser(id, discordId);
    }

    async removeForUser(id: string, discordId: string): Promise<boolean> {
        const deleted = await this.model.destroy({ where: { id, discordId } as never });
        return deleted > 0;
    }
}
