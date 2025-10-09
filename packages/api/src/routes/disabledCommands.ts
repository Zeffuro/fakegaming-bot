import { createBaseRouter } from '../utils/createBaseRouter.js';
import { getConfigManager } from '@zeffuro/fakegaming-common/managers';
import { jwtAuth } from '../middleware/auth.js';
import { validateBodyForModel, validateParams, validateQuery } from '@zeffuro/fakegaming-common';
import { DisabledCommandConfig } from '@zeffuro/fakegaming-common/models';
import { z } from 'zod';

// Zod schemas
const idParamSchema = z.object({ id: z.coerce.number().int() });
const checkQuerySchema = z.object({
    guildId: z.string().min(1),
    commandName: z.string().min(1)
});
const listQuerySchema = z.object({ guildId: z.string().min(1).optional() });

// Router
const router = createBaseRouter();

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
router.get('/', validateQuery(listQuerySchema), async (req, res) => {
    const guildId = (req.query as Record<string, unknown>).guildId as string | undefined;
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
router.get('/check', jwtAuth, validateQuery(checkQuerySchema), async (req, res) => {
    const { guildId, commandName } = req.query as unknown as { guildId: string; commandName: string };
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
 *       404:
 *         description: Not found
 */
router.delete('/:id', jwtAuth, validateParams(idParamSchema), async (req, res) => {
    const { id } = req.params;
    const numericId = Number(id);
    const existing = await getConfigManager().disabledCommandManager.findByPkPlain(numericId);
    if (!existing) return res.status(404).json({ error: 'Disabled command not found' });
    await getConfigManager().disabledCommandManager.removeByPk(numericId);
    res.json({ success: true });
});

export { router };
