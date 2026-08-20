import { z } from 'zod';
import { getConfigManager, type SupportedOutputLocale } from '@zeffuro/fakegaming-common';
import { validateBody } from '../localization/validation.js';
import { userUpdateRequestSchema } from '@zeffuro/fakegaming-common/api';
import { createBaseRouter } from '../utils/createBaseRouter.js';
import type { AuthenticatedRequest } from '../types/express.js';

const router = createBaseRouter();

interface UserSettingsRecord {
    timezone?: string | null;
    defaultReminderTimeSpan?: string | null;
    preferredLocale?: SupportedOutputLocale | null;
}

function getAuthenticatedDiscordId(req: AuthenticatedRequest): string {
    return req.user.discordId;
}

function serializeSettings(discordId: string, user: UserSettingsRecord | null) {
    return {
        discordId,
        timezone: user?.timezone ?? null,
        defaultReminderTimeSpan: user?.defaultReminderTimeSpan ?? null,
        preferredLocale: user?.preferredLocale ?? null,
    };
}

/**
 * @openapi
 * /userSettings:
 *   get:
 *     summary: Get personal settings for the authenticated dashboard user
 *     tags: [UserSettings]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Personal user settings
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 discordId:
 *                   type: string
 *                 timezone:
 *                   type: string
 *                   nullable: true
 *                 defaultReminderTimeSpan:
 *                   type: string
 *                   nullable: true
 */
router.get('/', async (req, res) => {
    const discordId = getAuthenticatedDiscordId(req as AuthenticatedRequest);
    const user = await getConfigManager().userManager.getOnePlain({ discordId }) as UserSettingsRecord | null;
    res.json(serializeSettings(discordId, user));
});

/**
 * @openapi
 * /userSettings:
 *   patch:
 *     summary: Update personal settings for the authenticated dashboard user
 *     tags: [UserSettings]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UserUpdateRequest'
 *     responses:
 *       200:
 *         description: Updated personal user settings
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 */
router.patch('/', validateBody(userUpdateRequestSchema), async (req, res) => {
    const discordId = getAuthenticatedDiscordId(req as AuthenticatedRequest);
    const body = req.body as z.infer<typeof userUpdateRequestSchema>;
    await getConfigManager().userManager.setUser({ discordId, ...body });
    const updated = await getConfigManager().userManager.getOnePlain({ discordId }) as UserSettingsRecord | null;
    res.json(serializeSettings(discordId, updated));
});

export { router };
