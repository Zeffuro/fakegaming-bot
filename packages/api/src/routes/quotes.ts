import {Router} from 'express';
import {getConfigManager} from '@zeffuro/fakegaming-common/managers';
import {jwtAuth} from '../middleware/auth.js';
import {checkUserGuildAccess} from '../utils/authHelpers.js';
import { getStringQueryParam } from '../utils/requestHelpers.js';

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
 */
router.get('/search', jwtAuth, async (req, res) => {
    try {
        const guildId = req.query.guildId as string;
        const text = req.query.text as string;
        if (!guildId || !text) return res.status(400).json({error: 'guildId and text required'});

        const accessResult = await checkUserGuildAccess(req, res, guildId);
        if (!accessResult.authorized) {
            return;
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
 */
router.get('/guild/:guildId', jwtAuth, async (req, res) => {
    const guildId = getStringQueryParam(req.params, 'guildId');
    if (!guildId) return res.status(400).json({ error: 'Missing guildId parameter' });

    const accessResult = await checkUserGuildAccess(req, res, guildId);
    if (!accessResult.authorized) {
        return;
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
 */
router.get('/guild/:guildId/author/:authorId', jwtAuth, async (req, res) => {
    const { guildId, authorId } = req.params;
    if (!guildId || !authorId) return res.status(400).json({ error: 'Missing guildId or authorId parameter' });

    const accessResult = await checkUserGuildAccess(req, res, guildId);
    if (!accessResult.authorized) {
        return;
    }

    const quotes = await getConfigManager().quoteManager.getQuotesByAuthor({ guildId, authorId });
    res.json(quotes);
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
 */
router.post('/', jwtAuth, async (req, res) => {
    const { guildId } = req.body;

    if (guildId) {
        const accessResult = await checkUserGuildAccess(req, res, guildId);
        if (!accessResult.authorized) {
            return;
        }
    }

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
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 *       404:
 *         description: Not found
 */
router.delete('/:id', jwtAuth, async (req, res) => {
    const { id } = req.params;

    if (!id) return res.status(400).json({ error: 'Missing id parameter' });

    const quote = await getConfigManager().quoteManager.findByPkPlain(id);
    if (!quote) {
        return res.status(404).json({error: 'Quote not found'});
    }

    if (quote.guildId) {
        const accessResult = await checkUserGuildAccess(req, res, quote.guildId);
        if (!accessResult.authorized) {
            return;
        }
    }

    await getConfigManager().quoteManager.remove({id});

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