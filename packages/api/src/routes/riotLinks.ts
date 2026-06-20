import { z } from 'zod';
import { validateBody, validateParams } from '@zeffuro/fakegaming-common';
import { riotLinkUpdateRequestSchema } from '@zeffuro/fakegaming-common/api';
import { getConfigManager } from '@zeffuro/fakegaming-common/managers';
import { createBaseRouter } from '../utils/createBaseRouter.js';
import { requireDashboardAdmin } from '../utils/dashboardAdmin.js';
import { recordAuditEvent } from '../utils/audit.js';

const router = createBaseRouter();

const discordIdParamSchema = z.object({
    discordId: z.string().min(1),
}).strict();

/**
 * @openapi
 * /riotLinks:
 *   get:
 *     summary: List linked Riot accounts
 *     tags: [Riot Links]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Linked Riot accounts
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get('/', requireDashboardAdmin, async (_req, res) => {
    const links = await getConfigManager().leagueManager.getLinkedAccountsPlain();
    res.json({ links });
});

/**
 * @openapi
 * /riotLinks/{discordId}:
 *   get:
 *     summary: Get linked Riot account by Discord user ID
 *     tags: [Riot Links]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: discordId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Linked Riot account
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get('/:discordId', requireDashboardAdmin, validateParams(discordIdParamSchema), async (req, res) => {
    const { discordId } = req.params as z.infer<typeof discordIdParamSchema>;
    const link = await getConfigManager().leagueManager.getLinkedAccountPlain(discordId);
    if (!link) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Riot link not found' } });
    }
    res.json(link);
});

/**
 * @openapi
 * /riotLinks/{discordId}:
 *   put:
 *     summary: Create or update a linked Riot account for a Discord user
 *     tags: [Riot Links]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: discordId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RiotLinkUpdateRequest'
 *     responses:
 *       200:
 *         description: Updated linked Riot account
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.put(
    '/:discordId',
    requireDashboardAdmin,
    validateParams(discordIdParamSchema),
    validateBody(riotLinkUpdateRequestSchema),
    async (req, res) => {
        const { discordId } = req.params as z.infer<typeof discordIdParamSchema>;
        const body = req.body as z.infer<typeof riotLinkUpdateRequestSchema>;
        const link = await getConfigManager().leagueManager.setLinkedAccount({
            discordId,
            ...body,
        });
        await recordAuditEvent(req, {
            action: 'riotLink.upsert',
            targetType: 'riotLink',
            targetId: discordId,
            metadata: {
                region: body.region,
            },
        });
        res.json(link.get({ plain: true }));
    }
);

/**
 * @openapi
 * /riotLinks/{discordId}:
 *   delete:
 *     summary: Remove a linked Riot account for a Discord user
 *     tags: [Riot Links]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: discordId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Removed
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.delete('/:discordId', requireDashboardAdmin, validateParams(discordIdParamSchema), async (req, res) => {
    const { discordId } = req.params as z.infer<typeof discordIdParamSchema>;
    await getConfigManager().leagueManager.removeLinkedAccount(discordId);
    await recordAuditEvent(req, {
        action: 'riotLink.delete',
        targetType: 'riotLink',
        targetId: discordId,
    });
    res.json({ success: true });
});

export { router };
