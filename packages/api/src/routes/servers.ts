import {Router} from 'express';
import {getConfigManager} from '@zeffuro/fakegaming-common';

const router = Router();

/**
 * @openapi
 * /servers:
 *   get:
 *     summary: List all servers
 *     tags: [Servers]
 *     responses:
 *       200:
 *         description: List of servers
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/ServerConfig'
 */
router.get('/', async (req, res) => {
    const servers = await getConfigManager().serverManager.getAllPlain();
    res.json(servers);
});

/**
 * @openapi
 * /servers/{serverId}:
 *   get:
 *     summary: Get a server by serverId
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
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ServerConfig'
 *       404:
 *         description: Not found
 */
router.get('/:serverId', async (req, res) => {
    const server = await getConfigManager().serverManager.getServer(req.params.serverId);
    if (!server) return res.status(404).json({error: 'Server not found'});
    res.json(server);
});

export default router;
