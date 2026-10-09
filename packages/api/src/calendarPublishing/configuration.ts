import { createHash, randomUUID } from 'node:crypto';
import { Op, type Transaction } from 'sequelize';
import { z } from 'zod';
import { CalendarConnection, CalendarSource, CalendarPublication, CalendarPublicationDraft, CalendarPublicationDelivery,
    PersonalSchedule, CalendarEventSnapshot, CalendarEventSnapshotState } from '@zeffuro/fakegaming-common/models';
import { serializedTransaction } from '@zeffuro/fakegaming-common/managers';
import { validatePublicationDestination } from './discord.js';
import { resolveGuildOutputLocale } from '../localization/locale.js';
import { publicationEvent, publicationMessageDetails } from './payload.js';

export const DAY = 86_400_000;
export const publicationInputSchema = z.object({
    sourceId: z.string().uuid(), guildId: z.string().regex(/^\d{17,20}$/), channelId: z.string().regex(/^\d{17,20}$/),
    lookaheadDays: z.number().int().min(30).max(365), eventLeadDays: z.number().int().min(1).max(30).nullable(),
    publicTitle: z.string().trim().min(1).max(100).nullable(),
    includeEventDetails: z.boolean().optional().default(false),
}).strict();
export type PublicationInput = z.infer<typeof publicationInputSchema>;
export class PublicationError extends Error {
    constructor(public readonly code: 'not_found' | 'stale_preview' | 'too_many' | 'not_ready' | 'conflict') { super(code); }
}
export interface PublicOccurrence { id: string; title: string; plannedAt: number; endAt: number | null; timezone: string; allDay: boolean; cancelled: boolean;
    htmlLink?: string | null; location?: string | null; description?: string | null }
export const hashPublication = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function publicOccurrence(row: CalendarEventSnapshot, title: string | null, includeEventDetails = false): PublicOccurrence {
    return { id: row.id, title: title ?? row.title, plannedAt: Number(row.plannedAt), endAt: row.endAt === null ? null : Number(row.endAt),
        timezone: row.timezone, allDay: row.allDay, cancelled: row.cancelled,
        htmlLink: includeEventDetails ? row.htmlLink ?? null : null, location: includeEventDetails ? row.location ?? null : null,
        description: includeEventDetails ? row.description ?? null : null };
}

export async function publicationSource(userId: string, sourceId: string, transaction?: Transaction): Promise<CalendarSource> {
    const connection = await CalendarConnection.findByPk(userId, { transaction, ...(transaction ? { lock: transaction.LOCK.UPDATE } : {}) });
    const source = await CalendarSource.findOne({ where: { id: sourceId, userId }, transaction, ...(transaction ? { lock: transaction.LOCK.UPDATE } : {}) });
    if (!source) throw new PublicationError('not_found');
    const snapshot = await CalendarEventSnapshotState.findOne({ where: { sourceId, userId }, transaction });
    if (!source.enabled || connection?.status !== 'connected' || source.lastSyncedAt === null || !snapshot
        || Number(snapshot.observedAt) !== Number(source.lastSyncedAt)) throw new PublicationError('not_ready');
    return source;
}

export async function futurePublicationRows(userId: string, input: PublicationInput, now: number, transaction?: Transaction): Promise<CalendarEventSnapshot[]> {
    const parents = await PersonalSchedule.findAll({ where: { userId, sourceId: input.sourceId, enabled: true }, transaction });
    return CalendarEventSnapshot.findAll({ where: { userId, sourceId: input.sourceId, scheduleId: { [Op.in]: parents.map(row => row.id) }, cancelled: false,
        plannedAt: { [Op.gt]: now, [Op.lte]: now + input.lookaheadDays * DAY } }, order: [['plannedAt', 'ASC'], ['id', 'ASC']], limit: 101, transaction });
}

async function snapshot(userId: string, input: PublicationInput, previewAt: number, transaction?: Transaction) {
    const source = await publicationSource(userId, input.sourceId, transaction);
    const rows = await futurePublicationRows(userId, input, previewAt, transaction);
    if (rows.length > 100) throw new PublicationError('too_many');
    const events = rows.map(row => publicOccurrence(row, input.publicTitle, input.includeEventDetails));
    return { events, hash: hashPublication({ calendarId: source.calendarId, titleFilter: source.titleFilter, timezone: source.timezone, events }) };
}

