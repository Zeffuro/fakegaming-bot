import {Router} from 'express';
import {getConfigManager} from '@zeffuro/fakegaming-common';

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
router.get('/search', async (req, res) => {
    try {
        const {guildId, text} = req.query;
        if (!guildId || !text) return res.status(400).json({error: 'guildId and text required'});
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
router.get('/guild/:guildId', async (req, res) => {
    const quotes = await getConfigManager().quoteManager.getQuotesByGuild({guildId: req.params.guildId});
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
    const quotes = await getConfigManager().quoteManager.getQuotesByAuthor({
        guildId: req.params.guildId,
        authorId: req.params.authorId
    });
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
router.post('/', async (req, res) => {
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
router.delete('/:id', async (req, res) => {
    const count = await getConfigManager().quoteManager.remove({id: req.params.id});
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
    const quote = await getConfigManager().quoteManager.findByPkPlain(req.params.id);
    if (!quote) return res.status(404).json({error: 'Quote not found'});
    res.json(quote);
});

export default router;