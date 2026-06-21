import { z } from 'zod';
import { getConfigManager, validateParams } from '@zeffuro/fakegaming-common';
import { createBaseRouter } from '../utils/createBaseRouter.js';
import { checkUserGuildAccess } from '../utils/authHelpers.js';

const router = createBaseRouter();

const guildSummaryParamsSchema = z.object({
    guildId: z.string().min(1),
});

interface GuildDashboardSummaryCounts {
    twitch: number;
    tiktok: number;
    bluesky: number;
    youtube: number;
    patchSubscriptions: number;
    anime: number;
    birthdays: number;
}

function sumCounts(counts: GuildDashboardSummaryCounts): number {
    return counts.twitch
        + counts.tiktok
        + counts.bluesky
        + counts.youtube
        + counts.patchSubscriptions
        + counts.anime
        + counts.birthdays;
}

/**
 * @openapi
 * /dashboard/guild/{guildId}/summary:
 *   get:
 *     summary: Get dashboard summary counts for a guild
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: guildId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Guild dashboard summary
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get('/guild/:guildId/summary', validateParams(guildSummaryParamsSchema), async (req, res) => {
    const { guildId } = req.params as z.infer<typeof guildSummaryParamsSchema>;
    const access = await checkUserGuildAccess(req, res, guildId);
    if (!access.authorized) return;

    const manager = getConfigManager();
    const [
        twitch,
        tiktok,
        bluesky,
        youtube,
        patchSubscriptions,
        anime,
        birthdays,
    ] = await Promise.all([
        manager.twitchManager.count({ guildId }),
        manager.tiktokManager.count({ guildId }),
        manager.blueskyManager.count({ guildId }),
        manager.youtubeManager.count({ guildId }),
        manager.patchSubscriptionManager.count({ guildId }),
        manager.animeManager.subscriptions.count({ guildId, targetType: 'channel' }),
        manager.birthdayManager.count({ guildId }),
    ]);

    const counts: GuildDashboardSummaryCounts = {
        twitch,
        tiktok,
        bluesky,
        youtube,
        patchSubscriptions,
        anime,
        birthdays,
    };

    res.json({
        guildId,
        counts,
        totalConfigured: sumCounts(counts),
    });
});

export { router };
