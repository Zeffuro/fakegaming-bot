import {Router} from 'express';
import {getConfigManager, cacheGet} from '@zeffuro/fakegaming-common';
import {jwtAuth} from '../middleware/auth.js';
import { getStringQueryParam, isGuildAdmin } from '../utils/requestHelpers.js';
import type { AuthenticatedRequest } from '../types/express.js';

const router = Router();

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
router.get('/', async (req, res) => {
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
router.get('/search', jwtAuth, async (req: any, res: any) => {
    try {
        const { discordId } = (req as AuthenticatedRequest).user;
        const guildId = req.query.guildId;
        const text = req.query.text;
        if (!guildId || !text) return res.status(400).json({error: 'guildId and text required'});
        const cacheKey = `user:${discordId}:guilds`;
        const guilds = await cacheGet(cacheKey);
        if (!guilds) {
            return res.status(503).json({ error: 'Redis unavailable or guilds not cached for user' });
        }
        if (!guilds.includes(guildId)) {
            return res.status(403).json({ error: 'Not authorized for this guild' });
        }
        const quotes = await getConfigManager().quoteManager.searchQuotes({
            guildId: String(guildId),
            text: String(text)
        });
        res.json(quotes);
    } catch (err) {
        console.error('Error in /quotes/search:', err);
        res.status(500).json({error: 'Internal server error'});
    }
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
router.get('/guild/:guildId', jwtAuth, async (req: any, res: any) => {
    const { discordId } = (req as AuthenticatedRequest).user;
    const guildId = getStringQueryParam(req.params, 'guildId');
    if (!guildId) return res.status(400).json({ error: 'Missing guildId parameter' });
    const cacheKey = `user:${discordId}:guilds`;
    const guilds = await cacheGet(cacheKey);
    if (!guilds) {
        return res.status(503).json({ error: 'Redis unavailable or guilds not cached for user' });
    }
    if (!guilds.includes(guildId)) {
        return res.status(403).json({ error: 'Not authorized for this guild' });
    }
    const quotes = await getConfigManager().quoteManager.getQuotesByGuild({guildId});
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
router.get('/guild/:guildId/author/:authorId', async (req, res) => {
    const { guildId, authorId } = req.params;
    if (!guildId || !authorId) return res.status(400).json({ error: 'Missing guildId or authorId parameter' });
    const quotes = await getConfigManager().quoteManager.getQuotesByAuthor({ guildId, authorId });
    res.json(quotes);
});

/**
 * @openapi
 * /quotes:
 *   post:
 *     summary: Add a new quote
 *     tags: [Quotes]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/QuoteConfig'
 *     responses:
 *       201:
 *         description: Created
 */
router.post('/', jwtAuth, async (req, res) => {
    const created = await getConfigManager().quoteManager.addPlain(req.body);
    res.status(201).json(created);
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
 *     responses:
 *       200:
 *         description: Success
 *       404:
 *         description: Not found
 */
router.delete('/:id', jwtAuth, async (req, res) => {
    const { id } = req.params;
    if (!id) return res.status(400).json({ error: 'Missing id parameter' });
    const count = await getConfigManager().quoteManager.remove({id});
    if (count === 0) return res.status(404).json({error: 'Quote not found'});
    res.json({success: true});
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
 *         description: A quote object
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/QuoteConfig'
 *       404:
 *         description: Quote not found
 */
router.get('/:id', async (req, res) => {
    const { id } = req.params;
    if (!id) return res.status(400).json({ error: 'Missing id parameter' });
    const quote = await getConfigManager().quoteManager.findByPkPlain(id);
    if (!quote) return res.status(404).json({error: 'Quote not found'});
    res.json(quote);
});

export default router;