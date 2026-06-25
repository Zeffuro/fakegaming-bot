import { z } from 'zod';
import { getConfigManager, validateBody } from '@zeffuro/fakegaming-common';
import { createBaseRouter } from '../utils/createBaseRouter.js';
import { jwtAuth } from '../middleware/auth.js';
import { requireGuildAdmin } from '../utils/authHelpers.js';
import { recordAuditEvent } from '../utils/audit.js';
import {
    applySetupTemplate,
    listSetupTemplateDefinitions,
    previewSetupTemplate,
    type SetupTemplateId,
} from '../utils/setupTemplates.js';

const router = createBaseRouter();

const channelsSchema = z.object({
    live: z.string().trim().min(1).optional(),
    videos: z.string().trim().min(1).optional(),
    patches: z.string().trim().min(1).optional(),
    anime: z.string().trim().min(1).optional(),
    steamNews: z.string().trim().min(1).optional(),
}).strict();

const setupTemplateRequestSchema = z.object({
    guildId: z.string().trim().min(1),
    channels: channelsSchema.default({}),
    inputs: z.object({
        animeIds: z.array(z.coerce.number().int().positive()).max(50).optional(),
        patchGames: z.array(z.string().trim().min(1)).max(50).optional(),
        steamApps: z.array(z.object({
            appId: z.coerce.number().int().positive(),
            name: z.string().trim().min(1).nullable().optional(),
        }).strict()).max(50).optional(),
        twitchUsernames: z.array(z.string().trim().min(1)).max(50).optional(),
        youtubeChannelIds: z.array(z.string().trim().min(1)).max(50).optional(),
    }).strict().default({}),
}).strict();

router.get('/', jwtAuth, (_req, res) => {
    res.json({ templates: listSetupTemplateDefinitions() });
});

router.post('/:templateId/preview', jwtAuth, validateBody(setupTemplateRequestSchema), requireGuildAdmin, async (req, res) => {
    const templateId = String(req.params.templateId ?? '');
    const plan = await previewSetupTemplate(getConfigManager(), templateId, req.body);
    if (!plan) {
        res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Setup template not found' } });
        return;
    }

    res.json(plan);
});

router.post('/:templateId/apply', jwtAuth, validateBody(setupTemplateRequestSchema), requireGuildAdmin, async (req, res) => {
    const templateId = String(req.params.templateId ?? '');
    const result = await applySetupTemplate(getConfigManager(), templateId, req.body);
    if (!result) {
        res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Setup template not found' } });
        return;
    }

    await recordAuditEvent(req, {
        action: 'setupTemplate.apply',
        targetType: 'setupTemplate',
        targetId: templateId as SetupTemplateId,
        guildId: result.currentGuildId,
        metadata: {
            applied: result.applied,
            ready: result.totals.ready,
            skipped: result.skipped.length,
            duplicate: result.totals.duplicate,
            invalid: result.totals.invalid,
            channels: Object.keys((req.body as z.output<typeof setupTemplateRequestSchema>).channels),
        },
    });

    res.status(201).json(result);
});

export { router };
