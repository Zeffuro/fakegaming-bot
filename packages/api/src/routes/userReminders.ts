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
} from '@zeffuro/fakegaming-common/api';
import { parseTimespan } from '@zeffuro/fakegaming-common/utils';
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
    return {
        ...reminder,
        timestamp: toNumber(reminder.timestamp),
        completed: toBoolean(reminder.completed),
        createdAt: toIsoString(reminder.createdAt),
        updatedAt: toIsoString(reminder.updatedAt),
    };
}

function toNumber(value: number | string): number {
    return typeof value === 'number' ? value : Number(value);
}

function toBoolean(value: unknown): boolean {
    return value === true || value === 1 || value === '1';
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

    const reminder = await getConfigManager().reminderManager.createForUser({
        id: randomUUID(),
        userId,
        message: body.message,
        timespan: body.timespan,
        timestamp,
    });
    await recordAuditEvent(req, {
        action: 'userReminder.create',
        targetType: 'reminder',
        targetId: reminder.id,
        metadata: { dueAt: timestamp },
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
