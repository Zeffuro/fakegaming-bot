import { randomUUID } from 'node:crypto';
import { Op, UniqueConstraintError, type Transaction } from 'sequelize';
import { UserSession } from '../models/personal-productivity.js';
import { ReminderConfig } from '../models/reminder-config.js';
import { serializedTransaction } from './serializedTransaction.js';
import { createOwnedReminder, PersonalError, removeOwnedReminder, requirePersonalText } from './productivityShared.js';

export interface UserSessionMessages {
    focus: string; break: string; finished: string; takeBreak: string;
}

export interface UserSessionBoard {
    id: string; userId: string; title: string; kind: 'focus' | 'gaming'; state: 'running' | 'paused' | 'stopped' | 'finished';
    phase: 'focus' | 'break'; pomodoro: boolean; cycleIndex: number; cycles: number;
    workMs: number; breakElapsedMs: number; phaseElapsedMs: number; remainingMs: number | null;
    startedAt: number; endedAt: number | null; reminderId: string | null; version: number;
}

export class UserSessionManager {
    constructor(private readonly now: () => number = Date.now) {}

    async start(input: {
        userId: string; title: string; kind: 'focus' | 'gaming'; minutes?: number | null; pomodoro?: boolean;
        breakMinutes?: number; cycles?: number; breakEveryMinutes?: number | null; messages: UserSessionMessages;
    }): Promise<UserSessionBoard> {
        const title = requirePersonalText(input.title);
        const pomodoro = input.pomodoro ?? false;
        const minutes = input.minutes ?? (pomodoro ? 25 : null);
        const breakMinutes = input.breakMinutes ?? 5;
        const cycles = input.cycles ?? 4;
        const breakEvery = input.breakEveryMinutes ?? null;
        if (!input.userId || !['focus', 'gaming'].includes(input.kind) || (pomodoro && (input.kind !== 'focus' || breakEvery !== null))
            || (minutes !== null && (!Number.isInteger(minutes) || minutes < 1 || minutes > 1440))
            || !Number.isInteger(breakMinutes) || breakMinutes < 1 || breakMinutes > 60
            || !Number.isInteger(cycles) || cycles < 1 || cycles > 12
            || (breakEvery !== null && (!Number.isInteger(breakEvery) || breakEvery < 1 || breakEvery > 1440))) throw new PersonalError('invalid');
        for (const message of Object.values(input.messages)) requirePersonalText(message, 1_800);
        try {
            return await serializedTransaction(UserSession.sequelize!, async transaction => {
                await this.prune(input.userId, transaction);
                const existing = await UserSession.findOne({ where: { activeKey: input.userId }, transaction, lock: transaction.LOCK.UPDATE });
                if (existing) {
                    await this.reconcile(existing, transaction);
                    if (existing.activeKey) throw new PersonalError('exists');
                }
                const now = this.now();
                const session = await UserSession.create({
                    id: randomUUID(), userId: input.userId, title, kind: input.kind, state: 'running', activeKey: input.userId,
                    startedAt: now, runningSince: now, endedAt: null, workMs: 0, breakElapsedMs: 0, phaseElapsedMs: 0,
                    durationMs: minutes === null ? null : minutes * 60_000, pomodoro, phase: 'focus', breakMs: breakMinutes * 60_000,
                    cycles: pomodoro ? cycles : 1, cycleIndex: 1, breakEveryMs: breakEvery === null ? null : breakEvery * 60_000,
                    nextBreakMs: breakEvery === null ? null : breakEvery * 60_000, reminderId: null, messagesJson: JSON.stringify(input.messages), version: 0,
                }, { transaction });
                await this.schedule(session, transaction);
                return this.board(session);
            });
        } catch (error) {
            if (error instanceof UniqueConstraintError) throw new PersonalError('exists');
            throw error;
        }
    }

    async getActive(userId: string): Promise<UserSessionBoard | null> {
        return serializedTransaction(UserSession.sequelize!, async transaction => {
            const row = await UserSession.findOne({ where: { activeKey: userId }, transaction, lock: transaction.LOCK.UPDATE });
            if (!row) return null;
            await this.reconcile(row, transaction);
            return this.board(row);
        });
    }

    async get(id: string, userId: string): Promise<UserSessionBoard | null> {
        return serializedTransaction(UserSession.sequelize!, async transaction => {
            const row = await UserSession.findOne({ where: { id, userId }, transaction, lock: transaction.LOCK.UPDATE });
            if (!row) return null;
            await this.reconcile(row, transaction);
            return this.board(row);
        });
    }

