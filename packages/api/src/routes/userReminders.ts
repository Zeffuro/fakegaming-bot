import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import {
    getConfigManager,
    validateBody,
    validateParams,
} from '@zeffuro/fakegaming-common';
import {
    userReminderCreateRequestSchema,
    userReminderSnoozeRequestSchema,
    pausedStateRequestSchema,
} from '@zeffuro/fakegaming-common/api';
import {
    getNextRecurringReminderTimestamp,
    parseReminderRecurrence,
    parseTimespan,
    type ReminderRecurrenceRule,
    type ReminderRecurrenceUnit,
} from '@zeffuro/fakegaming-common/utils';
import { createBaseRouter } from '../utils/createBaseRouter.js';
import { recordAuditEvent } from '../utils/audit.js';
import type { AuthenticatedRequest } from '../types/express.js';

const router = createBaseRouter();

const reminderIdParamSchema = z.object({
    id: z.string().trim().min(1).max(255),
}).strict();

interface ReminderRecord {
    id: string;
    userId: string;
    message: string;
    timespan: string;
    timestamp: number | string;
    completed?: boolean | number | string | null;
    recurrenceUnit?: string | null;
    recurrenceInterval?: number | string | null;
    recurrenceTimezone?: string | null;
    lastTriggeredAt?: number | string | null;
    createdAt?: unknown;
    updatedAt?: unknown;
}

function getAuthenticatedDiscordId(req: AuthenticatedRequest): string {
    return req.user.discordId;
}

function getDueTimestamp(timespan: string): number | null {
    const delayMs = parseTimespan(timespan);
    if (delayMs === null || delayMs <= 0) return null;
    const timestamp = Date.now() + delayMs;
    return Number.isSafeInteger(timestamp) ? timestamp : null;
}

function serializeReminder(reminder: ReminderRecord) {
    const recurrenceRule = getReminderRecurrenceRule(reminder);
    const timestamp = toNumber(reminder.timestamp);
    const paused = toBoolean(reminder.completed);
    const nextPreviewAt = recurrenceRule && paused && timestamp <= Date.now()
        ? getNextRecurringReminderTimestamp({
            rule: recurrenceRule,
            previousTimestamp: timestamp,
            afterTimestamp: Date.now(),
        })
        : timestamp;

    return {
        ...reminder,
        timestamp,
        completed: paused,
        recurrenceUnit: reminder.recurrenceUnit ?? null,
        recurrenceInterval: toNullableNumber(reminder.recurrenceInterval),
        recurrenceTimezone: reminder.recurrenceTimezone ?? null,
        lastTriggeredAt: toNullableNumber(reminder.lastTriggeredAt),
        nextPreviewAt,
        createdAt: toIsoString(reminder.createdAt),
        updatedAt: toIsoString(reminder.updatedAt),
    };
}

function toNumber(value: number | string): number {
    return typeof value === 'number' ? value : Number(value);
}

function toNullableNumber(value: number | string | null | undefined): number | null {
    if (value === null || value === undefined) return null;
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function toBoolean(value: unknown): boolean {
    return value === true || value === 1 || value === '1';
}

function isReminderPaused(reminder: ReminderRecord): boolean {
    return toBoolean(reminder.completed);
}

function getReminderRecurrenceRule(reminder: ReminderRecord): ReminderRecurrenceRule | null {
    const unit = normalizeRecurrenceUnit(reminder.recurrenceUnit);
    const interval = toNullableNumber(reminder.recurrenceInterval);
    const timezone = reminder.recurrenceTimezone?.trim();
    if (!unit || !interval || !timezone) return null;

    return { unit, interval, timezone };
}

function normalizeRecurrenceUnit(value: string | null | undefined): ReminderRecurrenceUnit | null {
    if (value === 'day' || value === 'week' || value === 'month') return value;
    return null;
}

function getResumeTimestamp(reminder: ReminderRecord, rule: ReminderRecurrenceRule): number | undefined {
    const timestamp = toNumber(reminder.timestamp);
    const now = Date.now();
    if (timestamp > now) return undefined;

    return getNextRecurringReminderTimestamp({
        rule,
        previousTimestamp: timestamp,
        afterTimestamp: now,
    }) ?? undefined;
}

function toIsoString(value: unknown): string | null {
    if (!value) return null;
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'string' || typeof value === 'number') {
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toISOString();
    }
    return null;
}

/**
 * @openapi
 * /userReminders:
 *   get:
 *     summary: List reminders for the authenticated dashboard user
 *     tags: [UserReminders]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Personal reminders
 */
router.get('/', async (req, res) => {
    const userId = getAuthenticatedDiscordId(req as AuthenticatedRequest);
    const reminders = await getConfigManager().reminderManager.listForUser(userId) as unknown as ReminderRecord[];
    res.json({ reminders: reminders.map(serializeReminder) });
});

