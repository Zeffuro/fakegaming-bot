import { z } from 'zod';
import {
    getConfigManager,
    isSupportedOutputLocale,
    type SupportedOutputLocale,
} from '@zeffuro/fakegaming-common';
import { validateBody, validateParams, validateQuery } from '../localization/validation.js';
import {
    userNoteCreateRequestSchema,
    userNoteUpdateRequestSchema,
    userNoteInboxQuerySchema,
} from '@zeffuro/fakegaming-common/api';
import { PersonalError, type UserNoteRecord } from '@zeffuro/fakegaming-common/managers';
import { createBaseRouter } from '../utils/createBaseRouter.js';
import type { AuthenticatedRequest } from '../types/express.js';
import { sendLocalizedError } from '../localization/responses.js';
import {requestLocale} from '../localization/locale.js';

const router = createBaseRouter();

const noteIdParamSchema = z.object({
    id: z.string().trim().min(1).max(255),
}).strict();

const noteTaskBodySchema = z.object({
    title: z.string().trim().min(1).max(120),
    due: z.string().trim().max(100).nullable().optional(),
    timezone: z.string().trim().min(1).max(100).optional(),
}).strict();

function getAuthenticatedDiscordId(req: AuthenticatedRequest): string {
    return req.user.discordId;
}

async function resolveNoteLocale(req: AuthenticatedRequest, discordId: string): Promise<SupportedOutputLocale> {
    try {
        const user = await getConfigManager().userManager.getUser({discordId});
        if (isSupportedOutputLocale(user?.preferredLocale)) return user.preferredLocale;
    } catch {
        // The request locale is the safe fallback when user preferences are unavailable.
    }
    return requestLocale(req);
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
router.get('/', validateQuery(userNoteInboxQuerySchema), async (req, res) => {
    const discordId = getAuthenticatedDiscordId(req as AuthenticatedRequest);
    if (Object.keys(req.query).length > 0) {
        const inbox = await getConfigManager().userNoteManager.inboxForUser(discordId, userNoteInboxQuerySchema.parse(req.query));
        res.json({ ...inbox, notes: inbox.notes.map(serializeNote) });
        return;
    }
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
    const locale = await resolveNoteLocale(req as AuthenticatedRequest, discordId);
    const body = req.body as z.infer<typeof userNoteCreateRequestSchema>;
    const note = await getConfigManager().userNoteManager.createForUser({
        discordId,
        title: body.title,
        body: body.body ?? '',
        pinned: body.pinned,
        tags: body.tags,
        status: body.status,
        sourceUrl: body.sourceUrl,
        locale,
    });
    res.status(201).json(serializeNote(note));
});

/**
 * @openapi
 * /userNotes/{id}/task:
 *   post:
 *     summary: Create or retrieve the authenticated user's task linked to a note
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
 *             type: object
 *             required: [title]
 *             additionalProperties: false
 *             properties:
 *               title:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 120
 *               due:
 *                 type: string
 *                 nullable: true
 *                 maxLength: 100
 *                 description: Exact future date and time in the saved user timezone
 *               timezone:
 *                 type: string
 *                 description: Optional saved-timezone guard; cannot override user settings
 *     responses:
 *       201:
 *         description: Created linked task and created true
 *       200:
 *         description: Existing linked task and created false
 *       400:
 *         description: Invalid title or exact date
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       409:
 *         description: Linked task deleted or active task capacity reached
 */
router.post('/:id/task', validateParams(noteIdParamSchema), validateBody(noteTaskBodySchema), async (req, res) => {
    const discordId = getAuthenticatedDiscordId(req as AuthenticatedRequest);
    const { id } = req.params as z.infer<typeof noteIdParamSchema>;
    const body = req.body as z.infer<typeof noteTaskBodySchema>;
    try {
        const manager = getConfigManager();
        const timezone = (await manager.userManager.getUser({ discordId }))?.timezone?.trim() || 'UTC';
        if (body.timezone !== undefined && body.timezone !== timezone) throw new PersonalError('invalid');
        const result = await manager.userTaskManager.fromNote({ userId: discordId, noteId: id, title: body.title, due: body.due, timezone });
        res.status(result.created ? 201 : 200).json(result);
    } catch (error) {
        if (error instanceof PersonalError) {
            if (error.code === 'missing') sendLocalizedError(req, res, 404, 'NOT_FOUND', 'noteNotFound');
            else if (error.code === 'stale') sendLocalizedError(req, res, 409, 'NOTE_TASK_DELETED', 'noteTaskDeleted');
            else if (error.code === 'capacity') sendLocalizedError(req, res, 409, 'CAPACITY', 'noteTaskCapacity');
            else sendLocalizedError(req, res, 400, 'BAD_REQUEST', 'noteTaskInvalid');
            return;
        }
        sendLocalizedError(req, res, 500, 'INTERNAL_ERROR', 'noteTaskFailed');
    }
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
        sendLocalizedError(req, res, 404, 'NOT_FOUND', 'noteNotFound');
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
    const locale = await resolveNoteLocale(req as AuthenticatedRequest, discordId);
    const { id } = req.params as z.infer<typeof noteIdParamSchema>;
    const note = await getConfigManager().userNoteManager.updateForUser(id, discordId, {
        ...(req.body as z.infer<typeof userNoteUpdateRequestSchema>),
        locale,
    });
    if (!note) {
        sendLocalizedError(req, res, 404, 'NOT_FOUND', 'noteNotFound');
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
        sendLocalizedError(req, res, 404, 'NOT_FOUND', 'noteNotFound');
        return;
    }
    res.json({ success: true });
});

export { router };
