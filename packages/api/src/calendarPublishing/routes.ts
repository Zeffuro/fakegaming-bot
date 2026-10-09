import type { Request, Response } from 'express';
import { z } from 'zod';
import { CalendarPublication } from '@zeffuro/fakegaming-common/models';
import { createBaseRouter } from '../utils/createBaseRouter.js';
import { validateBody, validateParams } from '../localization/validation.js';
import { apiText, requestLocale } from '../localization/locale.js';
import type { AuthenticatedRequest } from '../types/express.js';
import { CalendarPublishDiscordError } from './discord.js';
import { confirmPublication, previewPublication, publicationInputSchema, publicationView, PublicationError, stopPublication } from './configuration.js';

const router = createBaseRouter();
const owner = (req: Request) => (req as AuthenticatedRequest).user?.discordId;
const errorKeys = { not_found: 'calendarPublishNotFound', stale_preview: 'calendarPublishStale', too_many: 'calendarPublishTooMany',
    not_ready: 'calendarPublishNotReady', conflict: 'calendarPublishConflict', forbidden: 'calendarPublishForbidden',
    invalid_destination: 'calendarPublishDestination', unavailable: 'calendarPublishUnavailable' } as const;

router.use((req, res, next) => {
    res.setHeader('Cache-Control', 'private, no-store'); res.vary('Accept-Language');
    if (!owner(req)) { res.status(401).json({ error: { code: 'UNAUTHORIZED', message: apiText(requestLocale(req), 'authenticationRequired') } }); return; }
    next();
});
async function safely(req: Request, res: Response, action: () => Promise<void>) {
    try { await action(); } catch (error) {
        const code = error instanceof PublicationError || error instanceof CalendarPublishDiscordError ? error.code : 'unavailable';
        const status = code === 'not_found' ? 404 : code === 'forbidden' ? 403 : code === 'unavailable' ? 503 : code === 'invalid_destination' ? 400 : 409;
        res.status(status).json({ error: { code: code.toUpperCase(), message: apiText(requestLocale(req), errorKeys[code]) } });
    }
}

router.get('/', async (req, res) => safely(req, res, async () => {
    const rows = await CalendarPublication.findAll({ where: { userId: owner(req)! }, order: [['createdAt', 'ASC']] });
    res.json({ publications: await Promise.all(rows.map(publicationView)) });
}));
router.post('/preview', validateBody(publicationInputSchema), async (req, res) => safely(req, res, async () => {
    res.json(await previewPublication(owner(req)!, req.body));
}));
router.post('/confirm', validateBody(z.object({ draftId: z.string().uuid(), acknowledgeChannel: z.literal(true),
    acknowledgeServerEvents: z.boolean(), confirmChannelName: z.string().min(1).max(100) }).strict()), async (req, res) => safely(req, res, async () => {
    const { draftId, confirmChannelName, acknowledgeServerEvents } = req.body;
    res.status(201).json({ publication: await confirmPublication(owner(req)!, draftId, confirmChannelName, acknowledgeServerEvents) });
}));
router.delete('/:id', validateParams(z.object({ id: z.string().uuid() })), async (req, res) => safely(req, res, async () => {
    await stopPublication(owner(req)!, req.params.id as string); res.json({ success: true });
}));

export { router as calendarPublishingRouter };
