import { createBaseRouter } from '../utils/createBaseRouter.js';
import { exchangeCodeForToken, fetchDiscordUser, issueJwt } from '@zeffuro/fakegaming-common/discord';
import { z } from 'zod';
import { validateBody } from '@zeffuro/fakegaming-common';
import { authLoginRequestSchema } from '@zeffuro/fakegaming-common/api';
import { skipCsrf } from '../middleware/csrf.js';
import { getLogger } from '@zeffuro/fakegaming-common';
import { requireEnv } from '../utils/env.js';

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
 *             $ref: '#/components/schemas/AuthLoginRequest'
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
router.post('/login', skipCsrf, validateBody(authLoginRequestSchema), async (req, res) => {
    const { code } = req.body as z.infer<typeof authLoginRequestSchema>;
    try {
        const tokenData = await exchangeCodeForToken(
            code,
            requireEnv('DISCORD_CLIENT_ID', {prefix: 'auth'}),
            requireEnv('DISCORD_CLIENT_SECRET', {prefix: 'auth'}),
            requireEnv('DISCORD_REDIRECT_URI', {prefix: 'auth'})
        );
        const accessToken = tokenData.access_token as string | undefined;
        if (!accessToken) {
            return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Invalid Discord OAuth code' } });
        }
        const user = await fetchDiscordUser(accessToken);
        const secret = requireEnv('JWT_SECRET', {prefix: 'auth'});
        const audience = requireEnv('JWT_AUDIENCE', {prefix: 'auth'});
        const issuer = requireEnv('JWT_ISSUER', {prefix: 'auth'});
        const jwtToken = issueJwt(user, secret, audience, issuer);
        res.json({ token: jwtToken, user });
    } catch (err) {
        log.error({ err }, 'Error in /auth/login');
        res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to authenticate with Discord' } });
    }
});

export { router };
