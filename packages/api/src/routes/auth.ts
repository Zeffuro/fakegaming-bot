import { createBaseRouter } from '../utils/createBaseRouter.js';
import { exchangeCodeForToken, fetchDiscordUser, issueJwt } from '@zeffuro/fakegaming-common/discord';
import { z } from 'zod';
import { validateBody } from '@zeffuro/fakegaming-common';

// Constants
const JWT_AUDIENCE = process.env.JWT_AUDIENCE || 'fakegaming-dashboard';

// Schemas
const loginBodySchema = z.object({
    code: z.string().min(1)
});

// Router
const router = createBaseRouter();

/**
 * @openapi
 * /auth/login:
 *   post:
 *     summary: Login and get a JWT token
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               code:
 *                 type: string
 *           example:
 *             code: your_discord_oauth_code
 *     responses:
 *       200:
 *         description: JWT token and user info
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     username:
 *                       type: string
 *                     discriminator:
 *                       type: string
 *                     avatar:
 *                       type: string
 *                 guilds:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       name:
 *                         type: string
 *                       icon:
 *                         type: string
 */
router.post('/login', validateBody(loginBodySchema), async (req, res) => {
    const { code } = req.body as { code: string };
    try {
        const tokenData = await exchangeCodeForToken(
            code,
            process.env.DISCORD_CLIENT_ID!,
            process.env.DISCORD_CLIENT_SECRET!,
            process.env.DISCORD_REDIRECT_URI!
        );
        const accessToken = tokenData.access_token as string | undefined;
        if (!accessToken) {
            return res.status(401).json({ error: 'Invalid Discord OAuth code' });
        }
        const user = await fetchDiscordUser(accessToken);
        const jwtToken = issueJwt(user, process.env.JWT_SECRET!, JWT_AUDIENCE);
        res.json({ token: jwtToken, user });
    } catch (err) {
        console.error('Error in /auth/login:', err);
        res.status(500).json({ error: 'Failed to authenticate with Discord' });
    }
});

export { router };
