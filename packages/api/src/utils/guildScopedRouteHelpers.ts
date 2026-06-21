import type { Request, Response } from 'express';
import {
    checkGuildScopedRecordAccess,
    checkGuildScopedUpdateAccess,
    checkUserGuildAccess,
    filterGuildScopedRecordsForRequest,
    type GuildScopedRecord,
} from './authHelpers.js';
import { recordAuditEvent } from './audit.js';

interface DiscordChannelRecord extends GuildScopedRecord {
    discordChannelId?: string | null;
}

interface DeleteGuildScopedRecordOptions<T extends GuildScopedRecord, TId extends string | number> {
    findByPk: (id: TId) => Promise<T | null>;
    removeByPk: (id: TId) => Promise<void>;
    notFoundMessage: string;
    auditAction: string;
    auditTargetType: string;
    auditMetadata: (record: T) => Record<string, unknown>;
}

interface UpdateGuildScopedRecordOptions<TRecord extends GuildScopedRecord, TBody extends Record<string, unknown>> {
    findByPk: (id: number) => Promise<TRecord | null>;
    update: (id: number, body: TBody) => Promise<unknown>;
    notFoundMessage: string;
    auditAction: string;
    auditTargetType: string;
    auditMetadata: (updated: TRecord, previous: TRecord) => Record<string, unknown>;
}

interface UpsertGuildScopedRecordOptions<TBody extends GuildScopedRecord & Record<string, unknown>> {
    upsert: (body: TBody) => Promise<boolean>;
    createAction: string;
    updateAction: string;
    targetType: string;
    targetId: (body: TBody) => string | number | null;
    metadata: (body: TBody) => Record<string, unknown>;
}

interface GuildScopedListManager<TRecord extends GuildScopedRecord> {
    getAllPlain(): Promise<TRecord[]>;
    getManyPlain(where: { guildId: string }): Promise<TRecord[]>;
}

export function sendNotFound(res: Response, message: string): Response {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message } });
}

export async function loadGuildScopedRecords<TRecord extends GuildScopedRecord>(
    manager: GuildScopedListManager<TRecord>,
    guildId: string | undefined
): Promise<TRecord[]> {
    if (guildId) {
        return manager.getManyPlain({ guildId });
    }

    return manager.getAllPlain();
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

export async function sendGuildScopedRecordById<T extends GuildScopedRecord, TId extends string | number>(
    req: Request,
    res: Response,
    id: TId,
    options: {
        findByPk: (id: TId) => Promise<T | null>;
        notFoundMessage: string;
    }
): Promise<void> {
    const record = await options.findByPk(id);
    if (!record) {
        sendNotFound(res, options.notFoundMessage);
        return;
    }

    const hasAccess = await canReadGuildScopedRecord(req, res, record);
    if (!hasAccess) return;
    res.json(record);
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

export async function deleteGuildScopedRecord<T extends GuildScopedRecord, TId extends string | number>(
    req: Request,
    res: Response,
    id: TId,
    options: DeleteGuildScopedRecordOptions<T, TId>
): Promise<void> {
    const record = await options.findByPk(id);
    if (!record) {
        sendNotFound(res, options.notFoundMessage);
        return;
    }

    const hasAccess = await canDeleteGuildScopedRecord(req, res, record);
    if (!hasAccess) return;

    await options.removeByPk(id);
    await recordAuditEvent(req, {
        action: options.auditAction,
        targetType: options.auditTargetType,
        targetId: id,
        guildId: record.guildId ?? null,
        metadata: options.auditMetadata(record),
    });
    res.json({ success: true });
}

export async function updateGuildScopedRecord<TRecord extends GuildScopedRecord, TBody extends Record<string, unknown>>(
    req: Request,
    res: Response,
    id: number,
    body: TBody,
    options: UpdateGuildScopedRecordOptions<TRecord, TBody>
): Promise<void> {
    const previous = await options.findByPk(id);
    if (!previous) {
        sendNotFound(res, options.notFoundMessage);
        return;
    }

    const hasAccess = await canUpdateGuildScopedRecordFromBody(req, res, previous, body);
    if (!hasAccess) return;

    await options.update(id, body);
    const updated = await options.findByPk(id);
    if (!updated) {
        sendNotFound(res, options.notFoundMessage);
        return;
    }

    await recordAuditEvent(req, {
        action: options.auditAction,
        targetType: options.auditTargetType,
        targetId: id,
        guildId: updated.guildId ?? previous.guildId ?? null,
        metadata: options.auditMetadata(updated, previous),
    });
    res.json(updated);
}

export async function upsertGuildScopedRecord<TBody extends GuildScopedRecord & Record<string, unknown>>(
    req: Request,
    res: Response,
    body: TBody,
    options: UpsertGuildScopedRecordOptions<TBody>
): Promise<void> {
    const created = await options.upsert(body);
    await recordAuditEvent(req, {
        action: created ? options.createAction : options.updateAction,
        targetType: options.targetType,
        targetId: options.targetId(body),
        guildId: body.guildId ?? null,
        metadata: options.metadata(body),
    });
    res.status(created ? 201 : 200).json({ success: true });
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
