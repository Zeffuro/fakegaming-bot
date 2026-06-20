import { createBaseRouter } from '../utils/createBaseRouter.js';
import { getConfigManager } from '@zeffuro/fakegaming-common/managers';
import { jwtAuth } from '../middleware/auth.js';
import { validateBody, validateParams, validateQuery } from '@zeffuro/fakegaming-common';
import { disabledModuleCreateRequestSchema } from '@zeffuro/fakegaming-common/api';
import { z } from 'zod';
import { filterGuildScopedRecordsForRequest, requireGuildAdmin, checkGuildScopedRecordAccess } from '../utils/authHelpers.js';
import { recordAuditEvent } from '../utils/audit.js';

// Zod schemas
const idParamSchema = z.object({ id: z.coerce.number().int() });
const checkQuerySchema = z.object({
    guildId: z.string().min(1),
    moduleName: z.string().min(1)
});
const listQuerySchema = z.object({ guildId: z.string().min(1).optional() });

// Router
const router = createBaseRouter();

/**
 * @openapi
 * /disabledModules:
 *   get:
 *     summary: List disabled modules (optionally filtered by guild)
 *     tags: [DisabledModules]
 *     parameters:
 *       - in: query
 *         name: guildId
 *         required: false
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of disabled modules
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/DisabledModuleConfig'
 */
router.get('/', validateQuery(listQuerySchema), async (req, res) => {
    const { guildId } = req.query as z.infer<typeof listQuerySchema>;
    const disabledModules = await getConfigManager().disabledModuleManager.getAllPlain();
    const visibleDisabledModules = await filterGuildScopedRecordsForRequest(req, res, disabledModules, guildId);
    if (!visibleDisabledModules) return;
    res.json(visibleDisabledModules);
});

/**
 * @openapi
 * /disabledModules/check:
 *   get:
 *     summary: Check if a module is disabled in a guild
 *     tags: [DisabledModules]
 *     parameters:
 *       - in: query
 *         name: guildId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: moduleName
 *         required: true
 *         schema:
 *           type: string
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Module disabled status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 disabled:
 *                   type: boolean
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/check', jwtAuth, validateQuery(checkQuerySchema), async (req, res) => {
    const { guildId, moduleName } = req.query as z.infer<typeof checkQuerySchema>;
    const exists = await getConfigManager().disabledModuleManager.exists({ guildId, moduleName });
    res.json({ disabled: exists });
});

/**
 * @openapi
 * /disabledModules/{id}:
 *   get:
 *     summary: Get a disabled module by id
 *     tags: [DisabledModules]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Disabled module config
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DisabledModuleConfig'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get('/:id', validateParams(idParamSchema), async (req, res) => {
    const { id } = req.params;
    const disabledModule = await getConfigManager().disabledModuleManager.findByPkPlain(Number(id));
    if (!disabledModule) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Disabled module not found' } });
    const hasAccess = await checkGuildScopedRecordAccess(req, res, disabledModule);
    if (!hasAccess) return;
    res.json(disabledModule);
});

/**
 * @openapi
 * /disabledModules:
 *   post:
 *     summary: Add a new disabled module
 *     tags: [DisabledModules]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/DisabledModuleCreateRequest'
 *     responses:
 *       201:
 *         description: Created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DisabledModuleConfig'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.post('/', jwtAuth, validateBody(disabledModuleCreateRequestSchema), requireGuildAdmin, async (req, res) => {
    const created = await getConfigManager().disabledModuleManager.addPlain(req.body);
    await recordAuditEvent(req, {
        action: 'module.disable',
        targetType: 'disabledModule',
        targetId: created.id,
        guildId: created.guildId ?? null,
        metadata: {
            moduleName: created.moduleName,
        },
    });
    res.status(201).json(created);
});

/**
 * @openapi
 * /disabledModules/{id}:
 *   delete:
 *     summary: Delete a disabled module by id
 *     tags: [DisabledModules]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.delete('/:id', jwtAuth, validateParams(idParamSchema), async (req, res) => {
    const { id } = req.params;
    const numericId = Number(id);
    const existing = await getConfigManager().disabledModuleManager.findByPkPlain(numericId);
    if (!existing) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Disabled module not found' } });
    const hasAccess = await checkGuildScopedRecordAccess(req, res, existing);
    if (!hasAccess) return;
    await getConfigManager().disabledModuleManager.removeByPk(numericId);
    await recordAuditEvent(req, {
        action: 'module.enable',
        targetType: 'disabledModule',
        targetId: numericId,
        guildId: existing.guildId ?? null,
        metadata: {
            moduleName: existing.moduleName,
        },
    });
    res.json({ success: true });
});

export { router };
