import { z } from 'zod';
import { getConfigManager, validateBody, validateParams, validateQuery } from '@zeffuro/fakegaming-common';
import { pausedStateRequestSchema, steamNewsSubscriptionRequestSchema } from '@zeffuro/fakegaming-common/api';
import { createBaseRouter } from '../utils/createBaseRouter.js';
import { jwtAuth } from '../middleware/auth.js';
import { checkUserGuildAccess, requireGuildAdmin } from '../utils/authHelpers.js';
import { recordAuditEvent } from '../utils/audit.js';
import {
    deleteGuildScopedRecord,
    loadGuildScopedRecords,
    sendGuildScopedRecordById,
    sendGuildScopedRecords,
    sendNotFound,
} from '../utils/guildScopedRouteHelpers.js';

const router = createBaseRouter();

const idParamSchema = z.object({ id: z.coerce.number().int().positive() });
const listQuerySchema = z.object({ guildId: z.string().min(1).optional() });

interface SteamNewsSubscriptionRecord {
    id?: number | string;
    steamAppId: number;
    appName?: string | null;
    discordChannelId: string;
    guildId: string;
    paused?: boolean | number | null;
}

function normalizeSteamNewsSubscription<T extends SteamNewsSubscriptionRecord>(subscription: T): T & { paused: boolean } {
    return {
        ...subscription,
        paused: Boolean(subscription.paused),
    };
}

async function recordSteamNewsPausedStatus(subscription: SteamNewsSubscriptionRecord, paused: boolean): Promise<void> {
    const manager = getConfigManager().integrationHealthManager;
    try {
        await manager.recordStatus({
            provider: 'steamnews',
            configId: subscription.id ?? `${subscription.steamAppId}:${subscription.discordChannelId}`,
            guildId: subscription.guildId,
            channelId: subscription.discordChannelId,
            status: paused ? 'paused' : 'unknown',
            metadata: {
                steamAppId: subscription.steamAppId,
                appName: subscription.appName ?? null,
                paused,
            },
        });
    } catch {
        // Health status should not block a successful configuration update.
    }
}

/**
 * @openapi
 * /steamNewsSubscriptions:
 *   get:
 *     summary: List Steam news subscriptions
 *     tags: [SteamNewsSubscriptions]
 *     parameters:
 *       - in: query
 *         name: guildId
 *         required: false
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of Steam news subscriptions
 */
router.get('/', validateQuery(listQuerySchema), async (req, res) => {
    const { guildId } = req.query as z.infer<typeof listQuerySchema>;
    const subscriptions = (await loadGuildScopedRecords(getConfigManager().steamNewsSubscriptionManager, guildId) as unknown as SteamNewsSubscriptionRecord[])
        .map(normalizeSteamNewsSubscription);
    await sendGuildScopedRecords(req, res, subscriptions, guildId);
});

