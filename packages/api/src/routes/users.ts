import { createBaseRouter } from '../utils/createBaseRouter.js';
import { getConfigManager } from '@zeffuro/fakegaming-common/managers';
import { jwtAuth } from '../middleware/auth.js';
import { validateBodyForModel, validateParams } from '@zeffuro/fakegaming-common';
import { UserConfig } from '@zeffuro/fakegaming-common/models';
import { z } from 'zod';

const router = createBaseRouter();

// ✨ Single source of truth - schema resolved lazily via model
const discordIdParamSchema = z.object({ discordId: z.string().min(1) });

/**
 * @openapi
 * /users:
 *   get:
 *     summary: List all users
 *     tags: [Users]
 *     responses:
 *       200:
 *         description: List of users
 */
router.get('/', async (_req, res) => {
    const users = await getConfigManager().userManager.getAllPlain();
    res.json(users);
});

/**
 * @openapi
 * /users/{discordId}:
 *   get:
 *     summary: Get a user by Discord ID
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: discordId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User config
 *       404:
 *         description: Not found
 */
router.get('/:discordId', validateParams(discordIdParamSchema), async (req, res) => {
    const { discordId } = req.params;
    const user = await getConfigManager().userManager.findByPkPlain(discordId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
});

/**
 * @openapi
 * /users:
 *   post:
 *     summary: Create a new user
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UserConfig'
 *     responses:
 *       201:
 *         description: Created
 */
router.post('/', jwtAuth, validateBodyForModel(UserConfig, 'create'), async (req, res) => {
    await getConfigManager().userManager.addPlain(req.body);
    res.status(201).json({ success: true });
});

/**
 * @openapi
 * /users/{discordId}:
 *   put:
 *     summary: Update a user by Discord ID
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: discordId
 *         required: true
 *         schema:
 *           type: string
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UserConfig'
 *     responses:
 *       200:
 *         description: Updated
 */
router.put('/:discordId', jwtAuth, validateParams(discordIdParamSchema), validateBodyForModel(UserConfig, 'update'), async (req, res) => {
    const { discordId } = req.params;
    const user = await getConfigManager().userManager.findByPkPlain(discordId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    await getConfigManager().userManager.updatePlain(req.body, { discordId });
    const updated = await getConfigManager().userManager.findByPkPlain(discordId);
    res.json(updated);
});

// Endpoint to set timezone
router.put('/:discordId/timezone', jwtAuth, validateParams(discordIdParamSchema), async (req, res) => {
    const { discordId } = req.params;
    const bodySchema = z.object({ timezone: z.string().min(1) });
    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid timezone' });

    const user = await getConfigManager().userManager.getOnePlain({ discordId });
    if (!user) return res.status(404).json({ error: 'User not found' });

    await getConfigManager().userManager.updatePlain({ timezone: parsed.data.timezone } as any, { discordId });
    res.json({ success: true });
});

// Endpoint to set default reminder timespan
router.put('/:discordId/defaultReminderTimeSpan', jwtAuth, validateParams(discordIdParamSchema), async (req, res) => {
    const { discordId } = req.params;
    const bodySchema = z.object({ timespan: z.string().min(1) });
    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid timespan' });

    const user = await getConfigManager().userManager.getOnePlain({ discordId });
    if (!user) return res.status(404).json({ error: 'User not found' });

    await getConfigManager().userManager.updatePlain({ defaultReminderTimeSpan: parsed.data.timespan } as any, { discordId });
    res.json({ success: true });
});

/**
 * @openapi
 * /users/{discordId}:
 *   delete:
 *     summary: Delete a user by Discord ID
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: discordId
 *         required: true
 *         schema:
 *           type: string
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
router.delete('/:discordId', jwtAuth, validateParams(discordIdParamSchema), async (req, res) => {
    const { discordId } = req.params;
    await getConfigManager().userManager.removeByPk(discordId);
    res.json({ success: true });
});

export { router };
