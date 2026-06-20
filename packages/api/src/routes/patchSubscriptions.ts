import { z } from 'zod';
import { getConfigManager } from '@zeffuro/fakegaming-common/managers';
import { validateParams, validateBody, validateQuery } from '@zeffuro/fakegaming-common';
import { patchSubscriptionRequestSchema } from '@zeffuro/fakegaming-common/api';
import { createBaseRouter } from '../utils/createBaseRouter.js';
import { jwtAuth } from '../middleware/auth.js';
import { requireGuildAdmin } from '../utils/authHelpers.js';
import { recordAuditEvent } from '../utils/audit.js';
import {
    deleteGuildScopedRecord,
    sendGuildScopedRecordById,
    sendGuildScopedRecords,
} from '../utils/guildScopedRouteHelpers.js';

// Zod schemas
const idParamSchema = z.object({ id: z.coerce.number().int() });
const listQuerySchema = z.object({ guildId: z.string().min(1).optional() });

// Router
const router = createBaseRouter();

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
    const subscriptions = await getConfigManager().patchSubscriptionManager.getAllPlain();
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
        },
    });
    res.json({ success: true });
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
