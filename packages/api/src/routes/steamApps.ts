import { z } from 'zod';
import { resolveSteamAppInput, searchSteamApps } from '@zeffuro/fakegaming-common/steam';
import { createBaseRouter } from '../utils/createBaseRouter.js';
import { validateQuery } from '@zeffuro/fakegaming-common';

const router = createBaseRouter();

const steamAppQuerySchema = z.object({
    q: z.string().trim().min(1).max(120),
    limit: z.coerce.number().int().min(1).max(25).optional(),
});

/**
 * @openapi
 * /steamApps/search:
 *   get:
 *     summary: Search Steam apps by name, App ID, or Steam app URL
 *     tags: [SteamApps]
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: limit
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 25
 *     responses:
 *       200:
 *         description: Ranked Steam app search results
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 */
router.get('/search', validateQuery(steamAppQuerySchema), async (req, res) => {
    const { q, limit } = req.query as unknown as z.infer<typeof steamAppQuerySchema>;
    const results = await searchSteamApps(q, { limit });
    res.json({ results });
});

/**
 * @openapi
 * /steamApps/resolve:
 *   get:
 *     summary: Resolve one Steam app from a name, App ID, or Steam app URL
 *     tags: [SteamApps]
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: limit
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 25
 *     responses:
 *       200:
 *         description: Resolved Steam app
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       409:
 *         description: Multiple Steam apps matched the input
 */
router.get('/resolve', validateQuery(steamAppQuerySchema), async (req, res) => {
    const { q, limit } = req.query as unknown as z.infer<typeof steamAppQuerySchema>;
    const result = await resolveSteamAppInput(q, { limit });

    if (result.status === 'resolved') {
        res.json(result.app);
        return;
    }

    if (result.status === 'ambiguous') {
        res.status(409).json({
            error: {
                code: 'STEAM_APP_AMBIGUOUS',
                message: 'Multiple Steam apps matched this input. Choose one of the suggested results.',
                suggestions: result.suggestions,
            },
        });
        return;
    }

    res.status(404).json({
        error: {
            code: 'NOT_FOUND',
            message: 'Steam app not found',
            suggestions: result.suggestions,
        },
    });
});

export { router };