export async function previewPublication(userId: string, input: PublicationInput, now = Date.now()) {
    // Check ownership before any guild lookup or shared data access.
    await publicationSource(userId, input.sourceId);
    const destination = await validatePublicationDestination(userId, input.guildId, input.channelId, input.eventLeadDays !== null);
    const locale = await resolveGuildOutputLocale(input.guildId);
    return serializedTransaction(CalendarPublication.sequelize!, async transaction => {
        const current = await snapshot(userId, input, now, transaction);
        await CalendarPublicationDraft.destroy({ where: { userId }, transaction });
        const draft = await CalendarPublicationDraft.create({ id: randomUUID(), userId, configuration: { ...input, ...destination },
            snapshotHash: current.hash, previewAt: now, expiresAt: now + 10 * 60_000 }, { transaction });
        return { draftId: draft.id, expiresAt: Number(draft.expiresAt), ...destination, count: current.events.length,
            eventCount: input.eventLeadDays === null ? 0 : current.events.filter(row => row.plannedAt <= now + input.eventLeadDays! * DAY).length,
            lookaheadDays: input.lookaheadDays, eventLeadDays: input.eventLeadDays, publicTitle: input.publicTitle, includeEventDetails: input.includeEventDetails,
            events: current.events.map(({ id: _id, cancelled: _cancelled, ...row }) => {
                const details = input.eventLeadDays === null ? null : publicationEvent({ id: _id, cancelled: _cancelled, ...row }, locale);
                const channelMessage = publicationMessageDetails({ id: _id, cancelled: _cancelled, ...row }, locale);
                return { ...row, duration: channelMessage.duration, channelMessage, discordEvent: details === null ? null : { name: details.name as string,
                    plannedAt: Date.parse(details.scheduled_start_time as string), endAt: Date.parse(details.scheduled_end_time as string),
                    location: (details.entity_metadata as { location: string }).location, description: details.description as string } };
            }) };
    });
}

export async function confirmPublication(userId: string, draftId: string, channelName: string, acknowledgeEvents: boolean, now = Date.now()) {
    const startedAt = Date.now();
    const clock = () => now + Math.max(0, Date.now() - startedAt);
    const pointer = await CalendarPublicationDraft.findOne({ where: { id: draftId, userId } });
    if (!pointer || Number(pointer.expiresAt) <= now) throw new PublicationError('stale_preview');
    const input = publicationInputSchema.parse(Object.fromEntries(Object.entries(pointer.configuration).filter(([key]) => key !== 'guildName' && key !== 'channelName')));
    await publicationSource(userId, input.sourceId);
    const destination = await validatePublicationDestination(userId, input.guildId, input.channelId, input.eventLeadDays !== null);
    if (destination.channelName !== channelName || destination.channelName !== pointer.configuration.channelName
        || destination.guildName !== pointer.configuration.guildName || (input.eventLeadDays !== null && !acknowledgeEvents)) throw new PublicationError('stale_preview');
    return serializedTransaction(CalendarPublication.sequelize!, async transaction => {
        // Connection -> source -> publication is the same lock order as delivery and stopping imports.
        const current = await snapshot(userId, input, Number(pointer.previewAt), transaction);
        const draft = await CalendarPublicationDraft.findOne({ where: { id: draftId, userId }, transaction, lock: transaction.LOCK.UPDATE });
        if (!draft || Number(draft.expiresAt) <= clock() || draft.snapshotHash !== current.hash) throw new PublicationError('stale_preview');
        const existing = await CalendarPublication.findOne({ where: { sourceId: input.sourceId, guildId: input.guildId, channelId: input.channelId }, transaction, lock: transaction.LOCK.UPDATE });
        if (existing && (existing.userId !== userId || existing.enabled)) throw new PublicationError('conflict');
        if (await CalendarPublication.count({ where: { userId, enabled: true }, transaction }) >= 10) throw new PublicationError('too_many');
        const row = existing ? await existing.update({ ...input, ...destination, enabled: true, lastError: null, version: existing.version + 1 }, { transaction })
            : await CalendarPublication.create({ id: randomUUID(), userId, ...input, ...destination, enabled: true, version: 1 }, { transaction });
        await draft.destroy({ transaction });
        return publicationView(row);
    });
}

export async function publicationView(row: CalendarPublication) {
    const uncertainCount = await CalendarPublicationDelivery.count({ where: { publicationId: row.id, status: 'uncertain' } });
    return { id: row.id, sourceId: row.sourceId, guildId: row.guildId, channelId: row.channelId, guildName: row.guildName, channelName: row.channelName,
        lookaheadDays: row.lookaheadDays, eventLeadDays: row.eventLeadDays, publicTitle: row.publicTitle, includeEventDetails: row.includeEventDetails,
        enabled: row.enabled, lastError: row.lastError, uncertainCount };
}

export async function stopPublication(userId: string, id: string): Promise<void> {
    await serializedTransaction(CalendarPublication.sequelize!, async transaction => {
        await CalendarPublicationDraft.destroy({ where: { userId }, transaction });
        const row = await CalendarPublication.findOne({ where: { id, userId }, transaction, lock: transaction.LOCK.UPDATE });
        if (!row) throw new PublicationError('not_found');
        await row.update({ enabled: false, version: row.version + 1 }, { transaction });
    });
}