/**
 * @openapi
 * /steamNewsSubscriptions/{id}:
 *   get:
 *     summary: Get a Steam news subscription by id
 *     tags: [SteamNewsSubscriptions]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Steam news subscription config
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get('/:id', validateParams(idParamSchema), async (req, res) => {
    const manager = getConfigManager().steamNewsSubscriptionManager;
    await sendGuildScopedRecordById(req, res, Number(req.params.id), {
        findByPk: async id => {
            const record = await manager.findByPkPlain(id) as unknown as SteamNewsSubscriptionRecord | null;
            return record ? normalizeSteamNewsSubscription(record) : null;
        },
        notFoundMessage: 'Steam news subscription not found',
    });
});

/**
 * @openapi
 * /steamNewsSubscriptions:
 *   post:
 *     summary: Add a Steam news subscription
 *     tags: [SteamNewsSubscriptions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SteamNewsSubscriptionRequest'
 *     responses:
 *       201:
 *         description: Created
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.post('/', jwtAuth, validateBody(steamNewsSubscriptionRequestSchema), requireGuildAdmin, async (req, res) => {
    const created = await getConfigManager().steamNewsSubscriptionManager.addPlain(req.body);
    await recordAuditEvent(req, {
        action: 'steamNewsSubscription.create',
        targetType: 'steamNewsSubscription',
        targetId: created.id,
        guildId: created.guildId ?? null,
        metadata: {
            steamAppId: created.steamAppId,
            appName: created.appName ?? null,
            channelId: created.discordChannelId,
            paused: Boolean(created.paused),
        },
    });
    res.status(201).json(normalizeSteamNewsSubscription(created as unknown as SteamNewsSubscriptionRecord));
});

/**
 * @openapi
 * /steamNewsSubscriptions:
 *   put:
 *     summary: Upsert a Steam news subscription
 *     tags: [SteamNewsSubscriptions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SteamNewsSubscriptionRequest'
 *     responses:
 *       200:
 *         description: Success
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.put('/', jwtAuth, validateBody(steamNewsSubscriptionRequestSchema), requireGuildAdmin, async (req, res) => {
    const body = req.body as z.infer<typeof steamNewsSubscriptionRequestSchema>;
    await getConfigManager().steamNewsSubscriptionManager.upsertSubscription(body);
    await recordAuditEvent(req, {
        action: 'steamNewsSubscription.upsert',
        targetType: 'steamNewsSubscription',
        targetId: `${body.steamAppId}:${body.discordChannelId}`,
        guildId: body.guildId,
        metadata: {
            steamAppId: body.steamAppId,
            appName: body.appName ?? null,
            channelId: body.discordChannelId,
            paused: Boolean(body.paused),
        },
    });
    res.json({ success: true });
});

/**
 * @openapi
 * /steamNewsSubscriptions/{id}:
 *   patch:
 *     summary: Pause or resume a Steam news subscription
 *     tags: [SteamNewsSubscriptions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PausedStateRequest'
 *     responses:
 *       200:
 *         description: Updated Steam news subscription config
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.patch('/:id', jwtAuth, validateParams(idParamSchema), validateBody(pausedStateRequestSchema), async (req, res) => {
    const id = Number(req.params.id);
    const body = req.body as z.infer<typeof pausedStateRequestSchema>;
    const manager = getConfigManager().steamNewsSubscriptionManager;
    const subscription = await manager.findByPkPlain(id) as unknown as SteamNewsSubscriptionRecord | null;
    if (!subscription) {
        sendNotFound(res, 'Steam news subscription not found');
        return;
    }

    const access = await checkUserGuildAccess(req, res, subscription.guildId);
    if (!access.authorized) return;

    await manager.setPaused(id, body.paused);
    const updated = await manager.findByPkPlain(id) as unknown as SteamNewsSubscriptionRecord | null;
    if (!updated) {
        sendNotFound(res, 'Steam news subscription not found');
        return;
    }

    await recordSteamNewsPausedStatus(updated, body.paused);
    await recordAuditEvent(req, {
        action: body.paused ? 'steamNewsSubscription.pause' : 'steamNewsSubscription.resume',
        targetType: 'steamNewsSubscription',
        targetId: id,
        guildId: updated.guildId,
        metadata: {
            steamAppId: updated.steamAppId,
            appName: updated.appName ?? null,
            channelId: updated.discordChannelId,
            paused: body.paused,
        },
    });
    res.json({ ...updated, paused: Boolean(updated.paused) });
});

/**
 * @openapi
 * /steamNewsSubscriptions/{id}:
 *   delete:
 *     summary: Delete a Steam news subscription by id
 *     tags: [SteamNewsSubscriptions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Success
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.delete('/:id', jwtAuth, validateParams(idParamSchema), async (req, res) => {
    const manager = getConfigManager().steamNewsSubscriptionManager;
    await deleteGuildScopedRecord(req, res, Number(req.params.id), {
        findByPk: id => manager.findByPkPlain(id),
        removeByPk: id => manager.removeByPk(id),
        notFoundMessage: 'Steam news subscription not found',
        auditAction: 'steamNewsSubscription.delete',
        auditTargetType: 'steamNewsSubscription',
        auditMetadata: subscription => ({
            steamAppId: subscription.steamAppId,
            appName: subscription.appName ?? null,
            channelId: subscription.discordChannelId,
        }),
    });
});

export { router };
