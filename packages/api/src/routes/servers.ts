import { createBaseRouter } from '../utils/createBaseRouter.js';
import { getConfigManager } from '@zeffuro/fakegaming-common/managers';
import { jwtAuth } from '../middleware/auth.js';
import { validateBodyForModel, validateParams } from '@zeffuro/fakegaming-common';
import { ServerConfig } from '@zeffuro/fakegaming-common/models';
import { z } from 'zod';

const router = createBaseRouter();

// ✨ Single source of truth - params via zod; body via model on demand
const serverIdParamSchema = z.object({ serverId: z.string().min(1) });

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
 *         description: Not found
 */
router.get('/:serverId', validateParams(serverIdParamSchema), async (req, res) => {
    const { serverId } = req.params;
    const server = await getConfigManager().serverManager.findByPkPlain(serverId);
    if (!server) return res.status(404).json({ error: 'Server not found' });
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
 */
router.post('/', jwtAuth, validateBodyForModel(ServerConfig, 'create'), async (req, res) => {
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
 */
router.put('/:serverId', jwtAuth, validateParams(serverIdParamSchema), validateBodyForModel(ServerConfig, 'update'), async (req, res) => {
    const { serverId } = req.params;
    const server = await getConfigManager().serverManager.findByPkPlain(serverId);
    if (!server) return res.status(404).json({ error: 'Server not found' });
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
 */
router.delete('/:serverId', jwtAuth, validateParams(serverIdParamSchema), async (req, res) => {
    const { serverId } = req.params;
    await getConfigManager().serverManager.removeByPk(serverId);
    res.json({ success: true });
});

export { router };
