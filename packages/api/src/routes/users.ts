import { createBaseRouter } from '../utils/createBaseRouter.js';
import { getConfigManager } from '@zeffuro/fakegaming-common/managers';
import { jwtAuth } from '../middleware/auth.js';
import { validateParams, validateBody } from '@zeffuro/fakegaming-common';
import { z } from 'zod';

// Zod schemas
const discordIdParamSchema = z.object({ discordId: z.string().min(1) });
const userCreateSchema = z.object({
    discordId: z.string().min(1),
    timezone: z.string().min(1).optional(),
    defaultReminderTimeSpan: z.string().min(1).optional()
});
const userUpdateSchema = z
    .object({
        timezone: z.string().min(1).optional(),
        defaultReminderTimeSpan: z.string().min(1).optional()
    })
    .refine((v) => Object.keys(v).length > 0, { message: 'At least one field must be provided' });
const timezoneBodySchema = z.object({ timezone: z.string().min(1) });
const defaultTimespanBodySchema = z.object({ timespan: z.string().min(1) });

// Router
const router = createBaseRouter();

/**
 * @openapi
 * /users:
 *   get:
 *     summary: List all users
 *     tags: [Users]
 *     responses:
 *       200:
 *         description: List of users
 *       429:
 *         $ref: '#/components/responses/RateLimitExceeded'
 *     headers:
 *       X-RateLimit-Limit:
 *         $ref: '#/components/headers/X-RateLimit-Limit'
 *       X-RateLimit-Remaining:
 *         $ref: '#/components/headers/X-RateLimit-Remaining'
 *       X-RateLimit-Reset:
 *         $ref: '#/components/headers/X-RateLimit-Reset'
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
 *       400:
 *         description: Body validation failed
 *       401:
 *         description: Unauthorized
 */
router.post('/', jwtAuth, validateBody(userCreateSchema), async (req, res) => {
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
 *       400:
 *         description: Body validation failed
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Not found
 */
router.put('/:discordId', jwtAuth, validateParams(discordIdParamSchema), validateBody(userUpdateSchema), async (req, res) => {
    const { discordId } = req.params;
    const user = await getConfigManager().userManager.findByPkPlain(discordId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    await getConfigManager().userManager.updatePlain(req.body, { discordId });
    const updated = await getConfigManager().userManager.findByPkPlain(discordId);
    res.json(updated);
});

/**
 * @openapi
 * /users/{discordId}/timezone:
 *   put:
 *     summary: Set timezone for a user
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
 *             type: object
 *             properties:
 *               timezone:
 *                 type: string
 *     responses:
 *       200:
 *         description: Success
 *       400:
 *         description: Body validation failed
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Not found
 */
router.put(
    '/:discordId/timezone',
    jwtAuth,
    validateParams(discordIdParamSchema),
    validateBody(timezoneBodySchema),
    async (req, res) => {
        const { discordId } = req.params;
        const user = await getConfigManager().userManager.getOnePlain({ discordId });
        if (!user) return res.status(404).json({ error: 'User not found' });

        const { timezone } = req.body as z.infer<typeof timezoneBodySchema>;
        await getConfigManager().userManager.updatePlain({ timezone }, { discordId });
        res.json({ success: true });
    }
);

/**
 * @openapi
 * /users/{discordId}/defaultReminderTimeSpan:
 *   put:
 *     summary: Set default reminder timespan for a user
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
 *             type: object
 *             properties:
 *               timespan:
 *                 type: string
 *     responses:
 *       200:
 *         description: Success
 *       400:
 *         description: Body validation failed
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Not found
 */
router.put(
    '/:discordId/defaultReminderTimeSpan',
    jwtAuth,
    validateParams(discordIdParamSchema),
    validateBody(defaultTimespanBodySchema),
    async (req, res) => {
        const { discordId } = req.params;
        const user = await getConfigManager().userManager.getOnePlain({ discordId });
        if (!user) return res.status(404).json({ error: 'User not found' });

        const { timespan } = req.body as z.infer<typeof defaultTimespanBodySchema>;
        await getConfigManager().userManager.updatePlain(
            { defaultReminderTimeSpan: timespan },
            { discordId }
        );
        res.json({ success: true });
    }
);

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
 *       401:
 *         description: Unauthorized
 */
router.delete('/:discordId', jwtAuth, validateParams(discordIdParamSchema), async (req, res) => {
    const { discordId } = req.params;
    await getConfigManager().userManager.removeByPk(discordId);
    res.json({ success: true });
});

export { router };
