import { Op } from 'sequelize';
import { CalendarPublication, CalendarPublicationDraft, CalendarPublicationDelivery, CalendarEventSnapshot, PersonalSchedule } from '@zeffuro/fakegaming-common/models';
import { serializedTransaction } from '@zeffuro/fakegaming-common/managers';
import { resolveGuildOutputLocale } from '../localization/locale.js';
import { CalendarPublishDiscordError, validatePublicationDestination, createPublicationEvent, editPublicationEvent,
    sendPublicationMessage, editPublicationMessage, type PublicationWriteResult } from './discord.js';
import { DAY, futurePublicationRows, hashPublication, publicationSource, publicOccurrence, PublicationError,
    type PublicationInput } from './configuration.js';
import { publicationEvent, publicationMessage } from './payload.js';

let running = false;
const RETRY_DELAY = 10 * 60_000;

async function pause(row: CalendarPublication, lastError: string) {
    await CalendarPublication.update({ enabled: false, version: row.version + 1, lastError }, { where: { id: row.id, version: row.version } });
}

async function claim(publication: CalendarPublication, occurrenceId: string, kind: 'message' | 'event', clock: () => number) {
    return serializedTransaction(CalendarPublication.sequelize!, async transaction => {
        await publicationSource(publication.userId, publication.sourceId, transaction);
        const current = await CalendarPublication.findOne({ where: { id: publication.id, userId: publication.userId,
            enabled: true, version: publication.version }, transaction, lock: transaction.LOCK.UPDATE });
        if (!current) return null;
        const pointer = await CalendarEventSnapshot.findOne({ where: { id: occurrenceId, userId: current.userId, sourceId: current.sourceId }, transaction });
        if (!pointer) return null;
        const parent = await PersonalSchedule.findOne({ where: { id: pointer.scheduleId, userId: current.userId, sourceId: current.sourceId, enabled: true }, transaction, lock: transaction.LOCK.UPDATE });
        if (!parent) return null;
        const row = await CalendarEventSnapshot.findOne({ where: { id: occurrenceId, userId: current.userId, sourceId: current.sourceId }, transaction, lock: transaction.LOCK.UPDATE });
        if (!row) return null;
        const id = hashPublication([current.id, occurrenceId, kind]);
        let delivery = await CalendarPublicationDelivery.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
        const now = clock();
        if (delivery?.status === 'sending' || delivery?.status === 'missing' || (delivery?.status === 'uncertain' && !delivery.remoteId)) return null;
        if (delivery && delivery.status !== 'sent' && Number(delivery.attemptedAt) > now - RETRY_DELAY) return null;
        const shared = publicOccurrence(row, current.publicTitle);
        if (!delivery?.remoteId && (shared.cancelled || shared.plannedAt <= now || shared.plannedAt > now + current.lookaheadDays * DAY)) return null;
        if (kind === 'event') {
            if (current.eventLeadDays === null) return null;
            if (!delivery?.remoteId && shared.plannedAt > now + current.eventLeadDays * DAY) return null;
            if (delivery?.remoteId && !shared.cancelled && shared.plannedAt <= now) return null;
        }
        const locale = await resolveGuildOutputLocale(current.guildId);
        const payload = kind === 'message' ? publicationMessage(shared, locale, now)
            : shared.cancelled ? { status: 4 } : publicationEvent(shared, locale);
        const desiredHash = hashPublication(payload);
        if (delivery?.status === 'sent' && delivery.renderedHash === desiredHash) return null;
        if (!delivery) delivery = await CalendarPublicationDelivery.create({ id, publicationId: current.id, occurrenceId, kind, status: 'sending',
            remoteId: null, renderedHash: null, attemptedAt: now }, { transaction });
        else await delivery.update({ status: 'sending', attemptedAt: now }, { transaction });
        return { id, remoteId: delivery.remoteId, payload, desiredHash, attemptedAt: now };
    });
}

async function settle(claimed: { id: string; remoteId: string | null; desiredHash: string; attemptedAt: number }, result: PublicationWriteResult) {
    await CalendarPublicationDelivery.update({ status: result.status, ...(result.status === 'sent' ? { remoteId: result.id, renderedHash: claimed.desiredHash } : {}) },
        { where: { id: claimed.id, status: 'sending', attemptedAt: claimed.attemptedAt } });
}

