import { getConfigManager } from '@zeffuro/fakegaming-common/managers';
import { disabledCommandCreateRequestSchema } from '@zeffuro/fakegaming-common/api';
import { z } from 'zod';
import { createDisabledConfigRouter } from './disabledConfigRouteFactory.js';

const checkQuerySchema = z.object({
    guildId: z.string().min(1),
    commandName: z.string().min(1),
});

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
 *             $ref: '#/components/schemas/DisabledCommandCreateRequest'
 *     responses:
 *       201:
 *         description: Created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DisabledCommandConfig'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *
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
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *
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
 *         $ref: '#/components/responses/NotFound'
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
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
const router = createDisabledConfigRouter({
    getManager: () => getConfigManager().disabledCommandManager,
    createSchema: disabledCommandCreateRequestSchema,
    checkQuerySchema,
    nameField: 'commandName',
    notFoundMessage: 'Disabled command not found',
    auditTargetType: 'disabledCommand',
    auditDisableAction: 'command.disable',
    auditEnableAction: 'command.enable',
});

export { router };
