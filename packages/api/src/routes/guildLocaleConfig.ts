import { z } from 'zod';
import { getConfigManager, guildLocaleConfigUpdateRequestSchema, validateBody, validateQuery } from '@zeffuro/fakegaming-common';
import { jwtAuth } from '../middleware/auth.js';
import { requireGuildAdmin } from '../utils/authHelpers.js';
import { createBaseRouter } from '../utils/createBaseRouter.js';

const router = createBaseRouter();

const guildQuerySchema = z.object({
    guildId: z.string().trim().min(1).max(255),
}).strict();

/**
 * @openapi
 * /guildLocaleConfig:
 *   get:
 *     summary: Read a guild's bot output locale
 *     tags: [Guild Settings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: guildId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Guild output locale, defaulting to English when no preference is stored
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/GuildLocaleConfig'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get('/', jwtAuth, validateQuery(guildQuerySchema), requireGuildAdmin, async (req, res) => {
    const { guildId } = req.query as z.infer<typeof guildQuerySchema>;
    const outputLocale = await getConfigManager().guildLocaleConfigManager.getOutputLocale(guildId);
    res.set('Cache-Control', 'private, no-store').json({ guildId, outputLocale });
});

/**
 * @openapi
 * /guildLocaleConfig:
 *   put:
 *     summary: Set a guild's bot output locale
 *     tags: [Guild Settings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: guildId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/GuildLocaleConfigUpdateRequest'
 *     responses:
 *       200:
 *         description: Updated guild output locale
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/GuildLocaleConfig'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.put('/', jwtAuth, validateQuery(guildQuerySchema), validateBody(guildLocaleConfigUpdateRequestSchema), requireGuildAdmin, async (req, res) => {
    const { guildId } = req.query as z.infer<typeof guildQuerySchema>;
    const { outputLocale } = req.body as z.infer<typeof guildLocaleConfigUpdateRequestSchema>;
    const config = await getConfigManager().guildLocaleConfigManager.setOutputLocale(guildId, outputLocale);
    res.set('Cache-Control', 'private, no-store').json(config);
});

export { router };
