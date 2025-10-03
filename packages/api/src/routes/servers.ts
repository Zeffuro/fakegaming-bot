import {Router} from 'express';
import {getConfigManager} from '@zeffuro/fakegaming-common/managers';
import {jwtAuth} from '../middleware/auth.js';
import {checkUserGuildAccess} from '../utils/authHelpers.js';

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
 *     security:
 *       - bearerAuth: []
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
router.get('/:serverId', jwtAuth, async (req, res) => {
    const { serverId } = req.params;
    if (!serverId) return res.status(400).json({ error: 'Missing serverId parameter' });

    // Check user's access to this server/guild
    const accessResult = await checkUserGuildAccess(req, res, serverId);
    if (!accessResult.authorized) {
        // Response already sent by checkUserGuildAccess
        return;
    }

    const server = await getConfigManager().serverManager.getServer(serverId);
    if (!server) return res.status(404).json({error: 'Server not found'});
    res.json(server);
});

export default router;