    async transition(id: string, userId: string, version: number, action: 'pause' | 'resume' | 'stop'): Promise<UserSessionBoard> {
        return serializedTransaction(UserSession.sequelize!, async transaction => {
            const row = await UserSession.findOne({ where: { id, userId }, transaction, lock: transaction.LOCK.UPDATE });
            if (!row) throw new PersonalError('missing');
            if (row.version !== version || (action === 'resume' ? row.state !== 'paused' : !['running', 'paused'].includes(row.state))
                || (action === 'pause' && row.state !== 'running')) throw new PersonalError('stale');
            await this.reconcile(row, transaction);
            if (row.state === 'finished') return this.board(row);
            await this.clearReminders(row, [], transaction);
            const now = this.now();
            await row.update({
                state: action === 'pause' ? 'paused' : action === 'resume' ? 'running' : 'stopped',
                runningSince: action === 'resume' ? now : null, endedAt: action === 'stop' ? now : null,
                activeKey: action === 'stop' ? null : userId, reminderId: null, version: row.version + 1,
            }, { transaction });
            if (action === 'resume') await this.schedule(row, transaction);
            return this.board(row);
        });
    }

    async stats(userId: string): Promise<{ focusMs: number; gamingMs: number; breakMs: number; sessions: number }> {
        await this.getActive(userId);
        return serializedTransaction(UserSession.sequelize!, async transaction => {
            await this.prune(userId, transaction);
            const rows = await UserSession.findAll({ where: { userId }, transaction });
            return rows.reduce((total, row) => ({
                focusMs: total.focusMs + (row.kind === 'focus' ? Number(row.workMs) : 0),
                gamingMs: total.gamingMs + (row.kind === 'gaming' ? Number(row.workMs) : 0),
                breakMs: total.breakMs + Number(row.breakElapsedMs), sessions: total.sessions + 1,
            }), { focusMs: 0, gamingMs: 0, breakMs: 0, sessions: 0 });
        });
    }

    async prepareNotification(reminderId: string, userId: string): Promise<string | null> {
        const [, id] = reminderId.split(':');
        if (!id) return null;
        return serializedTransaction(UserSession.sequelize!, async transaction => {
            const row = await UserSession.findOne({ where: { id, userId }, transaction, lock: transaction.LOCK.UPDATE });
            const reminder = await ReminderConfig.findOne({ where: { id: reminderId, userId }, transaction });
            if (!row || !reminder || row.state === 'paused' || row.state === 'stopped') return null;
            await this.reconcile(row, transaction);
            const messages = this.messages(row);
            return row.state === 'finished' ? messages.finished : row.pomodoro ? row.phase === 'break' ? messages.break : messages.focus : messages.takeBreak;
        });
    }

    private async reconcile(row: UserSession, transaction: Transaction): Promise<void> {
        if (row.state !== 'running' || row.runningSince === null) return;
        const previousReminder = row.reminderId;
        const prior = `${row.state}:${row.phase}:${row.cycleIndex}:${row.nextBreakMs}`;
        const now = this.now();
        let delta = Math.max(0, now - Number(row.runningSince));
        let cursor = Number(row.runningSince);
        let work = Number(row.workMs);
        let breaks = Number(row.breakElapsedMs);
        let phaseElapsed = Number(row.phaseElapsedMs);
        let phase = row.phase;
        let cycle = row.cycleIndex;
        let state: UserSession['state'] = row.state;
        let endedAt: number | null = null;
        while (delta > 0 && state === 'running') {
            const length = phase === 'break' ? Number(row.breakMs) : row.durationMs === null ? Infinity : Number(row.durationMs);
            const step = Math.min(delta, Math.max(0, length - phaseElapsed));
            if (phase === 'break') breaks += step;
            else work += step;
            delta -= step;
            cursor += step;
            phaseElapsed += step;
            if (phaseElapsed < length) break;
            if (row.pomodoro && phase === 'focus' && cycle < row.cycles) phase = 'break';
            else if (row.pomodoro && phase === 'break') { phase = 'focus'; cycle += 1; }
            else { state = 'finished'; endedAt = cursor; break; }
            phaseElapsed = 0;
        }
        let nextBreak = row.nextBreakMs === null ? null : Number(row.nextBreakMs);
        if (row.breakEveryMs !== null && nextBreak !== null && work >= nextBreak) {
            nextBreak += (Math.floor((work - nextBreak) / Number(row.breakEveryMs)) + 1) * Number(row.breakEveryMs);
        }
        const changed = prior !== `${state}:${phase}:${cycle}:${nextBreak}`;
        await row.update({
            workMs: work, breakElapsedMs: breaks, phaseElapsedMs: phaseElapsed, phase, cycleIndex: cycle, nextBreakMs: nextBreak,
            state, endedAt, runningSince: state === 'running' ? Math.max(now, Number(row.runningSince)) : null, activeKey: state === 'running' ? row.userId : null,
            version: row.version + (changed ? 1 : 0),
        }, { transaction });
        if (changed) {
            await this.schedule(row, transaction);
            await this.clearReminders(row, [previousReminder, row.reminderId].filter((id): id is string => id !== null), transaction);
        }
    }