/**
 * @openapi
 * /userReminders:
 *   post:
 *     summary: Create a reminder for the authenticated dashboard user
 *     tags: [UserReminders]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UserReminderCreateRequest'
 *     responses:
 *       201:
 *         description: Created reminder
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 */
router.post('/', validateBody(userReminderCreateRequestSchema), async (req, res) => {
    const userId = getAuthenticatedDiscordId(req as AuthenticatedRequest);
    const body = req.body as z.infer<typeof userReminderCreateRequestSchema>;
    const timestamp = getDueTimestamp(body.timespan);
    if (timestamp === null) {
        res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Invalid timespan. Use values like 10m, 1h, or 2d.' } });
        return;
    }
    const recurrence = body.recurrence
        ? parseReminderRecurrence(body.recurrence, body.recurrenceTimezone ?? '')
        : null;
    if (body.recurrence && !recurrence) {
        res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Invalid recurrence. Use values like daily, weekly, monthly, every 2 weeks, or 3mo with a valid timezone.' } });
        return;
    }

    const reminder = await getConfigManager().reminderManager.createForUser({
        id: randomUUID(),
        userId,
        message: body.message,
        timespan: body.timespan,
        timestamp,
        recurrenceUnit: recurrence?.unit ?? null,
        recurrenceInterval: recurrence?.interval ?? null,
        recurrenceTimezone: recurrence?.timezone ?? null,
    });
    await recordAuditEvent(req, {
        action: 'userReminder.create',
        targetType: 'reminder',
        targetId: reminder.id,
        metadata: {
            dueAt: timestamp,
            recurrence: recurrence ? {
                unit: recurrence.unit,
                interval: recurrence.interval,
                timezone: recurrence.timezone,
            } : null,
        },
    });
    res.status(201).json(serializeReminder(reminder as unknown as ReminderRecord));
});

/**
 * @openapi
 * /userReminders/{id}:
 *   get:
 *     summary: Get one reminder for the authenticated dashboard user
 *     tags: [UserReminders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Personal reminder
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get('/:id', validateParams(reminderIdParamSchema), async (req, res) => {
    const userId = getAuthenticatedDiscordId(req as AuthenticatedRequest);
    const { id } = req.params as z.infer<typeof reminderIdParamSchema>;
    const reminder = await getConfigManager().reminderManager.getForUser(id, userId) as unknown as ReminderRecord | null;
    if (!reminder) {
        res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Reminder not found' } });
        return;
    }
    res.json(serializeReminder(reminder));
});

/**
 * @openapi
 * /userReminders/{id}/snooze:
 *   patch:
 *     summary: Snooze one reminder for the authenticated dashboard user
 *     tags: [UserReminders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UserReminderSnoozeRequest'
 *     responses:
 *       200:
 *         description: Snoozed reminder
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.patch('/:id/snooze', validateParams(reminderIdParamSchema), validateBody(userReminderSnoozeRequestSchema), async (req, res) => {
    const userId = getAuthenticatedDiscordId(req as AuthenticatedRequest);
    const { id } = req.params as z.infer<typeof reminderIdParamSchema>;
    const body = req.body as z.infer<typeof userReminderSnoozeRequestSchema>;
    const timestamp = getDueTimestamp(body.timespan);
    if (timestamp === null) {
        res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Invalid timespan. Use values like 10m, 1h, or 2d.' } });
        return;
    }

    const reminder = await getConfigManager().reminderManager.snoozeForUser(id, userId, {
        timespan: body.timespan,
        timestamp,
    }) as unknown as ReminderRecord | null;
    if (!reminder) {
        res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Reminder not found' } });
        return;
    }

    await recordAuditEvent(req, {
        action: 'userReminder.snooze',
        targetType: 'reminder',
        targetId: id,
        metadata: { dueAt: timestamp },
    });
    res.json(serializeReminder(reminder));
});

/**
 * @openapi
 * /userReminders/{id}/paused:
 *   patch:
 *     summary: Pause or resume one recurring reminder for the authenticated dashboard user
 *     tags: [UserReminders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PausedStateRequest'
 *     responses:
 *       200:
 *         description: Updated reminder
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.patch('/:id/paused', validateParams(reminderIdParamSchema), validateBody(pausedStateRequestSchema), async (req, res) => {
    const userId = getAuthenticatedDiscordId(req as AuthenticatedRequest);
    const { id } = req.params as z.infer<typeof reminderIdParamSchema>;
    const body = req.body as z.infer<typeof pausedStateRequestSchema>;
    const existing = await getConfigManager().reminderManager.getForUser(id, userId) as unknown as ReminderRecord | null;
    if (!existing) {
        res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Reminder not found' } });
        return;
    }

    const recurrenceRule = getReminderRecurrenceRule(existing);
    if (!recurrenceRule) {
        res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Only recurring reminders can be paused.' } });
        return;
    }

    const nextTimestamp = body.paused ? undefined : getResumeTimestamp(existing, recurrenceRule);
    const reminder = await getConfigManager().reminderManager.setPausedForUser(id, userId, {
        paused: body.paused,
        timestamp: nextTimestamp,
    }) as unknown as ReminderRecord | null;

    await recordAuditEvent(req, {
        action: body.paused ? 'userReminder.pause' : 'userReminder.resume',
        targetType: 'reminder',
        targetId: id,
        metadata: {
            paused: body.paused,
            wasPaused: isReminderPaused(existing),
            nextRunAt: nextTimestamp ?? toNumber(existing.timestamp),
        },
    });
    res.json(serializeReminder(reminder ?? existing));
});

/**
 * @openapi
 * /userReminders/{id}:
 *   delete:
 *     summary: Delete one reminder for the authenticated dashboard user
 *     tags: [UserReminders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Deleted
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.delete('/:id', validateParams(reminderIdParamSchema), async (req, res) => {
    const userId = getAuthenticatedDiscordId(req as AuthenticatedRequest);
    const { id } = req.params as z.infer<typeof reminderIdParamSchema>;
    const deleted = await getConfigManager().reminderManager.removeForUser(id, userId);
    if (!deleted) {
        res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Reminder not found' } });
        return;
    }

    await recordAuditEvent(req, {
        action: 'userReminder.delete',
        targetType: 'reminder',
        targetId: id,
    });
    res.json({ success: true });
});

export { router };
