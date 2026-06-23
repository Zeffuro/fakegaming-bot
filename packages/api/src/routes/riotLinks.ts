import { z } from 'zod';
import { validateBody, validateParams } from '@zeffuro/fakegaming-common';
import { riotLinkUpdateRequestSchema } from '@zeffuro/fakegaming-common/api';
import { getConfigManager } from '@zeffuro/fakegaming-common/managers';
import { formatRiotId, parseRiotId } from '@zeffuro/fakegaming-common/utils';
import { createBaseRouter } from '../utils/createBaseRouter.js';
import { requireDashboardAdmin } from '../utils/dashboardAdmin.js';
import { recordAuditEvent } from '../utils/audit.js';
import { validateRiotAccountLink } from '../utils/riotAccountValidation.js';
import type { AuthenticatedRequest } from '../types/express.js';

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
 * /riotLinks/me:
 *   get:
 *     summary: Get the authenticated dashboard user's linked Riot account
 *     tags: [Riot Links]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Linked Riot account for the authenticated user, or null when not linked
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/me', async (req, res) => {
    const discordId = (req as AuthenticatedRequest).user.discordId;
    const link = await getConfigManager().leagueManager.getLinkedAccountPlain(discordId);
    res.json({ link });
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
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       503:
 *         description: Riot Account API validation is unavailable
 */
router.put(
    '/:discordId',
    requireDashboardAdmin,
    validateParams(discordIdParamSchema),
    validateBody(riotLinkUpdateRequestSchema),
    async (req, res) => {
        const { discordId } = req.params as z.infer<typeof discordIdParamSchema>;
        const body = req.body as z.infer<typeof riotLinkUpdateRequestSchema>;
        const riotId = parseRiotId(formatRiotId(body.riotIdGameName, body.riotIdTagLine, body.summonerName));
        if (!riotId?.tagLine) {
            return res.status(400).json({
                error: {
                    code: 'BAD_REQUEST',
                    message: 'Riot ID must include a tag line for Account-V1 validation.',
                },
            });
        }

        const validation = await validateRiotAccountLink({
            gameName: riotId.gameName,
            tagLine: riotId.tagLine,
            region: body.region,
            puuid: body.puuid,
        });
        if (!validation.ok) {
            return res.status(validation.statusCode).json({
                error: {
                    code: validation.code,
                    message: validation.message,
                },
            });
        }

        const link = await getConfigManager().leagueManager.setLinkedAccount({
            discordId,
            ...body,
            summonerName: `${riotId.gameName}#${riotId.tagLine}`,
            riotIdGameName: riotId.gameName,
            riotIdTagLine: riotId.tagLine,
            puuid: validation.puuid,
        });
        await recordAuditEvent(req, {
            action: 'riotLink.upsert',
            targetType: 'riotLink',
            targetId: discordId,
            metadata: {
                riotIdGameName: riotId.gameName,
                riotIdTagLine: riotId.tagLine,
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