    private async schedule(row: UserSession, transaction: Transaction): Promise<void> {
        if (row.state !== 'running') {
            await row.update({ reminderId: null }, { transaction });
            return;
        }
        const phaseLength = row.phase === 'break' ? Number(row.breakMs) : row.durationMs === null ? null : Number(row.durationMs);
        const phaseRemaining = phaseLength === null ? Infinity : Math.max(0, phaseLength - Number(row.phaseElapsedMs));
        const breakRemaining = !row.pomodoro && row.nextBreakMs !== null ? Math.max(0, Number(row.nextBreakMs) - Number(row.workMs)) : Infinity;
        const delay = Math.min(phaseRemaining, breakRemaining);
        if (!Number.isFinite(delay)) return;
        const messages = this.messages(row);
        const message = row.pomodoro
            ? row.phase === 'break' ? messages.focus : row.cycleIndex < row.cycles ? messages.break : messages.finished
            : breakRemaining < phaseRemaining ? messages.takeBreak : messages.finished;
        const reminderId = `session:${row.id}:${row.version}`;
        await createOwnedReminder(reminderId, row.userId, message, this.now() + delay, this.now(), transaction);
        await row.update({ reminderId }, { transaction });
    }

    private async clearReminders(row: UserSession, keep: string[], transaction: Transaction): Promise<void> {
        const reminders = await ReminderConfig.findAll({ where: { userId: row.userId, id: { [Op.like]: `session:${row.id}:%`, ...(keep.length ? { [Op.notIn]: keep } : {}) } }, transaction });
        for (const reminder of reminders) await removeOwnedReminder(reminder.id, row.userId, transaction);
    }

    private async prune(userId: string, transaction: Transaction): Promise<void> {
        await UserSession.destroy({ where: { userId, endedAt: { [Op.lt]: this.now() - 90 * 86_400_000 } }, transaction });
        const old = await UserSession.findAll({ where: { userId, endedAt: { [Op.ne]: null } }, order: [['endedAt', 'DESC']], offset: 1_000, transaction });
        if (old.length) await UserSession.destroy({ where: { userId, id: { [Op.in]: old.map(row => row.id) } }, transaction });
    }

    private messages(row: UserSession): UserSessionMessages {
        const messages: unknown = JSON.parse(row.messagesJson);
        if (!messages || typeof messages !== 'object' || !['focus', 'break', 'finished', 'takeBreak'].every(key => typeof (messages as Record<string, unknown>)[key] === 'string')) {
            throw new Error('Invalid persisted session messages');
        }
        return messages as UserSessionMessages;
    }

    private board(row: UserSession): UserSessionBoard {
        const phaseLength = row.phase === 'break' ? Number(row.breakMs) : row.durationMs === null ? null : Number(row.durationMs);
        return {
            id: row.id, userId: row.userId, title: row.title, kind: row.kind, state: row.state, phase: row.phase, pomodoro: row.pomodoro,
            cycleIndex: row.cycleIndex, cycles: row.cycles, workMs: Number(row.workMs), breakElapsedMs: Number(row.breakElapsedMs), phaseElapsedMs: Number(row.phaseElapsedMs),
            remainingMs: phaseLength === null ? null : Math.max(0, phaseLength - Number(row.phaseElapsedMs)), startedAt: Number(row.startedAt),
            endedAt: row.endedAt === null ? null : Number(row.endedAt), reminderId: row.reminderId, version: row.version,
        };
    }
}
