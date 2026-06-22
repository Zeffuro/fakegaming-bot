import { z } from 'zod';
import {
    getConfigManager,
    validateBody,
    validateParams,
} from '@zeffuro/fakegaming-common';
import {
    userNoteCreateRequestSchema,
    userNoteUpdateRequestSchema,
} from '@zeffuro/fakegaming-common/api';
import type { UserNoteRecord } from '@zeffuro/fakegaming-common/managers';
import { createBaseRouter } from '../utils/createBaseRouter.js';
import type { AuthenticatedRequest } from '../types/express.js';

const router = createBaseRouter();

const noteIdParamSchema = z.object({
    id: z.string().trim().min(1).max(255),
}).strict();

function getAuthenticatedDiscordId(req: AuthenticatedRequest): string {
    return req.user.discordId;
}

function serializeNote(note: UserNoteRecord) {
    return {
        ...note,
        pinned: toBoolean((note as { pinned?: unknown }).pinned),
        createdAt: toIsoString((note as { createdAt?: unknown }).createdAt),
        updatedAt: toIsoString((note as { updatedAt?: unknown }).updatedAt),
    };
}

function toBoolean(value: unknown): boolean {
    return value === true || value === 1 || value === '1';
}

function toIsoString(value: unknown): string | null {
    if (!value) return null;
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'string' || typeof value === 'number') {
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toISOString();
    }
    return null;
}

/**
 * @openapi
 * /userNotes:
 *   get:
 *     summary: List notes for the authenticated dashboard user
 *     tags: [UserNotes]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Personal notes
 */
router.get('/', async (req, res) => {
    const discordId = getAuthenticatedDiscordId(req as AuthenticatedRequest);
    const notes = await getConfigManager().userNoteManager.listForUser(discordId);
    res.json({ notes: notes.map(serializeNote) });
});

/**
 * @openapi
 * /userNotes:
 *   post:
 *     summary: Create a note for the authenticated dashboard user
 *     tags: [UserNotes]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UserNoteCreateRequest'
 *     responses:
 *       201:
 *         description: Created note
 */
router.post('/', validateBody(userNoteCreateRequestSchema), async (req, res) => {
    const discordId = getAuthenticatedDiscordId(req as AuthenticatedRequest);
    const body = req.body as z.infer<typeof userNoteCreateRequestSchema>;
    const note = await getConfigManager().userNoteManager.createForUser({
        discordId,
        title: body.title,
        body: body.body ?? '',
        pinned: body.pinned,
    });
    res.status(201).json(serializeNote(note));
});

/**
 * @openapi
 * /userNotes/{id}:
 *   get:
 *     summary: Get one note for the authenticated dashboard user
 *     tags: [UserNotes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Personal note
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get('/:id', validateParams(noteIdParamSchema), async (req, res) => {
    const discordId = getAuthenticatedDiscordId(req as AuthenticatedRequest);
    const { id } = req.params as z.infer<typeof noteIdParamSchema>;
    const note = await getConfigManager().userNoteManager.getForUser(id, discordId);
    if (!note) {
        res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Note not found' } });
        return;
    }
    res.json(serializeNote(note));
});

/**
 * @openapi
 * /userNotes/{id}:
 *   put:
 *     summary: Update one note for the authenticated dashboard user
 *     tags: [UserNotes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UserNoteUpdateRequest'
 *     responses:
 *       200:
 *         description: Updated note
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.put('/:id', validateParams(noteIdParamSchema), validateBody(userNoteUpdateRequestSchema), async (req, res) => {
    const discordId = getAuthenticatedDiscordId(req as AuthenticatedRequest);
    const { id } = req.params as z.infer<typeof noteIdParamSchema>;
    const note = await getConfigManager().userNoteManager.updateForUser(id, discordId, req.body as z.infer<typeof userNoteUpdateRequestSchema>);
    if (!note) {
        res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Note not found' } });
        return;
    }
    res.json(serializeNote(note));
});

/**
 * @openapi
 * /userNotes/{id}:
 *   delete:
 *     summary: Delete one note for the authenticated dashboard user
 *     tags: [UserNotes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Deleted
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.delete('/:id', validateParams(noteIdParamSchema), async (req, res) => {
    const discordId = getAuthenticatedDiscordId(req as AuthenticatedRequest);
    const { id } = req.params as z.infer<typeof noteIdParamSchema>;
    const deleted = await getConfigManager().userNoteManager.removeForUser(id, discordId);
    if (!deleted) {
        res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Note not found' } });
        return;
    }
    res.json({ success: true });
});

export { router };
