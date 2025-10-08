import { createBaseRouter } from '../utils/createBaseRouter.js';
import { getConfigManager } from '@zeffuro/fakegaming-common/managers';
import { jwtAuth } from '../middleware/auth.js';
import { validateBodyForModel, validateParams } from '@zeffuro/fakegaming-common';
import { PatchSubscriptionConfig } from '@zeffuro/fakegaming-common/models';
import { z } from 'zod';

const router = createBaseRouter();

// ✨ Single source of truth - params via zod; body via model lazily
const idParamSchema = z.object({ id: z.coerce.number() });

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
 *         description: Not found
 */
router.get('/:id', validateParams(idParamSchema), async (req, res) => {
    const { id } = req.params;
    const subscription = await getConfigManager().patchSubscriptionManager.findByPkPlain(Number(id));
    if (!subscription) return res.status(404).json({ error: 'Subscription not found' });
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
 */
router.post('/', jwtAuth, validateBodyForModel(PatchSubscriptionConfig, 'create'), async (req, res) => {
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
 */
router.put('/', jwtAuth, validateBodyForModel(PatchSubscriptionConfig, 'create'), async (req, res) => {
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
 */
router.delete('/:id', jwtAuth, validateParams(idParamSchema), async (req, res) => {
    const { id } = req.params;
    await getConfigManager().patchSubscriptionManager.removeByPk(Number(id));
    res.json({ success: true });
});

export { router };
