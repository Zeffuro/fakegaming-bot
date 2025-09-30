import {Router} from 'express';
import {getConfigManager} from '@zeffuro/fakegaming-common';
import {jwtAuth} from '../middleware/auth.js';

const router = Router();

/**
 * @openapi
 * /users:
 *   get:
 *     summary: List all users
 *     tags: [Users]
 *     responses:
 *       200:
 *         description: List of users
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/UserConfig'
 */
router.get('/', async (req, res) => {
    const users = await getConfigManager().userManager.getAllPlain();
    res.json(users);
});

/**
 * @openapi
 * /users/{discordId}:
 *   get:
 *     summary: Get a user by Discord ID
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: discordId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User config
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserConfig'
 *       404:
 *         description: Not found
 */
router.get('/:discordId', async (req, res) => {
    const { discordId } = req.params;
    if (!discordId) return res.status(400).json({ error: 'Missing discordId parameter' });
    const user = await getConfigManager().userManager.getUser({discordId});
    if (!user) return res.status(404).json({error: 'User not found'});
    res.json(user);
});

/**
 * @openapi
 * /users:
 *   post:
 *     summary: Create or update a user
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UserConfig'
 *     responses:
 *       201:
 *         description: Created
 */
router.post('/', jwtAuth, async (req, res) => {
    await getConfigManager().userManager.setUser(req.body);
    res.status(201).json({success: true});
});

/**
 * @openapi
 * /users/{discordId}/timezone:
 *   put:
 *     summary: Set a user's timezone
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: discordId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               timezone:
 *                 type: string
 *     responses:
 *       200:
 *         description: Success
 */
router.put('/:discordId/timezone', jwtAuth, async (req, res) => {
    await getConfigManager().userManager.setTimezone({discordId: req.params.discordId, timezone: req.body.timezone});
    res.json({success: true});
});

/**
 * @openapi
 * /users/{discordId}/defaultReminderTimeSpan:
 *   put:
 *     summary: Set a user's default reminder timespan
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: discordId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               timespan:
 *                 type: string
 *     responses:
 *       200:
 *         description: Success
 */
router.put('/:discordId/defaultReminderTimeSpan', jwtAuth, async (req, res) => {
    await getConfigManager().userManager.setDefaultReminderTimeSpan({
        discordId: req.params.discordId,
        timespan: req.body.timespan
    });
    res.json({success: true});
});

export default router;
