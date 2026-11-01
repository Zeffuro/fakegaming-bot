import type { Request, Response } from 'express';
import { z } from 'zod';
import { getConfigManager, SubmissionError, submissionCategoryInputSchema, submissionCategoryUpdateSchema,
    type SubmissionCategoryInput } from '@zeffuro/fakegaming-common';
import { jwtAuth } from '../middleware/auth.js';
import { createBaseRouter } from '../utils/createBaseRouter.js';
import { requireGuildAdmin } from '../utils/authHelpers.js';
import { validateBody, validateParams } from '../localization/validation.js';
import { apiText, requestLocale } from '../localization/locale.js';
import { recordAuditEvent } from '../utils/audit.js';
import { getSubmissionOptions, SubmissionConfigError, validateSubmissionConfig } from '../utils/submissionConfig.js';
import type { ApiCopyKey } from '../localization/catalog.js';

const router = createBaseRouter();
const params = z.object({ guildId: z.string().regex(/^\d{1,32}$/) });
const categoryParams = params.extend({ categoryId: z.string().uuid() });
const errorKeys: Record<string, ApiCopyKey> = {
    'invalid-category': 'submissionInvalidCategory', 'category-limit': 'submissionCategoryLimit',
    stale: 'submissionStale', 'provider-unavailable': 'submissionProviderUnavailable',
    'invalid-channel': 'submissionInvalidChannel', 'invalid-role': 'submissionInvalidRole',
    'review-access': 'submissionReviewAccess', 'destination-write': 'submissionDestinationWrite',
    'bot-permissions': 'submissionBotPermissions', 'reviewer-access': 'submissionReviewerAccess',
};

router.use(jwtAuth, (_req, res, next) => {
    res.set('Cache-Control', 'private, no-store').vary('Accept-Language');
    next();
});

async function safely(req: Request, res: Response, operation: () => Promise<void>): Promise<void> {
    try { await operation(); } catch (error) {
        if (!(error instanceof SubmissionError) && !(error instanceof SubmissionConfigError)) throw error;
        const key = errorKeys[error.code] ?? 'submissionInvalidCategory';
        res.status(error.code === 'stale' ? 409 : error.code === 'provider-unavailable' ? 503 : 400).json({
            error: { code: error.code.toUpperCase().replaceAll('-', '_'), message: apiText(requestLocale(req), key) },
        });
    }
}

/**
 * @openapi
 * /submissions/{guildId}/options:
 *   get:
 *     summary: List Discord channel and role choices for submission configuration
 *     tags: [Submissions]
 *     parameters:
 *       - { in: path, name: guildId, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Channel and role names without member or permission data
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SubmissionOptions' }
 */
router.get('/:guildId/options', validateParams(params), requireGuildAdmin, async (req, res) => {
    await safely(req, res, async () => {
        const options = await getSubmissionOptions(req.params.guildId as string);
        res.json({ roles: options.roles.map(({ id, name, managed }) => ({ id, name, managed })),
            channels: options.channels.map(({ id, name, type }) => ({ id, name, type })) });
    });
});

/**
 * @openapi
 * /submissions/{guildId}/categories:
 *   get:
 *     summary: List submission categories for a guild administrator
 *     tags: [Submissions]
 *     parameters:
 *       - { in: path, name: guildId, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Submission category configuration without submitted content
 *         content:
 *           application/json:
 *             schema: { type: array, items: { $ref: '#/components/schemas/SubmissionCategory' } }
 *   post:
 *     summary: Create a submission category after verifying Discord channel privacy
 *     tags: [Submissions]
 *     parameters:
 *       - { in: path, name: guildId, required: true, schema: { type: string } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/SubmissionCategoryInput' }
 *     responses:
 *       201:
 *         description: Category created
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SubmissionCategory' }
 * /submissions/{guildId}/categories/{categoryId}:
 *   put:
 *     summary: Update a submission category with an expected version
 *     tags: [Submissions]
 *     parameters:
 *       - { in: path, name: guildId, required: true, schema: { type: string } }
 *       - { in: path, name: categoryId, required: true, schema: { type: string, format: uuid } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/SubmissionCategoryUpdate' }
 *     responses:
 *       200:
 *         description: Category updated
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SubmissionCategory' }
 *       409: { description: Category was edited concurrently }
 */
router.get('/:guildId/categories', validateParams(params), requireGuildAdmin, async (req, res) => {
    res.json(await getConfigManager().submissionManager.listCategories(req.params.guildId as string));
});

router.post('/:guildId/categories', validateParams(params), validateBody(submissionCategoryInputSchema), requireGuildAdmin, async (req, res) => {
    await save(req, res, undefined);
});

router.put('/:guildId/categories/:categoryId', validateParams(categoryParams), validateBody(submissionCategoryUpdateSchema), requireGuildAdmin, async (req, res) => {
    await save(req, res, req.params.categoryId as string);
});

async function save(req: Request, res: Response, id: string | undefined): Promise<void> {
    await safely(req, res, async () => {
        const guildId = req.params.guildId as string;
        const { expectedVersion, ...input } = req.body as SubmissionCategoryInput & { expectedVersion?: number };
        // Disabling must remain possible if Discord configuration has already changed.
        if (input.enabled) await validateSubmissionConfig(guildId, input);
        const category = await getConfigManager().submissionManager.saveCategory(guildId, input, id, expectedVersion);
        await recordAuditEvent(req, { action: id ? 'submission.category.update' : 'submission.category.create',
            targetType: 'submissionCategory', targetId: category.id, guildId,
            metadata: { enabled: category.enabled, destinationChannelId: category.destinationChannelId, reviewChannelId: category.reviewChannelId } });
        res.status(id ? 200 : 201).json(category);
    });
}

export { router };
