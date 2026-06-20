import { createBaseRouter } from '../utils/createBaseRouter.js';
import { getConfigManager } from '@zeffuro/fakegaming-common/managers';
import { jwtAuth } from '../middleware/auth.js';
import { requireGuildAdmin, checkUserGuildAccess, filterGuildScopedRecordsForRequest } from '../utils/authHelpers.js';
import { validateParams, validateBody, validateQuery } from '@zeffuro/fakegaming-common';
import { birthdayCreateRequestSchema, birthdayUpdateRequestSchema } from '@zeffuro/fakegaming-common/api';
import { z } from 'zod';
import { UniqueConstraintError } from 'sequelize';
import { recordAuditEvent } from '../utils/audit.js';

// Zod schemas
const userGuildParamSchema = z.object({
    userId: z.string().min(1),
    guildId: z.string().min(1)
});
const listQuerySchema = z.object({
    guildId: z.string().min(1).optional()
});

// Router
const router = createBaseRouter();

/**
 * @openapi
 * /birthdays:
 *   get:
 *     summary: List all birthdays
 *     tags: [Birthdays]
 *     responses:
 *       200:
 *         description: List of birthdays
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/BirthdayConfig'
 */
router.get('/', jwtAuth, validateQuery(listQuerySchema), async (req, res) => {
    const { guildId } = req.query as z.infer<typeof listQuerySchema>;
    const birthdays = await getConfigManager().birthdayManager.getAllPlain();
    const visibleBirthdays = await filterGuildScopedRecordsForRequest(req, res, birthdays, guildId);
    if (!visibleBirthdays) return;
    res.json(visibleBirthdays);
});

/**
 * @openapi
 * /birthdays/{userId}/{guildId}:
 *   get:
 *     summary: Get a birthday by userId and guildId
 *     tags: [Birthdays]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: guildId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Birthday config
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get('/:userId/:guildId', validateParams(userGuildParamSchema), async (req, res) => {
    const { userId, guildId } = req.params;
    const birthday = await getConfigManager().birthdayManager.getBirthday(userId as string, guildId as string);
    if (!birthday) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Birthday not found' } });
    const access = await checkUserGuildAccess(req, res, guildId as string);
    if (!access.authorized) return;
    res.json(birthday);
});

/**
 * @openapi
 * /birthdays:
 *   post:
 *     summary: Add or update a birthday
 *     tags: [Birthdays]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/BirthdayCreateRequest'
 *     responses:
 *       201:
 *         description: Created
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       409:
 *         $ref: '#/components/responses/Conflict'
 */
router.post('/', jwtAuth, validateBody(birthdayCreateRequestSchema), requireGuildAdmin, async (req, res) => {
    const { userId, guildId } = req.body;
    try {
        await getConfigManager().birthdayManager.addPlain(req.body);
        await recordAuditEvent(req, {
            action: 'birthday.create',
            targetType: 'birthday',
            targetId: `${guildId}:${userId}`,
            guildId,
            metadata: {
                targetUserId: userId,
                channelId: req.body.channelId,
            },
        });
        res.status(201).json({ success: true });
    } catch (error) {
        if (error instanceof UniqueConstraintError) {
            res.status(409).json({ error: { code: 'CONFLICT', message: 'Birthday already exists for this user in this guild' } });
        } else {
            throw error;
        }
    }
});

/**
 * @openapi
 * /birthdays/{userId}/{guildId}:
 *   put:
 *     summary: Update a birthday by userId and guildId
 *     tags: [Birthdays]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/BirthdayUpdateRequest'
 *     responses:
 *       200:
 *         description: Updated birthday config
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.put('/:userId/:guildId', jwtAuth, validateParams(userGuildParamSchema), validateBody(birthdayUpdateRequestSchema), async (req, res) => {
    const { userId, guildId } = req.params;
    const existing = await getConfigManager().birthdayManager.getBirthday(userId as string, guildId as string);
    if (!existing) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Birthday not found' } });

    const access = await checkUserGuildAccess(req, res, guildId as string);
    if (!access.authorized) return;

    const [affectedCount, rows] = await getConfigManager().birthdayManager.updatePlain(req.body, { userId, guildId });
    if (affectedCount === 0) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Birthday not found' } });

    await recordAuditEvent(req, {
        action: 'birthday.update',
        targetType: 'birthday',
        targetId: `${guildId}:${userId}`,
        guildId: guildId as string,
        metadata: {
            targetUserId: userId,
            channelId: req.body.channelId,
        },
    });

    res.json(rows[0] ?? await getConfigManager().birthdayManager.getBirthday(userId as string, guildId as string));
});

/**
 * @openapi
 * /birthdays/{userId}/{guildId}:
 *   delete:
 *     summary: Remove a birthday by userId and guildId
 *     tags: [Birthdays]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: guildId
 *         required: true
 *         schema:
 *           type: string
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.delete('/:userId/:guildId', jwtAuth, validateParams(userGuildParamSchema), async (req, res) => {
    const { userId, guildId } = req.params;
    const existing = await getConfigManager().birthdayManager.getBirthday(userId as string, guildId as string);
    if (!existing) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Birthday not found' } });
    const access = await checkUserGuildAccess(req, res, guildId as string);
    if (!access.authorized) return;
    await getConfigManager().birthdayManager.removeBirthday(userId as string, guildId as string);
    await recordAuditEvent(req, {
        action: 'birthday.delete',
        targetType: 'birthday',
        targetId: `${guildId}:${userId}`,
        guildId: guildId as string,
        metadata: {
            targetUserId: userId,
        },
    });
    res.json({ success: true });
});

export { router };
