import { z } from 'zod';
import {
    computeNextDigestRunAt,
    getConfigManager,
    parseDigestCategories,
    validateBody,
} from '@zeffuro/fakegaming-common';
import {
    userDigestSubscriptionPausedRequestSchema,
    userDigestSubscriptionRequestSchema,
} from '@zeffuro/fakegaming-common/api';
import type { UserDigestSubscriptionRecord } from '@zeffuro/fakegaming-common/managers';
import { createBaseRouter } from '../utils/createBaseRouter.js';
import { recordAuditEvent } from '../utils/audit.js';
import type { AuthenticatedRequest } from '../types/express.js';

const router = createBaseRouter();

function getAuthenticatedDiscordId(req: AuthenticatedRequest): string {
    return req.user.discordId;
}

function serializeSubscription(subscription: UserDigestSubscriptionRecord | null) {
    if (!subscription) return null;

    return {
        ...subscription,
        paused: toBoolean((subscription as { paused?: unknown }).paused),
        dayOfWeek: toNullableNumber((subscription as { dayOfWeek?: unknown }).dayOfWeek),
        nextRunAt: toNumber(subscription.nextRunAt),
        lastRunAt: toNullableNumber((subscription as { lastRunAt?: unknown }).lastRunAt),
        lastSentAt: toNullableNumber((subscription as { lastSentAt?: unknown }).lastSentAt),
        categories: parseDigestCategories((subscription as { categories?: unknown }).categories),
        createdAt: toIsoString((subscription as { createdAt?: unknown }).createdAt),
        updatedAt: toIsoString((subscription as { updatedAt?: unknown }).updatedAt),
    };
}

function toBoolean(value: unknown): boolean {
    return value === true || value === 1 || value === '1';
}

function toNumber(value: unknown): number {
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

function toNullableNumber(value: unknown): number | null {
    if (value === null || value === undefined) return null;
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : null;
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
 * /userDigestSubscription:
 *   get:
 *     summary: Get the authenticated user's digest subscription
 *     tags: [UserDigestSubscription]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Personal digest subscription
 */
router.get('/', async (req, res) => {
    const discordId = getAuthenticatedDiscordId(req as AuthenticatedRequest);
    const subscription = await getConfigManager().userDigestSubscriptionManager.getForUser(discordId);
    res.json({ subscription: serializeSubscription(subscription) });
});

/**
 * @openapi
 * /userDigestSubscription:
 *   put:
 *     summary: Create or update the authenticated user's digest subscription
 *     tags: [UserDigestSubscription]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UserDigestSubscriptionRequest'
 *     responses:
 *       200:
 *         description: Saved digest subscription
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 */
router.put('/', validateBody(userDigestSubscriptionRequestSchema), async (req, res) => {
    const discordId = getAuthenticatedDiscordId(req as AuthenticatedRequest);
    const body = req.body as z.infer<typeof userDigestSubscriptionRequestSchema>;
    const nextRunAt = computeNextDigestRunAt({
        frequency: body.frequency,
        timezone: body.timezone,
        runAt: body.runAt,
        dayOfWeek: body.dayOfWeek,
    });
    if (nextRunAt === null) {
        res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Invalid digest schedule or timezone.' } });
        return;
    }

    const subscription = await getConfigManager().userDigestSubscriptionManager.upsertForUser({
        discordId,
        frequency: body.frequency,
        timezone: body.timezone,
        runAt: body.runAt,
        dayOfWeek: body.dayOfWeek,
        categories: body.categories,
        paused: body.paused,
        nextRunAt,
    });
    await recordAuditEvent(req, {
        action: 'userDigestSubscription.upsert',
        targetType: 'userDigestSubscription',
        targetId: subscription.id,
        metadata: {
            frequency: body.frequency,
            timezone: body.timezone,
            runAt: body.runAt,
            paused: body.paused ?? false,
            nextRunAt,
        },
    });
    res.json({ subscription: serializeSubscription(subscription) });
});

/**
 * @openapi
 * /userDigestSubscription/paused:
 *   patch:
 *     summary: Pause or resume the authenticated user's digest subscription
 *     tags: [UserDigestSubscription]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UserDigestSubscriptionPausedRequest'
 *     responses:
 *       200:
 *         description: Updated digest subscription
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.patch('/paused', validateBody(userDigestSubscriptionPausedRequestSchema), async (req, res) => {
    const discordId = getAuthenticatedDiscordId(req as AuthenticatedRequest);
    const body = req.body as z.infer<typeof userDigestSubscriptionPausedRequestSchema>;
    const existing = await getConfigManager().userDigestSubscriptionManager.getForUser(discordId);
    if (!existing) {
        res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Digest subscription not found' } });
        return;
    }

    const nextRunAt = body.paused || toNumber(existing.nextRunAt) > Date.now()
        ? undefined
        : computeNextDigestRunAt({
            frequency: existing.frequency as 'daily' | 'weekly',
            timezone: existing.timezone,
            runAt: existing.runAt,
            dayOfWeek: toNullableNumber(existing.dayOfWeek),
        }) ?? undefined;

    const subscription = await getConfigManager().userDigestSubscriptionManager.updatePausedForUser(discordId, body.paused, nextRunAt);
    await recordAuditEvent(req, {
        action: body.paused ? 'userDigestSubscription.pause' : 'userDigestSubscription.resume',
        targetType: 'userDigestSubscription',
        targetId: existing.id,
        metadata: {
            paused: body.paused,
            nextRunAt: nextRunAt ?? toNumber(existing.nextRunAt),
        },
    });
    res.json({ subscription: serializeSubscription(subscription ?? existing) });
});

export { router };
