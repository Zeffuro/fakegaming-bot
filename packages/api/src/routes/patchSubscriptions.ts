import { z } from 'zod';
import { getConfigManager } from '@zeffuro/fakegaming-common/managers';
import { validateParams, validateBody, validateQuery } from '@zeffuro/fakegaming-common';
import { patchSubscriptionRequestSchema } from '@zeffuro/fakegaming-common/api';
import { createBaseRouter } from '../utils/createBaseRouter.js';
import { jwtAuth } from '../middleware/auth.js';
import { filterGuildScopedRecordsForRequest, requireGuildAdmin } from '../utils/authHelpers.js';
import { recordAuditEvent } from '../utils/audit.js';

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
    const visibleSubscriptions = await filterGuildScopedRecordsForRequest(req, res, subscriptions, guildId);
    if (!visibleSubscriptions) return;
    res.json(visibleSubscriptions);
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
    const { id } = req.params;
    const subscription = await getConfigManager().patchSubscriptionManager.findByPkPlain(Number(id));
    if (!subscription) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Subscription not found' } });
    const visibleSubscriptions = await filterGuildScopedRecordsForRequest(req, res, [subscription], subscription.guildId);
    if (!visibleSubscriptions) return;
    if (visibleSubscriptions.length === 0) return res.status(403).json({ error: 'Not authorized for this guild' });
    res.json(subscription);
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
    const { id } = req.params;
    const numericId = Number(id);
    const existing = await getConfigManager().patchSubscriptionManager.findByPkPlain(numericId);
    if (!existing) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Subscription not found' } });
    const visibleSubscriptions = await filterGuildScopedRecordsForRequest(req, res, [existing], existing.guildId);
    if (!visibleSubscriptions) return;
    if (visibleSubscriptions.length === 0) return res.status(403).json({ error: 'Not authorized for this guild' });
    await getConfigManager().patchSubscriptionManager.removeByPk(numericId);
    await recordAuditEvent(req, {
        action: 'patchSubscription.delete',
        targetType: 'patchSubscription',
        targetId: numericId,
        guildId: existing.guildId ?? null,
        metadata: {
            game: existing.game,
            channelId: existing.channelId,
        },
    });
    res.json({ success: true });
});

export { router };
