import { createBaseRouter } from '../utils/createBaseRouter.js';
import { getConfigManager } from '@zeffuro/fakegaming-common/managers';
import { jwtAuth } from '../middleware/auth.js';
import { validateBodyForModel, validateParams } from '@zeffuro/fakegaming-common';
import { DisabledCommandConfig } from '@zeffuro/fakegaming-common/models';
import { z } from 'zod';

const router = createBaseRouter();

// ✨ Single source of truth - params/query via zod; body via model schema lazily
const idParamSchema = z.object({ id: z.coerce.number() });
const checkQuerySchema = z.object({
    guildId: z.string().min(1),
    commandName: z.string().min(1)
});
const listQuerySchema = z.object({ guildId: z.string().min(1).optional() });

/**
 * @openapi
 * /disabledCommands:
 *   get:
 *     summary: List disabled commands (optionally filtered by guild)
 *     tags: [DisabledCommands]
 *     parameters:
 *       - in: query
 *         name: guildId
 *         required: false
 *         schema:
 *           type: string
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
    const parsed = listQuerySchema.safeParse(req.query);
    if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid query' });
    }
    const guildId = parsed.data.guildId;
    const disabledCommands = guildId
        ? await getConfigManager().disabledCommandManager.getManyPlain({ guildId })
        : await getConfigManager().disabledCommandManager.getAllPlain();
    res.json(disabledCommands);
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
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Command disabled status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 disabled:
 *                   type: boolean
 *       400:
 *         description: Missing or invalid query parameters
 */
router.get('/check', jwtAuth, async (req, res) => {
    const parsed = checkQuerySchema.safeParse(req.query);
    if (!parsed.success) {
        return res.status(400).json({ error: 'Missing or invalid query parameters' });
    }
    const { guildId, commandName } = parsed.data;
    const exists = await getConfigManager().disabledCommandManager.exists({ guildId, commandName });
    res.json({ disabled: exists });
});

/**
 * @openapi
 * /disabledCommands/{id}:
 *   get:
 *     summary: Get a disabled command by id
 *     tags: [DisabledCommands]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Disabled command config
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DisabledCommandConfig'
 *       404:
 *         description: Not found
 */
router.get('/:id', validateParams(idParamSchema), async (req, res) => {
    const { id } = req.params;
    const disabledCommand = await getConfigManager().disabledCommandManager.findByPkPlain(Number(id));
    if (!disabledCommand) return res.status(404).json({ error: 'Disabled command not found' });
    res.json(disabledCommand);
});

/**
 * @openapi
 * /disabledCommands:
 *   post:
 *     summary: Add a new disabled command
 *     tags: [DisabledCommands]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/DisabledCommandConfig'
 *     responses:
 *       201:
 *         description: Created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DisabledCommandConfig'
 */
router.post('/', jwtAuth, validateBodyForModel(DisabledCommandConfig, 'create'), async (req, res) => {
    const created = await getConfigManager().disabledCommandManager.addPlain(req.body);
    res.status(201).json(created);
});

/**
 * @openapi
 * /disabledCommands/{id}:
 *   delete:
 *     summary: Delete a disabled command by id
 *     tags: [DisabledCommands]
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
 */
router.delete('/:id', jwtAuth, validateParams(idParamSchema), async (req, res) => {
    const { id } = req.params;
    await getConfigManager().disabledCommandManager.removeByPk(Number(id));
    res.json({ success: true });
});

export { router };
