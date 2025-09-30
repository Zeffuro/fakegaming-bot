import {Router} from 'express';
import {getConfigManager} from '@zeffuro/fakegaming-common';
import { jwtAuth } from '../middleware/auth.js';
import { isGuildAdmin } from '../utils/requestHelpers.js';
import type { AuthenticatedRequest } from '../types/express.js';
import { cacheGet } from '@zeffuro/fakegaming-common/src/cache';
import { CacheManager } from '@zeffuro/fakegaming-common/src/models/cache-manager';

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
async function getUserGuilds(discordId: string): Promise<string[]> {
    const cacheKey = `user:${discordId}:guilds`;
    let guilds = await cacheGet(cacheKey);
    if (!guilds) {
        const cacheEntry = await CacheManager.findByPk(cacheKey);
        guilds = cacheEntry ? JSON.parse(cacheEntry.value) : [];
    }
    return guilds;
}

router.get('/:serverId', jwtAuth, async (req, res) => {
    const { serverId } = req.params;
    const { discordId } = (req as AuthenticatedRequest).user;
    if (!serverId) return res.status(400).json({ error: 'Missing serverId parameter' });
    const guilds = await getUserGuilds(discordId);
    if (!isGuildAdmin(guilds, serverId)) {
        return res.status(403).json({ error: 'Not authorized for this server' });
    }
    const server = await getConfigManager().serverManager.getServer(serverId);
    if (!server) return res.status(404).json({error: 'Server not found'});
    res.json(server);
});

export default router;
