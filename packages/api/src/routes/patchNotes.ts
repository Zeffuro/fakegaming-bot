import { z } from 'zod';
import { getConfigManager } from '@zeffuro/fakegaming-common/managers';
import { validateBody, validateParams } from '@zeffuro/fakegaming-common';
import { createBaseRouter } from '../utils/createBaseRouter.js';
import { jwtAuth } from '../middleware/auth.js';

// Zod schemas
const gameParamSchema = z.object({ game: z.string().min(1) });
const patchNoteCreateSchema = z.object({
    game: z.string().min(1),
    title: z.string().min(1),
    content: z.string().min(1),
    url: z.string().min(1),
    publishedAt: z.number().int(),
    version: z.string().min(1),
});

// Router
const router = createBaseRouter();

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
 *       400:
 *         description: Body validation failed
 *       401:
 *         description: Unauthorized
 */
router.post('/', jwtAuth, validateBody(patchNoteCreateSchema), async (req, res) => {
    await getConfigManager().patchNotesManager.setLatestPatch(req.body);
    res.status(201).json({ success: true });
});

export { router };
