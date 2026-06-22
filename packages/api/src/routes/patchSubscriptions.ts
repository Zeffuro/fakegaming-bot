import { z } from 'zod';
import { getConfigManager } from '@zeffuro/fakegaming-common/managers';
import { validateParams, validateBody, validateQuery } from '@zeffuro/fakegaming-common';
import { patchSubscriptionRequestSchema, pausedStateRequestSchema } from '@zeffuro/fakegaming-common/api';
import { createBaseRouter } from '../utils/createBaseRouter.js';
import { jwtAuth } from '../middleware/auth.js';
import { checkUserGuildAccess, requireGuildAdmin } from '../utils/authHelpers.js';
import { recordAuditEvent } from '../utils/audit.js';
import {
    deleteGuildScopedRecord,
    loadGuildScopedRecords,
    sendGuildScopedRecordById,
    sendGuildScopedRecords,
} from '../utils/guildScopedRouteHelpers.js';

// Zod schemas
const idParamSchema = z.object({ id: z.coerce.number().int() });
const listQuerySchema = z.object({ guildId: z.string().min(1).optional() });

// Router
const router = createBaseRouter();

interface PatchSubscriptionRecord {
    id?: number | string;
    game: string;
    channelId: string;
    guildId: string;
}

async function recordPatchSubscriptionPausedStatus(subscription: PatchSubscriptionRecord, paused: boolean): Promise<void> {
    const manager = getConfigManager().integrationHealthManager;
    try {
        await manager.recordStatus({
            provider: 'patchnotes',
            configId: subscription.id ?? `${subscription.game}:${subscription.channelId}`,
            guildId: subscription.guildId,
            channelId: subscription.channelId,
            status: paused ? 'paused' : 'unknown',
            metadata: {
                game: subscription.game,
                paused,
            },
        });
    } catch {
        // Health status should not block a successful configuration update.
    }
}

/**
 * @openapi
 * /patchSubscriptions:
 *   get:
 *     summary: List all patch subscriptions
 *     tags: [PatchSubscriptions]
 *     responses:
 *       200:
 *         description: List of patch subscriptions
 */
router.get('/', validateQuery(listQuerySchema), async (req, res) => {
    const { guildId } = req.query as z.infer<typeof listQuerySchema>;
    const subscriptions = await loadGuildScopedRecords(getConfigManager().patchSubscriptionManager, guildId);
    await sendGuildScopedRecords(req, res, subscriptions, guildId);
});

/**
 * @openapi
 * /patchSubscriptions/{id}:
 *   get:
 *     summary: Get a patch subscription by id
 *     tags: [PatchSubscriptions]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Patch subscription config
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get('/:id', validateParams(idParamSchema), async (req, res) => {
    const manager = getConfigManager().patchSubscriptionManager;
    await sendGuildScopedRecordById(req, res, Number(req.params.id), {
        findByPk: id => manager.findByPkPlain(id),
        notFoundMessage: 'Subscription not found',
    });
});

/**
 * @openapi
 * /patchSubscriptions:
 *   post:
 *     summary: Add a new patch subscription
 *     tags: [PatchSubscriptions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PatchSubscriptionRequest'
 *     responses:
 *       201:
 *         description: Created
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.post('/', jwtAuth, validateBody(patchSubscriptionRequestSchema), requireGuildAdmin, async (req, res) => {
    const created = await getConfigManager().patchSubscriptionManager.addPlain(req.body);
    await recordAuditEvent(req, {
        action: 'patchSubscription.create',
        targetType: 'patchSubscription',
        targetId: created.id,
        guildId: created.guildId ?? null,
        metadata: {
            game: created.game,
            channelId: created.channelId,
            paused: Boolean(created.paused),
        },
    });
    res.status(201).json({ success: true });
});

/**
 * @openapi
 * /patchSubscriptions:
 *   put:
 *     summary: Upsert a patch subscription
 *     tags: [PatchSubscriptions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PatchSubscriptionRequest'
 *     responses:
 *       200:
 *         description: Success
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.put('/', jwtAuth, validateBody(patchSubscriptionRequestSchema), requireGuildAdmin, async (req, res) => {
    await getConfigManager().patchSubscriptionManager.upsertSubscription(req.body);
    await recordAuditEvent(req, {
        action: 'patchSubscription.upsert',
        targetType: 'patchSubscription',
        targetId: req.body.game,
        guildId: req.body.guildId,
        metadata: {
            game: req.body.game,
            channelId: req.body.channelId,
            paused: Boolean(req.body.paused),
        },
    });
    res.json({ success: true });
});

/**
 * @openapi
 * /patchSubscriptions/{id}:
 *   patch:
 *     summary: Pause or resume a patch subscription
 *     tags: [PatchSubscriptions]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PausedStateRequest'
 *     responses:
 *       200:
 *         description: Updated patch subscription config
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
    const manager = getConfigManager().patchSubscriptionManager;
    const subscription = await manager.findByPkPlain(id) as unknown as PatchSubscriptionRecord;
    const access = await checkUserGuildAccess(req, res, subscription.guildId);
    if (!access.authorized) return;

    await manager.setPaused(id, body.paused);
    const updated = await manager.findByPkPlain(id) as unknown as PatchSubscriptionRecord;
    await recordPatchSubscriptionPausedStatus(updated, body.paused);
    await recordAuditEvent(req, {
        action: body.paused ? 'patchSubscription.pause' : 'patchSubscription.resume',
        targetType: 'patchSubscription',
        targetId: id,
        guildId: updated.guildId,
        metadata: {
            game: updated.game,
            channelId: updated.channelId,
            paused: body.paused,
        },
    });
    res.json({ ...updated, paused: Boolean((updated as { paused?: unknown }).paused) });
});

/**
 * @openapi
 * /patchSubscriptions/{id}:
 *   delete:
 *     summary: Delete a patch subscription by id
 *     tags: [PatchSubscriptions]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.delete('/:id', jwtAuth, validateParams(idParamSchema), async (req, res) => {
    const manager = getConfigManager().patchSubscriptionManager;
    await deleteGuildScopedRecord(req, res, Number(req.params.id), {
        findByPk: id => manager.findByPkPlain(id),
        removeByPk: id => manager.removeByPk(id),
        notFoundMessage: 'Subscription not found',
        auditAction: 'patchSubscription.delete',
        auditTargetType: 'patchSubscription',
        auditMetadata: subscription => ({
            game: subscription.game,
            channelId: subscription.channelId,
        }),
    });
});

export { router };
