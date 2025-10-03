import {Router} from 'express';
import {getConfigManager} from '@zeffuro/fakegaming-common/managers';
import {jwtAuth} from '../middleware/auth.js';

const router = Router();

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
router.get('/', async (req, res) => {
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
router.get('/:game', async (req, res) => {
    const { game } = req.params;
    if (!game) return res.status(400).json({ error: 'Missing game parameter' });
    const note = await getConfigManager().patchNotesManager.getLatestPatch(game);
    if (!note) return res.status(404).json({error: 'Patch note not found'});
    res.json(note);
});

/**
 * @openapi
 * /patchNotes:
 *   post:
 *     summary: Upsert (add or update) a patch note
 *     tags: [PatchNotes]
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
router.post('/', jwtAuth, async (req, res) => {
    if (!req.body || !req.body.game || !req.body.patchVersion) {
        return res.status(400).json({ error: 'Missing required patch note fields' });
    }
    await getConfigManager().patchNotesManager.setLatestPatch(req.body);
    res.status(201).json({success: true});
});

export default router;
