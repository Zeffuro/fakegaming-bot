import { createBaseRouter } from '../utils/createBaseRouter.js';
import { exchangeCodeForToken, fetchDiscordUser, issueJwt } from '@zeffuro/fakegaming-common/discord';
import { z } from 'zod';
import { validateBody } from '@zeffuro/fakegaming-common';
import { skipCsrf } from '../middleware/csrf.js';
import { getLogger } from '@zeffuro/fakegaming-common';

function requireEnv(name: string): string {
    const val = process.env[name];
    if (!val || val.trim() === '') {
        throw new Error(`[auth] Missing required environment variable: ${name}`);
    }
    return val;
}

// Schemas
const loginBodySchema = z.object({
    code: z.string().min(1)
});

// Router
const router = createBaseRouter();
const log = getLogger({ name: 'api:auth' });

/**
 * @openapi
 * /auth/login:
 *   post:
 *     summary: Login and get a JWT token
 *     tags: [Auth]
 *     security: []
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
 *       400:
 *         description: Body validation failed
 *       401:
 *         description: Invalid Discord OAuth code
 *       500:
 *         description: Failed to authenticate with Discord
 */
router.post('/login', skipCsrf, validateBody(loginBodySchema), async (req, res) => {
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
            return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Invalid Discord OAuth code' } });
        }
        const user = await fetchDiscordUser(accessToken);
        const secret = requireEnv('JWT_SECRET');
        const audience = requireEnv('JWT_AUDIENCE');
        const issuer = requireEnv('JWT_ISSUER');
        const jwtToken = issueJwt(user, secret, audience, issuer);
        res.json({ token: jwtToken, user });
    } catch (err) {
        log.error({ err }, 'Error in /auth/login');
        res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to authenticate with Discord' } });
    }
});

export { router };