async function freshForWrite(publication: CalendarPublication, occurrenceId: string, kind: 'message' | 'event', claimed: { desiredHash: string; remoteId: string | null }, clock: () => number) {
    return serializedTransaction(CalendarPublication.sequelize!, async transaction => {
        await publicationSource(publication.userId, publication.sourceId, transaction);
        const current = await CalendarPublication.findOne({ where: { id: publication.id, enabled: true, version: publication.version }, transaction, lock: transaction.LOCK.UPDATE });
        if (!current) return false;
        const pointer = await CalendarEventSnapshot.findOne({ where: { id: occurrenceId, userId: current.userId, sourceId: current.sourceId }, transaction });
        if (!pointer) return false;
        const parent = await PersonalSchedule.findOne({ where: { id: pointer.scheduleId, userId: current.userId, sourceId: current.sourceId, enabled: true }, transaction, lock: transaction.LOCK.UPDATE });
        if (!parent) return false;
        const row = await CalendarEventSnapshot.findOne({ where: { id: occurrenceId, userId: current.userId, sourceId: current.sourceId }, transaction, lock: transaction.LOCK.UPDATE });
        if (!row) return false;
        const now = clock();
        const shared = publicOccurrence(row, current.publicTitle);
        if (!claimed.remoteId && (shared.cancelled || shared.plannedAt <= now || shared.plannedAt > now + current.lookaheadDays * DAY)) return false;
        if (kind === 'event' && (current.eventLeadDays === null || (!claimed.remoteId && shared.plannedAt > now + current.eventLeadDays * DAY)
            || (claimed.remoteId && !shared.cancelled && shared.plannedAt <= now))) return false;
        const locale = await resolveGuildOutputLocale(current.guildId);
        const payload = kind === 'message' ? publicationMessage(shared, locale, now) : shared.cancelled ? { status: 4 } : publicationEvent(shared, locale);
        return hashPublication(payload) === claimed.desiredHash;
    });
}

export async function processCalendarPublications(now = Date.now()): Promise<{ sent: number; errors: number }> {
    if (running) return { sent: 0, errors: 0 };
    running = true;
    let sent = 0;
    let errors = 0;
    let writes = 0;
    const startedAt = Date.now();
    const clock = () => now + Math.max(0, Date.now() - startedAt);
    try {
        // Unknown creations are never replayed after a crash. Updates with known IDs are safe to retry.
        await CalendarPublicationDelivery.update({ status: 'uncertain' }, { where: { status: 'sending', attemptedAt: { [Op.lt]: now - RETRY_DELAY } } });
        await CalendarPublicationDraft.destroy({ where: { expiresAt: { [Op.lt]: now } } });
        const publications = await CalendarPublication.findAll({ where: { enabled: true }, order: [['updatedAt', 'ASC'], ['id', 'ASC']], limit: 100 });
        for (const publication of publications) {
            try {
                await publicationSource(publication.userId, publication.sourceId);
                await validatePublicationDestination(publication.userId, publication.guildId, publication.channelId, publication.eventLeadDays !== null);
                const input: PublicationInput = { sourceId: publication.sourceId, guildId: publication.guildId, channelId: publication.channelId,
                    lookaheadDays: publication.lookaheadDays, eventLeadDays: publication.eventLeadDays, publicTitle: publication.publicTitle };
                const future = await futurePublicationRows(publication.userId, input, clock());
                if (future.length > 100) throw new PublicationError('too_many');
                const previous = await CalendarPublicationDelivery.findAll({ where: { publicationId: publication.id, remoteId: { [Op.ne]: null } },
                    order: [['attemptedAt', 'DESC']], limit: 1000 });
                const ids = [...new Set([...future.map(row => row.id), ...previous.map(row => row.occurrenceId)])];
                for (const id of ids) {
                    for (const kind of ['message', 'event'] as const) {
                        if (writes >= 30) break;
                        const claimed = await claim(publication, id, kind, clock);
                        if (!claimed) continue;
                        let result: PublicationWriteResult;
                        try {
                            // Recheck permission changes during the batch before each public write.
                            await validatePublicationDestination(publication.userId, publication.guildId, publication.channelId, publication.eventLeadDays !== null);
                            if (!await freshForWrite(publication, id, kind, claimed, clock)) { await settle(claimed, { status: 'rejected' }); continue; }
                            writes += 1;
                            result = kind === 'message'
                                ? claimed.remoteId ? await editPublicationMessage(publication.channelId, claimed.remoteId, claimed.payload) : await sendPublicationMessage(publication.channelId, claimed.payload)
                                : claimed.remoteId ? await editPublicationEvent(publication.guildId, claimed.remoteId, claimed.payload) : await createPublicationEvent(publication.guildId, claimed.payload);
                        } catch (error) {
                            await settle(claimed, { status: 'rejected' });
                            throw error;
                        }
                        await settle(claimed, result);
                        if (result.status === 'sent') sent += 1;
                        else errors += 1;
                    }
                    if (writes >= 30) break;
                }
                const failed = await CalendarPublicationDelivery.count({ where: { publicationId: publication.id, status: { [Op.in]: ['rejected', 'missing'] } } });
                await CalendarPublication.update({ lastError: failed ? 'rejected' : null, updatedAt: new Date(clock()) }, { where: { id: publication.id, version: publication.version } });
            } catch (error) {
                errors += 1;
                if (error instanceof PublicationError || (error instanceof CalendarPublishDiscordError && error.code !== 'unavailable')) await pause(publication, error.code);
                else await CalendarPublication.update({ lastError: 'unavailable' }, { where: { id: publication.id, version: publication.version } });
            }
            if (writes >= 30) break;
        }
        return { sent, errors };
    } finally { running = false; }
}
