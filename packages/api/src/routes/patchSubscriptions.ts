import { z } from 'zod';
import { getConfigManager } from '@zeffuro/fakegaming-common/managers';
import { validateParams, validateBody } from '@zeffuro/fakegaming-common';
import { createBaseRouter } from '../utils/createBaseRouter.js';
import { jwtAuth } from '../middleware/auth.js';

// Zod schemas
const idParamSchema = z.object({ id: z.coerce.number().int() });
const patchSubscriptionBodySchema = z.object({
    game: z.string().min(1),
    channelId: z.string().min(1),
    guildId: z.string().min(1),
});

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
router.get('/', async (_req, res) => {
    const subscriptions = await getConfigManager().patchSubscriptionManager.getAllPlain();
    res.json(subscriptions);
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
 *             $ref: '#/components/schemas/PatchSubscriptionConfig'
 *     responses:
 *       201:
 *         description: Created
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.post('/', jwtAuth, validateBody(patchSubscriptionBodySchema), async (req, res) => {
    await getConfigManager().patchSubscriptionManager.addPlain(req.body);
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
 *             $ref: '#/components/schemas/PatchSubscriptionConfig'
 *     responses:
 *       200:
 *         description: Success
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.put('/', jwtAuth, validateBody(patchSubscriptionBodySchema), async (req, res) => {
    await getConfigManager().patchSubscriptionManager.upsertSubscription(req.body);
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
    await getConfigManager().patchSubscriptionManager.removeByPk(numericId);
    res.json({ success: true });
});

export { router };
