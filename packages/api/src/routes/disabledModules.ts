import { getConfigManager } from '@zeffuro/fakegaming-common/managers';
import { disabledModuleCreateRequestSchema } from '@zeffuro/fakegaming-common/api';
import { z } from 'zod';
import { createDisabledConfigRouter } from './disabledConfigRouteFactory.js';

const checkQuerySchema = z.object({
    guildId: z.string().min(1),
    moduleName: z.string().min(1),
});

/**
 * @openapi
 * /disabledModules:
 *   get:
 *     summary: List disabled modules (optionally filtered by guild)
 *     tags: [DisabledModules]
 *     parameters:
 *       - in: query
 *         name: guildId
 *         required: false
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of disabled modules
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/DisabledModuleConfig'
 *   post:
 *     summary: Add a new disabled module
 *     tags: [DisabledModules]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/DisabledModuleCreateRequest'
 *     responses:
 *       201:
 *         description: Created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DisabledModuleConfig'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *
 * /disabledModules/check:
 *   get:
 *     summary: Check if a module is disabled in a guild
 *     tags: [DisabledModules]
 *     parameters:
 *       - in: query
 *         name: guildId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: moduleName
 *         required: true
 *         schema:
 *           type: string
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Module disabled status
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
 * /disabledModules/{id}:
 *   get:
 *     summary: Get a disabled module by id
 *     tags: [DisabledModules]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Disabled module config
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DisabledModuleConfig'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *   delete:
 *     summary: Delete a disabled module by id
 *     tags: [DisabledModules]
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
    getManager: () => getConfigManager().disabledModuleManager,
    createSchema: disabledModuleCreateRequestSchema,
    checkQuerySchema,
    nameField: 'moduleName',
    notFoundMessage: 'Disabled module not found',
    auditTargetType: 'disabledModule',
    auditDisableAction: 'module.disable',
    auditEnableAction: 'module.enable',
});

export { router };
