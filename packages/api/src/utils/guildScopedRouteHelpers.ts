import type { Request, Response } from 'express';
import {
    checkGuildScopedRecordAccess,
    checkGuildScopedUpdateAccess,
    checkUserGuildAccess,
    filterGuildScopedRecordsForRequest,
    type GuildScopedRecord,
} from './authHelpers.js';

interface DiscordChannelRecord extends GuildScopedRecord {
    discordChannelId?: string | null;
}

export function sendNotFound(res: Response, message: string): Response {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message } });
}

export async function sendGuildScopedRecords<T extends GuildScopedRecord>(
    req: Request,
    res: Response,
    records: T[],
    guildId: string | undefined
): Promise<void> {
    const visibleRecords = await filterGuildScopedRecordsForRequest(req, res, records, guildId);
    if (!visibleRecords) return;
    res.json(visibleRecords);
}

export async function canReadGuildScopedRecord<T extends GuildScopedRecord>(
    req: Request,
    res: Response,
    record: T
): Promise<boolean> {
    return checkGuildScopedRecordAccess(req, res, record);
}

export async function canUpdateGuildScopedRecordFromBody<T extends GuildScopedRecord>(
    req: Request,
    res: Response,
    record: T,
    body: unknown
): Promise<boolean> {
    return checkGuildScopedUpdateAccess(req, res, record, getBodyGuildId(body));
}

export async function canDeleteGuildScopedRecord<T extends GuildScopedRecord>(
    req: Request,
    res: Response,
    record: T
): Promise<boolean> {
    if (!record.guildId) return true;
    const access = await checkUserGuildAccess(req, res, record.guildId);
    return access.authorized;
}

export function channelAuditMetadata(record: DiscordChannelRecord, extra: Record<string, unknown> = {}): Record<string, unknown> {
    return withOptionalChannelId(record.discordChannelId, extra);
}

export function updatedChannelAuditMetadata(
    updated: DiscordChannelRecord,
    previous: DiscordChannelRecord,
    extra: Record<string, unknown> = {}
): Record<string, unknown> {
    return withOptionalChannelId(updated.discordChannelId ?? previous.discordChannelId, extra);
}

function getBodyGuildId(body: unknown): string | undefined {
    if (typeof body !== 'object' || body === null) return undefined;
    const { guildId } = body as { guildId?: unknown };
    return typeof guildId === 'string' ? guildId : undefined;
}

function withOptionalChannelId(channelId: string | null | undefined, extra: Record<string, unknown>): Record<string, unknown> {
    if (channelId === undefined) return extra;
    return {
        channelId,
        ...extra,
    };
}
