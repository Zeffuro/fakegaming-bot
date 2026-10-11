import { z } from 'zod';
import { Op } from 'sequelize';
import { CalendarConnection, CalendarSource, CalendarEventSnapshot } from '@zeffuro/fakegaming-common/models';
import { calendarOverlapPage } from '@zeffuro/fakegaming-common/utils';
import { createBaseRouter } from '../utils/createBaseRouter.js';
import { validateQuery } from '../localization/validation.js';
import { sendLocalizedError } from '../localization/responses.js';
import type { AuthenticatedRequest } from '../types/express.js';
import { isServiceRequest } from '../middleware/serviceAuth.js';

const router = createBaseRouter();
const querySchema = z.object({
    offset: z.string().regex(/^\d{1,9}$/).transform(Number).optional(),
    limit: z.string().regex(/^\d{1,3}$/).transform(Number).pipe(z.number().int().min(1).max(100)).optional(),
}).strict();

router.use((req, res, next) => {
    res.setHeader('Cache-Control', 'private, no-store');
    res.vary('Accept-Language');
    const user = (req as Partial<AuthenticatedRequest>).user;
    if (isServiceRequest(req) || !user || typeof user.discordId !== 'string' || !user.discordId || user.discordId.startsWith('service:')) {
        sendLocalizedError(req, res, 401, 'UNAUTHORIZED', 'unauthorized');
        return;
    }
    next();
});

/**
 * @openapi
 * /calendarOverlaps:
 *   get:
 *     summary: Page through private owner overlap warnings from stored timed calendar events
 *     tags: [UserCalendar]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: offset, schema: { type: integer, minimum: 0 } }
 *       - { in: query, name: limit, schema: { type: integer, minimum: 1, maximum: 100 } }
 *     responses:
 *       200: { description: All overlapping pairs are counted and available through pagination; no provider requests }
 */
router.get('/', validateQuery(querySchema), async (req, res) => {
    try {
        const userId = (req as AuthenticatedRequest).user.discordId;
        const query = req.query as unknown as z.infer<typeof querySchema>;
        const offset = query.offset ?? 0;
        const limit = query.limit ?? 10;
        const now = Date.now();
        const until = now + 366 * 86_400_000;
        const connection = await CalendarConnection.findByPk(userId, { attributes: ['status'] });
        if (connection?.status !== 'connected') {
            res.json({ overlaps: [], total: 0, offset, limit, checkedAt: now, until, connected: false, sources: [] });
            return;
        }
        const sources = await CalendarSource.findAll({ where: { userId, enabled: true },
            attributes: ['id', 'calendarId', 'label', 'timezone', 'lastSyncedAt'], order: [['id', 'ASC']] });
        const snapshots = sources.length ? await CalendarEventSnapshot.findAll({ where: {
            userId, sourceId: { [Op.in]: sources.map(source => source.id) },
        }, attributes: ['id', 'sourceId', 'eventId', 'title', 'timezone', 'plannedAt', 'endAt', 'allDay', 'cancelled'] }) : [];
        const page = calendarOverlapPage({ snapshots, sources, now, until, offset, limit });
        res.json({ ...page, offset, limit, checkedAt: now, until, connected: true,
            sources: sources.map(source => ({ id: source.id, label: source.label, lastSyncedAt: source.lastSyncedAt === null ? null : Number(source.lastSyncedAt) })) });
    } catch {
        sendLocalizedError(req, res, 503, 'CALENDAR_OVERLAPS_UNAVAILABLE', 'calendarOverlapsUnavailable');
    }
});

export { router };
