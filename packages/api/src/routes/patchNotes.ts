import { createBaseRouter } from '../utils/createBaseRouter.js';
import { getConfigManager } from '@zeffuro/fakegaming-common/managers';
import { jwtAuth } from '../middleware/auth.js';
import { validateBodyForModel, validateParams } from '@zeffuro/fakegaming-common';
import { PatchNoteConfig } from '@zeffuro/fakegaming-common/models';
import { z } from 'zod';

const router = createBaseRouter();

// ✨ Single source of truth - params via zod; body via model lazily
const gameParamSchema = z.object({ game: z.string().min(1) });

/**
 * @openapi
 * /patchNotes:
 *   get:
 *     summary: List all patch notes
 *     tags: [PatchNotes]
 *     responses:
 *       200:
 *         description: List of patch notes
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/PatchNoteConfig'
 */
router.get('/', async (_req, res) => {
    const notes = await getConfigManager().patchNotesManager.getAllPlain();
    res.json(notes);
});

/**
 * @openapi
 * /patchNotes/{game}:
 *   get:
 *     summary: Get the latest patch note for a game
 *     tags: [PatchNotes]
 *     parameters:
 *       - in: path
 *         name: game
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Patch note config
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PatchNoteConfig'
 *       404:
 *         description: Not found
 */
router.get('/:game', validateParams(gameParamSchema), async (req, res) => {
    const { game } = req.params;
    const note = await getConfigManager().patchNotesManager.getLatestPatch(game);
    if (!note) return res.status(404).json({ error: 'Patch note not found' });
    res.json(note);
});

/**
 * @openapi
 * /patchNotes:
 *   post:
 *     summary: Upsert (add or update) a patch note
 *     tags: [PatchNotes]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PatchNoteConfig'
 *     responses:
 *       201:
 *         description: Created
 */
router.post('/', jwtAuth, validateBodyForModel(PatchNoteConfig, 'create'), async (req, res) => {
    // req.body is now fully validated and type-safe based on the model!
    await getConfigManager().patchNotesManager.setLatestPatch(req.body);
    res.status(201).json({ success: true });
});

export { router };
