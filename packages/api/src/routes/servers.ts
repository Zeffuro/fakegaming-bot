import { createBaseRouter } from '../utils/createBaseRouter.js';
import { getConfigManager } from '@zeffuro/fakegaming-common/managers';
import { jwtOrService } from '../middleware/auth.js';
import { checkUserGuildAccess, filterGuildScopedRecordsForRequest } from '../utils/authHelpers.js';
import { validateParams, validateBody } from '../localization/validation.js';
import { serverCreateRequestSchema, serverUpdateRequestSchema } from '@zeffuro/fakegaming-common/api';
import { z } from 'zod';
import { sendLocalizedError } from '../localization/responses.js';

// Zod schemas
const serverIdParamSchema = z.object({ serverId: z.string().min(1) });

// Router
const router = createBaseRouter();

/**
 * @openapi
 * /servers:
 *   get:
 *     summary: List servers accessible to the caller
 *     tags: [Servers]
 *     responses:
 *       200:
 *         description: Servers the caller can administer, or all servers for dashboard admins and internal services
 *       503:
 *         description: Guild access is temporarily unavailable
 */
router.get('/', async (req, res) => {
    const servers = await getConfigManager().serverManager.getAllPlain();
    const records = servers.map(server => ({ guildId: server.serverId, server }));
    const visibleRecords = await filterGuildScopedRecordsForRequest(req, res, records, undefined);
    if (visibleRecords) res.json(visibleRecords.map(({ server }) => server));
});

/**
 * @openapi
 * /servers/{serverId}:
 *   get:
 *     summary: Get a server by ID
 *     tags: [Servers]
 *     parameters:
 *       - in: path
 *         name: serverId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Server config
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       503:
 *         description: Guild access is temporarily unavailable
 */
router.get('/:serverId', validateParams(serverIdParamSchema), async (req, res) => {
    const { serverId } = req.params as z.infer<typeof serverIdParamSchema>;
    if (!(await checkUserGuildAccess(req, res, serverId)).authorized) return;

    const server = await getConfigManager().serverManager.findByPkPlain(serverId);
    if (!server) return sendLocalizedError(req, res, 404, 'NOT_FOUND', 'serverNotFound');
    res.json(server);
});

/**
 * @openapi
 * /servers:
 *   post:
 *     summary: Create a new server
 *     tags: [Servers]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ServerCreateRequest'
 *     responses:
 *       201:
 *         description: Created
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       503:
 *         description: Guild access is temporarily unavailable
 */
router.post('/', jwtOrService, validateBody(serverCreateRequestSchema), async (req, res) => {
    if (!(await checkUserGuildAccess(req, res, req.body.serverId)).authorized) return;

    const created = await getConfigManager().serverManager.addPlain(req.body);
    res.status(201).json(created);
});

/**
 * @openapi
 * /servers/{serverId}:
 *   put:
 *     summary: Update a server by ID
 *     tags: [Servers]
 *     parameters:
 *       - in: path
 *         name: serverId
 *         required: true
 *         schema:
 *           type: string
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ServerUpdateRequest'
 *     responses:
 *       200:
 *         description: Updated
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       503:
 *         description: Guild access is temporarily unavailable
 */
router.put('/:serverId', jwtOrService, validateParams(serverIdParamSchema), validateBody(serverUpdateRequestSchema), async (req, res) => {
    const { serverId } = req.params as z.infer<typeof serverIdParamSchema>;
    if (!(await checkUserGuildAccess(req, res, serverId)).authorized) return;

    const server = await getConfigManager().serverManager.findByPkPlain(serverId);
    if (!server) return sendLocalizedError(req, res, 404, 'NOT_FOUND', 'serverNotFound');
    await getConfigManager().serverManager.updatePlain(req.body, { serverId });
    const updated = await getConfigManager().serverManager.findByPkPlain(serverId);
    res.json(updated);
});

/**
 * @openapi
 * /servers/{serverId}:
 *   delete:
 *     summary: Delete a server by ID
 *     tags: [Servers]
 *     parameters:
 *       - in: path
 *         name: serverId
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
 *       503:
 *         description: Guild access is temporarily unavailable
 */
router.delete('/:serverId', jwtOrService, validateParams(serverIdParamSchema), async (req, res) => {
    const { serverId } = req.params as z.infer<typeof serverIdParamSchema>;
    if (!(await checkUserGuildAccess(req, res, serverId)).authorized) return;

    await getConfigManager().serverManager.removeByPk(serverId);
    res.json({ success: true });
});

export { router };
