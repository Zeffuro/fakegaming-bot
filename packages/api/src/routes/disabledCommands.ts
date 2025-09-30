import {Router} from 'express';
import {getConfigManager} from '@zeffuro/fakegaming-common';
import {jwtAuth} from '../middleware/auth.js';
import type { AuthenticatedRequest } from '../types/express.js';

const router = Router();

/**
 * @openapi
 * /disabledCommands:
 *   get:
 *     summary: List all disabled commands
 *     tags: [DisabledCommands]
 *     responses:
 *       200:
 *         description: List of disabled commands
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/DisabledCommandConfig'
 */
router.get('/', async (req, res) => {
    const configs = await getConfigManager().disabledCommandManager.getAllPlain();
    res.json(configs);
});

/**
 * @openapi
 * /disabledCommands/check:
 *   get:
 *     summary: Check if a command is disabled in a guild
 *     tags: [DisabledCommands]
 *     parameters:
 *       - in: query
 *         name: guildId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: commandName
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Disabled status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 disabled:
 *                   type: boolean
 */
router.get('/check', async (req, res) => {
    const {guildId, commandName} = req.query;
    if (!guildId || !commandName) return res.status(400).json({error: 'guildId and commandName required'});
    const disabled = await getConfigManager().disabledCommandManager.isCommandDisabled(String(guildId), String(commandName));
    res.json({disabled});
});

/**
 * @openapi
 * /disabledCommands:
 *   post:
 *     summary: Add a disabled command
 *     tags: [DisabledCommands]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/DisabledCommandConfig'
 *     responses:
 *       201:
 *         description: Created
 */
router.post('/', jwtAuth, async (req, res) => {
    const { discordId, guilds } = (req as AuthenticatedRequest).user;
    const { guildId, commandName } = req.body;
    if (!guildId || !commandName) {
        return res.status(400).json({ error: 'guildId and commandName required' });
    }
    if (!guilds || !guilds.includes(guildId)) {
        return res.status(403).json({ error: 'Not authorized for this guild' });
    }
    const created = await getConfigManager().disabledCommandManager.addPlain(req.body);
    // Audit log
    console.log(`[AUDIT] User ${discordId} disabled command '${commandName}' for guild ${guildId} at ${new Date().toISOString()}`);
    res.status(201).json(created);
});

/**
 * @openapi
 * /disabledCommands/{id}:
 *   delete:
 *     summary: Remove a disabled command by id
 *     tags: [DisabledCommands]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Success
 */
router.delete('/:id', jwtAuth, async (req, res) => {
    const { discordId, guilds } = (req as AuthenticatedRequest).user;
    const id = req.params.id;
    if (!id) {
        return res.status(400).json({ error: 'Missing id' });
    }
    // Find the config to get guildId for permission check
    const config = await getConfigManager().disabledCommandManager.getById(id);
    if (!config) {
        return res.status(404).json({ error: 'Config not found' });
    }
    if (!guilds || !guilds.includes(config.guildId)) {
        return res.status(403).json({ error: 'Not authorized for this guild' });
    }
    await getConfigManager().disabledCommandManager.remove({id});
    // Audit log
    console.log(`[AUDIT] User ${discordId} enabled command '${config.commandName}' for guild ${config.guildId} at ${new Date().toISOString()}`);
    res.json({success: true});
});

/**
 * @openapi
 * /disabledCommands/guild/{guildId}:
 *   get:
 *     summary: List all disabled commands for a specific guild
 *     tags: [DisabledCommands]
 *     parameters:
 *       - in: path
 *         name: guildId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of disabled commands for the guild
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/DisabledCommandConfig'
 */
router.get('/guild/:guildId', async (req, res) => {
    const { guildId } = req.params;
    if (!guildId) return res.status(400).json({ error: 'guildId required' });
    const configs = await getConfigManager().disabledCommandManager.getAllPlain();
    const filtered = configs.filter(c => c.guildId === String(guildId));
    res.json(filtered);
});

export default router;