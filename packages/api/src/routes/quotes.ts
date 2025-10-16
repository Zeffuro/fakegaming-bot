import { createBaseRouter } from '../utils/createBaseRouter.js';
import { getConfigManager } from '@zeffuro/fakegaming-common/managers';
import { jwtAuth } from '../middleware/auth.js';
import { checkUserGuildAccess } from '../utils/authHelpers.js';
import { validateBodyForModel, validateParams, validateQuery } from '@zeffuro/fakegaming-common';
import { QuoteConfig } from '@zeffuro/fakegaming-common/models';
import { z } from 'zod';
import { UniqueConstraintError } from 'sequelize';
import { randomUUID } from 'node:crypto';

// Zod schemas
const idParamSchema = z.object({ id: z.string().min(1) });
const guildIdParamSchema = z.object({ guildId: z.string().min(1) });
const guildAuthorParamSchema = z.object({
    guildId: z.string().min(1),
    authorId: z.string().min(1)
});
const searchQuerySchema = z.object({
    guildId: z.string().min(1),
    text: z.string().min(1)
});

// Router
const router = createBaseRouter();

/**
 * @openapi
 * /quotes:
 *   get:
 *     summary: List all quotes
 *     tags: [Quotes]
 *     responses:
 *       200:
 *         description: List of quotes
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/QuoteConfig'
 */
router.get('/', async (_req, res) => {
    const quotes = await getConfigManager().quoteManager.getAllPlain();
    res.json(quotes);
});

/**
 * @openapi
 * /quotes/search:
 *   get:
 *     summary: Search quotes by text and guildId
 *     tags: [Quotes]
 *     parameters:
 *       - in: query
 *         name: guildId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: text
 *         required: true
 *         schema:
 *           type: string
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of quotes
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/QuoteConfig'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get('/search', jwtAuth, validateQuery(searchQuerySchema), async (req, res) => {
    const { guildId, text } = req.query as z.infer<typeof searchQuerySchema>;
    const accessResult = await checkUserGuildAccess(req, res, guildId);
    if (!accessResult.authorized) return;
    const quotes = await getConfigManager().quoteManager.searchQuotes(guildId, text);
    res.json(quotes);
});

/**
 * @openapi
 * /quotes/guild/{guildId}:
 *   get:
 *     summary: Get quotes by guild
 *     tags: [Quotes]
 *     parameters:
 *       - in: path
 *         name: guildId
 *         required: true
 *         schema:
 *           type: string
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of quotes
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/QuoteConfig'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get('/guild/:guildId', jwtAuth, validateParams(guildIdParamSchema), async (req, res) => {
    const { guildId } = req.params;
    const accessResult = await checkUserGuildAccess(req, res, guildId);
    if (!accessResult.authorized) return;
    const quotes = await getConfigManager().quoteManager.getQuotesByGuild(guildId);
    res.json(quotes);
});

/**
 * @openapi
 * /quotes/guild/{guildId}/author/{authorId}:
 *   get:
 *     summary: Get quotes by author in guild
 *     tags: [Quotes]
 *     parameters:
 *       - in: path
 *         name: guildId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: authorId
 *         required: true
 *         schema:
 *           type: string
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of quotes
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/QuoteConfig'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get('/guild/:guildId/author/:authorId', jwtAuth, validateParams(guildAuthorParamSchema), async (req, res) => {
    const { guildId, authorId } = req.params;
    const accessResult = await checkUserGuildAccess(req, res, guildId);
    if (!accessResult.authorized) return;
    const quotes = await getConfigManager().quoteManager.getQuotesByAuthor(guildId, authorId);
    res.json(quotes);
});

/**
 * @openapi
 * /quotes/{id}:
 *   get:
 *     summary: Get a quote by id
 *     tags: [Quotes]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Quote config
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get('/:id', validateParams(idParamSchema), async (req, res) => {
    const { id } = req.params;
    const quote = await getConfigManager().quoteManager.findByPkPlain(id);
    if (!quote) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Quote not found' } });
    res.json(quote);
});

/**
 * @openapi
 * /quotes:
 *   post:
 *     summary: Add a new quote
 *     tags: [Quotes]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/QuoteConfig'
 *     responses:
 *       201:
 *         description: Created
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       409:
 *         $ref: '#/components/responses/Conflict'
 */
router.post('/', jwtAuth, validateBodyForModel(QuoteConfig, 'create'), async (req, res) => {
    const body = req.body as Partial<QuoteConfig>;
    const { guildId } = body as { guildId?: string };
    if (guildId) {
        const accessResult = await checkUserGuildAccess(req, res, guildId);
        if (!accessResult.authorized) return;
    }

    try {
        // Derive submitterId from JWT; ignore client-provided field
        const jwtUser = (req as any).user as { discordId?: string } | undefined;
        const submitterId = jwtUser?.discordId ?? undefined;
        const id = (body as any).id && String((body as any).id).length > 0 ? String((body as any).id) : randomUUID();

        const payload = {
            id,
            guildId: String((body as any).guildId ?? ''),
            quote: String((body as any).quote ?? ''),
            authorId: String((body as any).authorId ?? ''),
            submitterId: submitterId ?? String((body as any).submitterId ?? ''),
            timestamp: Number((body as any).timestamp)
        } as unknown as QuoteConfig;

        const created = await getConfigManager().quoteManager.addPlain(payload as any);
        res.status(201).json(created);
    } catch (error) {
        if (error instanceof UniqueConstraintError) {
            res.status(409).json({ error: { code: 'CONFLICT', message: 'Quote with this ID already exists' } });
        } else {
            throw error;
        }
    }
});

/**
 * @openapi
 * /quotes/{id}:
 *   delete:
 *     summary: Delete a quote by id
 *     tags: [Quotes]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.delete('/:id', jwtAuth, validateParams(idParamSchema), async (req, res) => {
    const { id } = req.params;
    const quote = await getConfigManager().quoteManager.findByPkPlain(id);
    if (!quote) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Quote not found' } });
    if (quote.guildId) {
        const accessResult = await checkUserGuildAccess(req, res, quote.guildId);
        if (!accessResult.authorized) return;
    }
    await getConfigManager().quoteManager.removeByPk(id);
    res.json({ success: true });
});

export { router };
