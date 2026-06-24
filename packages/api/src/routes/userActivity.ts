import { z } from 'zod';
import {
    getConfigManager,
    validateQuery,
    type AuditEventRecord,
    type NotificationRecord,
} from '@zeffuro/fakegaming-common';
import { createBaseRouter } from '../utils/createBaseRouter.js';
import type { AuthenticatedRequest } from '../types/express.js';

const router = createBaseRouter();

const userActivityQuerySchema = z.object({
    auditLimit: z.coerce.number().int().min(1).max(20).optional(),
    deliveryLimit: z.coerce.number().int().min(1).max(20).optional(),
}).strict();

function getAuthenticatedDiscordId(req: AuthenticatedRequest): string {
    return req.user.discordId;
}

/**
 * @openapi
 * /userActivity:
 *   get:
 *     summary: Get recent account activity for the authenticated dashboard user
 *     tags: [UserActivity]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: auditLimit
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 20
 *       - in: query
 *         name: deliveryLimit
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 20
 *     responses:
 *       200:
 *         description: User-scoped audit events and delivery records
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/', validateQuery(userActivityQuerySchema), async (req, res) => {
    const discordId = getAuthenticatedDiscordId(req as AuthenticatedRequest);
    const query = req.query as z.infer<typeof userActivityQuerySchema>;
    const auditLimit = query.auditLimit ?? 8;
    const deliveryLimit = query.deliveryLimit ?? 5;
    const manager = getConfigManager();
    const [auditResult, deliveryResult] = await Promise.all([
        manager.auditEventManager.list({
            actorId: discordId,
            limit: auditLimit,
        }),
        manager.notificationsManager.listBirthdayDeliveriesForUser({
            userId: discordId,
            limit: deliveryLimit,
            days: 30,
        }),
    ]);

    res.json({
        auditEvents: auditResult.events.map(serializeAuditEvent),
        deliveries: deliveryResult.records.map(serializeDeliveryRecord),
        summary: {
            auditTotal: auditResult.total,
            deliveryTotal: deliveryResult.total,
        },
    });
});

function serializeAuditEvent(event: AuditEventRecord) {
    return {
        ...event,
        timestamp: event.timestamp.toISOString(),
        createdAt: toIsoString(event.createdAt),
        updatedAt: toIsoString(event.updatedAt),
    };
}

function serializeDeliveryRecord(record: NotificationRecord) {
    return {
        ...record,
        guildId: record.guildId ?? null,
        channelId: record.channelId ?? null,
        messageId: record.messageId ?? null,
        createdAt: toIsoString(record.createdAt),
        updatedAt: toIsoString(record.updatedAt),
    };
}

function toIsoString(value: Date | string | null | undefined): string | null {
    if (!value) return null;
    if (value instanceof Date) return value.toISOString();
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
}

export { router };
