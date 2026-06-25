import { z } from 'zod';
import { getConfigManager } from '@zeffuro/fakegaming-common/managers';
import { validateBody, validateParams, validateQuery } from '@zeffuro/fakegaming-common';
import { patchNoteCreateRequestSchema } from '@zeffuro/fakegaming-common/api';
import { createBaseRouter } from '../utils/createBaseRouter.js';
import { jwtAuth } from '../middleware/auth.js';
import { SUPPORTED_GAMES } from '@zeffuro/fakegaming-common';

// Zod schemas
const gameParamSchema = z.object({ game: z.string().min(1) });
const patchNoteHistoryQuerySchema = z.object({
    from: z.coerce.number().int().min(0).optional(),
    game: z.string().trim().min(1).max(64).optional(),
    limit: z.coerce.number().int().min(1).max(50).optional(),
    offset: z.coerce.number().int().min(0).max(10_000).optional(),
    q: z.string().trim().min(1).max(120).optional(),
    to: z.coerce.number().int().min(0).optional(),
}).strict();
const patchNoteHistoryCompareQuerySchema = z.object({
    leftId: z.coerce.number().int().min(1),
    rightId: z.coerce.number().int().min(1),
}).strict();

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
 * /patchNotes/supportedGames:
 *   get:
 *     summary: List supported games for patch notes
 *     tags: [PatchNotes]
 *     responses:
 *       200:
 *         description: An array of supported game names
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: string
 */
router.get('/supportedGames', (_req, res) => {
    res.json(SUPPORTED_GAMES);
});

/**
 * @openapi
 * /patchNotes/history/compare:
 *   get:
 *     summary: Compare two stored patch-note history records
 *     tags: [PatchNotes]
 *     parameters:
 *       - in: query
 *         name: leftId
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *       - in: query
 *         name: rightId
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *     responses:
 *       200:
 *         description: Deterministic line diff for the selected patch records
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get('/history/compare', validateQuery(patchNoteHistoryCompareQuerySchema), async (req, res) => {
    const query = req.query as unknown as z.infer<typeof patchNoteHistoryCompareQuerySchema>;
    const manager = getConfigManager().patchNoteHistoryManager;
    const [left, right] = await Promise.all([
        manager.getHistoryRecord(query.leftId),
        manager.getHistoryRecord(query.rightId),
    ]);

    if (left.game !== right.game) {
        return res.status(400).json({
            error: {
                code: 'BAD_REQUEST',
                message: 'Patch records must be from the same game',
            },
        });
    }

    res.json(manager.compareHistoryRecords(left, right));
});

/**
 * @openapi
 * /patchNotes/history:
 *   get:
 *     summary: List bounded patch-note history
 *     tags: [PatchNotes]
 *     parameters:
 *       - in: query
 *         name: game
 *         schema:
 *           type: string
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *       - in: query
 *         name: from
 *         schema:
 *           type: integer
 *       - in: query
 *         name: to
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           minimum: 0
 *           maximum: 10000
 *     responses:
 *       200:
 *         description: Paginated patch-note history records
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 */
router.get('/history', validateQuery(patchNoteHistoryQuerySchema), async (req, res) => {
    const query = req.query as z.infer<typeof patchNoteHistoryQuerySchema>;
    const result = await getConfigManager().patchNoteHistoryManager.listHistory({
        fromPublishedAt: query.from,
        game: query.game,
        limit: query.limit,
        offset: query.offset,
        query: query.q,
        toPublishedAt: query.to,
    });

    res.json({
        ...result,
        items: result.items.map(serializeHistoryRecord),
    });
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
 *         $ref: '#/components/responses/NotFound'
 */
router.get('/:game', validateParams(gameParamSchema), async (req, res) => {
    const { game } = req.params;
    const note = await getConfigManager().patchNotesManager.getLatestPatch(game as string);
    if (!note) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Patch note not found' } });
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
 *             $ref: '#/components/schemas/PatchNoteCreateRequest'
 *     responses:
 *       201:
 *         description: Created
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.post('/', jwtAuth, validateBody(patchNoteCreateRequestSchema), async (req, res) => {
    await getConfigManager().patchNotesManager.setLatestPatch(req.body);
    res.status(201).json({ success: true });
});

function serializeHistoryRecord(record: Record<string, unknown>) {
    const content = typeof record.content === 'string' ? record.content : '';
    return {
        accentColor: record.accentColor ?? null,
        contentBytes: Buffer.byteLength(content, 'utf8'),
        contentPreview: buildContentPreview(content),
        game: record.game,
        id: record.id,
        imageUrl: record.imageUrl ?? null,
        logoUrl: record.logoUrl ?? null,
        publishedAt: record.publishedAt,
        title: record.title,
        url: record.url,
        version: record.version ?? null,
    };
}

function buildContentPreview(content: string): string {
    const normalized = content.replace(/\s+/g, ' ').trim();
    return normalized.length > 360 ? `${normalized.slice(0, 357)}...` : normalized;
}

export { router };
