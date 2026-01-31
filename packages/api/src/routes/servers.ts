import { createBaseRouter } from '../utils/createBaseRouter.js';
import { getConfigManager } from '@zeffuro/fakegaming-common/managers';
import { jwtAuth } from '../middleware/auth.js';
import { validateParams, validateBody } from '@zeffuro/fakegaming-common';
import { z } from 'zod';

// Zod schemas
const serverIdParamSchema = z.object({ serverId: z.string().min(1) });
const serverCreateSchema = z.object({
    serverId: z.string().min(1),
    name: z.string().min(1).optional(),
    prefix: z.string().min(1).optional()
});
const serverUpdateSchema = z
    .object({
        name: z.string().min(1).optional(),
        prefix: z.string().min(1).optional()
    })
    .refine((v) => Object.keys(v).length > 0, { message: 'At least one field must be provided' });

// Router
const router = createBaseRouter();

/**
 * @openapi
 * /servers:
 *   get:
 *     summary: List all servers
 *     tags: [Servers]
 *     responses:
 *       200:
 *         description: List of servers
 */
router.get('/', async (_req, res) => {
    const servers = await getConfigManager().serverManager.getAllPlain();
    res.json(servers);
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
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get('/:serverId', validateParams(serverIdParamSchema), async (req, res) => {
    const { serverId } = req.params;
    const server = await getConfigManager().serverManager.findByPkPlain(serverId as string);
    if (!server) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Server not found' } });
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
 *             $ref: '#/components/schemas/ServerConfig'
 *     responses:
 *       201:
 *         description: Created
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.post('/', jwtAuth, validateBody(serverCreateSchema), async (req, res) => {
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
 *             $ref: '#/components/schemas/ServerConfig'
 *     responses:
 *       200:
 *         description: Updated
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.put('/:serverId', jwtAuth, validateParams(serverIdParamSchema), validateBody(serverUpdateSchema), async (req, res) => {
    const { serverId } = req.params;
    const server = await getConfigManager().serverManager.findByPkPlain(serverId as string);
    if (!server) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Server not found' } });
    await getConfigManager().serverManager.updatePlain(req.body, { serverId: serverId as string });
    const updated = await getConfigManager().serverManager.findByPkPlain(serverId as string);
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
 */
router.delete('/:serverId', jwtAuth, validateParams(serverIdParamSchema), async (req, res) => {
    const { serverId } = req.params;
    await getConfigManager().serverManager.removeByPk(serverId as string);
    res.json({ success: true });
});

export { router };
