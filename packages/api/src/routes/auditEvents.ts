import { z } from 'zod';
import { getConfigManager, validateQuery } from '@zeffuro/fakegaming-common';
import { createBaseRouter } from '../utils/createBaseRouter.js';
import { jwtOrService } from '../middleware/auth.js';
import { requireDashboardAdmin } from '../utils/dashboardAdmin.js';

const router = createBaseRouter();

const INTEGRATION_ACTION_PREFIXES = [
    'animeSubscription.',
    'bluesky.',
    'patchSubscription.',
    'tiktok.',
    'twitch.',
    'youtube.',
] as const;

const INTEGRATION_PROVIDER_ACTION_PREFIXES = {
    anime: ['animeSubscription.'],
    bluesky: ['bluesky.'],
    patchnotes: ['patchSubscription.'],
    tiktok: ['tiktok.'],
    twitch: ['twitch.'],
    youtube: ['youtube.'],
} as const;

const integrationProviderSchema = z.enum(['anime', 'bluesky', 'patchnotes', 'tiktok', 'twitch', 'youtube']);

const auditEventsQuerySchema = z.object({
    limit: z.coerce.number().int().min(1).max(200).optional(),
    offset: z.coerce.number().int().min(0).max(10000).optional(),
    action: z.string().trim().min(1).max(128).optional(),
    scope: z.enum(['integrations']).optional(),
    provider: integrationProviderSchema.optional(),
    targetType: z.string().trim().min(1).max(64).optional(),
    actorId: z.string().trim().min(1).max(255).optional(),
    guildId: z.string().trim().min(1).max(255).optional(),
    severity: z.enum(['info', 'warn', 'error']).optional(),
    status: z.enum(['success', 'failure']).optional(),
}).strict();

/**
 * @openapi
 * /auditEvents:
 *   get:
 *     summary: List recent admin audit events
 *     tags: [Audit]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Recent audit events
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get('/', jwtOrService, requireDashboardAdmin, validateQuery(auditEventsQuerySchema), async (req, res) => {
    const query = req.query as z.infer<typeof auditEventsQuerySchema>;
    const { provider, scope: _scope, ...listQuery } = query;
    const actionPrefix = provider
        ? INTEGRATION_PROVIDER_ACTION_PREFIXES[provider]
        : query.scope === 'integrations'
            ? INTEGRATION_ACTION_PREFIXES
            : undefined;
    const result = await getConfigManager().auditEventManager.list({
        ...listQuery,
        actionPrefix,
    });

    res.json({
        ...result,
        events: result.events.map(event => ({
            ...event,
            timestamp: event.timestamp.toISOString(),
            createdAt: event.createdAt?.toISOString(),
            updatedAt: event.updatedAt?.toISOString(),
        })),
    });
});

export { router };
