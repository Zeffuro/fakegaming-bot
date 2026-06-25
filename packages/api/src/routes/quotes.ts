import { createBaseRouter } from '../utils/createBaseRouter.js';
import { getConfigManager, type QuoteOfDayConfigRecord } from '@zeffuro/fakegaming-common/managers';
import { jwtAuth } from '../middleware/auth.js';
import { checkUserGuildAccess } from '../utils/authHelpers.js';
import { CACHE_KEYS, CACHE_TTL, defaultCacheManager, getDiscordUserById, validateBody, validateParams, validateQuery, type CacheManager, type DiscordUserProfile } from '@zeffuro/fakegaming-common';
import { quoteCreateRequestSchema, quoteModerationUpdateRequestSchema, quoteOfDaySettingsRequestSchema } from '@zeffuro/fakegaming-common/api';
import { buildQuoteCardFilename, QUOTE_CARD_MIME_TYPE, renderQuoteCard } from '@zeffuro/fakegaming-common/quote-card';
import { formatQuoteOfDayDateKey, parseStoredQuoteTags, selectQuoteOfDay, serializeQuoteTags, type QuoteOfDayCandidate } from '@zeffuro/fakegaming-common/utils';
import type { QuoteConfig, QuoteModerationStatus } from '@zeffuro/fakegaming-common/models';
import { z } from 'zod';
import { UniqueConstraintError } from 'sequelize';
import type { CreationAttributes } from 'sequelize';
import { randomUUID } from 'node:crypto';
import type { AuthenticatedRequest } from '../types/express.js';
import { recordAuditEvent } from '../utils/audit.js';
import {
    canReadGuildScopedRecord,
    deleteGuildScopedRecord,
    loadGuildScopedRecords,
    sendNotFound,
} from '../utils/guildScopedRouteHelpers.js';
import { filterGuildScopedRecordsForRequest } from '../utils/authHelpers.js';

type QuoteRecord = QuoteOfDayCandidate & {
    tags?: unknown;
    source?: string | null;
    context?: string | null;
    moderationStatus?: QuoteModerationStatus | string | null;
};

// Zod schemas
const idParamSchema = z.object({ id: z.string().min(1) });
const guildIdParamSchema = z.object({ guildId: z.string().min(1) });
const guildAuthorParamSchema = z.object({
    guildId: z.string().min(1),
    authorId: z.string().min(1)
});
const searchQuerySchema = z.object({
    guildId: z.string().min(1),
    text: z.string().min(1)
});
const listQuerySchema = z.object({
    guildId: z.string().min(1).optional()
});
const quoteOfDayQuerySchema = z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

// Router
const router = createBaseRouter();
const quoteCardCache = ((globalThis as unknown as { __testCacheManager?: CacheManager }).__testCacheManager ?? defaultCacheManager) as CacheManager;

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
router.get('/', validateQuery(listQuerySchema), async (req, res) => {
    const { guildId } = req.query as z.infer<typeof listQuerySchema>;
    const quotes = await loadGuildScopedRecords(getConfigManager().quoteManager, guildId);
    const visibleQuotes = await filterGuildScopedRecordsForRequest(req, res, quotes, guildId);
    if (!visibleQuotes) return;
    res.json(visibleQuotes.map(serializeQuote));
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
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get('/search', jwtAuth, validateQuery(searchQuerySchema), async (req, res) => {
    const { guildId, text } = req.query as z.infer<typeof searchQuerySchema>;
    const accessResult = await checkUserGuildAccess(req, res, guildId);
    if (!accessResult.authorized) return;
    const quotes = await getConfigManager().quoteManager.searchQuotes(guildId, text);
    res.json(quotes.map(serializeQuote));
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
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get('/guild/:guildId', jwtAuth, validateParams(guildIdParamSchema), async (req, res) => {
    const { guildId } = req.params;
    const accessResult = await checkUserGuildAccess(req, res, guildId as string);
    if (!accessResult.authorized) return;
    const quotes = await getConfigManager().quoteManager.getQuotesByGuild(guildId as string);
    res.json(quotes.map(serializeQuote));
});

/**
 * @openapi
 * /quotes/guild/{guildId}/quote-of-day/settings:
 *   put:
 *     summary: Create or update quote-of-the-day delivery settings
 *     tags: [Quotes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: guildId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/QuoteOfDaySettingsRequest'
 *     responses:
 *       200:
 *         description: Saved quote-of-the-day settings
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.put('/guild/:guildId/quote-of-day/settings', jwtAuth, validateParams(guildIdParamSchema), validateBody(quoteOfDaySettingsRequestSchema), async (req, res) => {
    const { guildId } = req.params;
    const body = req.body as z.infer<typeof quoteOfDaySettingsRequestSchema>;
    const accessResult = await checkUserGuildAccess(req, res, guildId as string);
    if (!accessResult.authorized) return;

    const previous = await getConfigManager().quoteOfDayManager.getForGuild(guildId as string);
    const settings = await getConfigManager().quoteOfDayManager.upsertForGuild({
        guildId: guildId as string,
        channelId: body.channelId,
        enabled: body.enabled,
        runHourUtc: body.runHourUtc,
    });

    await recordAuditEvent(req, {
        action: 'quoteofday.settings.update',
        targetType: 'quoteofday',
        targetId: guildId as string,
        guildId: guildId as string,
        metadata: {
            previousEnabled: previous?.enabled ?? null,
            enabled: settings.enabled,
            previousChannelId: previous?.channelId ?? null,
            channelId: settings.channelId,
            previousRunHourUtc: previous?.runHourUtc ?? null,
            runHourUtc: settings.runHourUtc,
        },
    });

    res.json(serializeQuoteOfDaySettings(settings));
});

/**
 * @openapi
 * /quotes/guild/{guildId}/quote-of-day:
 *   get:
 *     summary: Preview the deterministic quote-of-the-day selection
 *     tags: [Quotes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: guildId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: date
 *         required: false
 *         schema:
 *           type: string
 *           pattern: '^\\d{4}-\\d{2}-\\d{2}$'
 *     responses:
 *       200:
 *         description: Quote-of-the-day preview and settings
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get('/guild/:guildId/quote-of-day', jwtAuth, validateParams(guildIdParamSchema), validateQuery(quoteOfDayQuerySchema), async (req, res) => {
    const { guildId } = req.params;
    const { date } = req.query as z.infer<typeof quoteOfDayQuerySchema>;
    const accessResult = await checkUserGuildAccess(req, res, guildId as string);
    if (!accessResult.authorized) return;

    const previewDate = parseQuoteOfDayDate(date);
    const cm = getConfigManager();
    const [quotes, settings] = await Promise.all([
        cm.quoteManager.getQuotesByGuild(guildId as string),
        cm.quoteOfDayManager.getForGuild(guildId as string),
    ]);
    const quoteRecords = quotes.map(toQuoteRecord);
    const selection = selectQuoteOfDay(quoteRecords, guildId as string, previewDate);

    res.json({
        date: selection.dateKey,
        quote: selection.quote ? serializeQuote(selection.quote) : null,
        eligibleCount: selection.eligibleCount,
        settings: serializeQuoteOfDaySettings(settings),
    });
});

/**
 * @openapi
 * /quotes/{id}/card:
 *   get:
 *     summary: Download an approved quote as a PNG card
 *     tags: [Quotes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: PNG quote card
 *         content:
 *           image/png:
 *             schema:
 *               type: string
 *               format: binary
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       409:
 *         $ref: '#/components/responses/Conflict'
 */
router.get('/:id/card', jwtAuth, validateParams(idParamSchema), async (req, res) => {
    const id = String(req.params.id);
    const manager = getConfigManager().quoteManager;
    const quote = await manager.findByPkPlain(id);
    if (!quote) {
        sendNotFound(res, 'Quote not found');
        return;
    }

    const hasAccess = await canReadGuildScopedRecord(req, res, quote);
    if (!hasAccess) return;

    const record = toQuoteRecord(quote);
    const moderationStatus = normalizeQuoteModerationStatus(record.moderationStatus);
    if (moderationStatus !== 'approved') {
        res.status(409).json({
            error: {
                code: 'QUOTE_NOT_APPROVED',
                message: 'Only approved quotes can be rendered as cards',
            },
        });
        return;
    }

    const [authorName, submitterName] = await Promise.all([
        resolveQuoteCardUserLabel(record.guildId, record.authorId),
        resolveQuoteCardUserLabel(record.guildId, record.submitterId),
    ]);

    const buffer = renderQuoteCard({
        quote: record.quote,
        authorName,
        authorId: record.authorId,
        submitterName,
        timestamp: record.timestamp,
        tags: parseStoredQuoteTags(record.tags),
        source: normalizeOptionalQuoteText(record.source),
        context: normalizeOptionalQuoteText(record.context),
    });

    res.status(200)
        .set({
            'Cache-Control': 'private, max-age=300',
            'Content-Disposition': `attachment; filename="${buildQuoteCardFilename(id)}"`,
            'Content-Type': QUOTE_CARD_MIME_TYPE,
        })
        .send(buffer);
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
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get('/guild/:guildId/author/:authorId', jwtAuth, validateParams(guildAuthorParamSchema), async (req, res) => {
    const { guildId, authorId } = req.params;
    const accessResult = await checkUserGuildAccess(req, res, guildId as string);
    if (!accessResult.authorized) return;
    const quotes = await getConfigManager().quoteManager.getQuotesByAuthor(guildId as string, authorId as string);
    res.json(quotes.map(serializeQuote));
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
 *         description: Quote config
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get('/:id', validateParams(idParamSchema), async (req, res) => {
    const manager = getConfigManager().quoteManager;
    const quote = await manager.findByPkPlain(String(req.params.id));
    if (!quote) {
        sendNotFound(res, 'Quote not found');
        return;
    }
    const hasAccess = await canReadGuildScopedRecord(req, res, quote);
    if (!hasAccess) return;
    res.json(serializeQuote(quote));
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
 *             $ref: '#/components/schemas/QuoteCreateRequest'
 *     responses:
 *       201:
 *         description: Created
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       409:
 *         $ref: '#/components/responses/Conflict'
 */
router.post('/', jwtAuth, validateBody(quoteCreateRequestSchema), async (req, res) => {
    const body = req.body as z.infer<typeof quoteCreateRequestSchema>;
    const accessResult = await checkUserGuildAccess(req, res, body.guildId);
    if (!accessResult.authorized) return;

    try {
        const submitterId = (req as AuthenticatedRequest).user.discordId;
        const id = body.id ?? randomUUID();
        const payload = {
            id,
            guildId: body.guildId,
            quote: body.quote,
            authorId: body.authorId,
            submitterId: submitterId ?? body.submitterId ?? '',
            timestamp: body.timestamp,
            tags: serializeQuoteTags(body.tags),
            source: normalizeOptionalQuoteText(body.source),
            context: normalizeOptionalQuoteText(body.context),
            moderationStatus: 'pending',
        } as CreationAttributes<QuoteConfig>;

        const created = await getConfigManager().quoteManager.addPlain(payload);
        const createdQuote = toQuoteRecord(created);
        await recordAuditEvent(req, {
            action: 'quote.create',
            targetType: 'quote',
            targetId: created.id,
            guildId: created.guildId ?? null,
            metadata: {
                authorId: created.authorId,
                tags: parseStoredQuoteTags(createdQuote.tags),
                source: createdQuote.source ?? null,
                moderationStatus: normalizeQuoteModerationStatus(createdQuote.moderationStatus),
            },
        });
        res.status(201).json(serializeQuote(createdQuote));
    } catch (error) {
        if (error instanceof UniqueConstraintError) {
            res.status(409).json({ error: { code: 'CONFLICT', message: 'Quote with this ID already exists' } });
        } else {
            throw error;
        }
    }
});

/**
 * @openapi
 * /quotes/{id}/moderation:
 *   patch:
 *     summary: Update quote moderation status
 *     tags: [Quotes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/QuoteModerationUpdateRequest'
 *     responses:
 *       200:
 *         description: Updated quote
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.patch('/:id/moderation', jwtAuth, validateParams(idParamSchema), validateBody(quoteModerationUpdateRequestSchema), async (req, res) => {
    const id = String(req.params.id);
    const body = req.body as z.infer<typeof quoteModerationUpdateRequestSchema>;
    const manager = getConfigManager().quoteManager;
    const quote = await manager.getOnePlain({ id });
    if (!quote) {
        sendNotFound(res, 'Quote not found');
        return;
    }

    const hasAccess = await canReadGuildScopedRecord(req, res, quote);
    if (!hasAccess) return;

    const previousStatus = normalizeQuoteModerationStatus(toQuoteRecord(quote).moderationStatus);
    const updated = await manager.updateModerationStatus(id, body.moderationStatus);
    if (!updated) {
        sendNotFound(res, 'Quote not found');
        return;
    }

    await recordAuditEvent(req, {
        action: 'quote.moderation.update',
        targetType: 'quote',
        targetId: id,
        guildId: updated.guildId ?? null,
        metadata: {
            previousStatus,
            moderationStatus: body.moderationStatus,
            authorId: updated.authorId,
        },
    });

    res.json(serializeQuote(updated));
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
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.delete('/:id', jwtAuth, validateParams(idParamSchema), async (req, res) => {
    const id = String(req.params.id);
    const manager = getConfigManager().quoteManager;
    await deleteGuildScopedRecord(req, res, id, {
        findByPk: id => manager.findByPkPlain(id),
        removeByPk: id => manager.removeByPk(id),
        notFoundMessage: 'Quote not found',
        auditAction: 'quote.delete',
        auditTargetType: 'quote',
        auditMetadata: quote => ({
            authorId: quote.authorId,
        }),
    });
});

export { router };

function serializeQuote(quote: unknown) {
    const record = toQuoteRecord(quote);
    return {
        ...record,
        tags: parseStoredQuoteTags(record.tags),
        source: normalizeOptionalQuoteText(record.source),
        context: normalizeOptionalQuoteText(record.context),
        moderationStatus: normalizeQuoteModerationStatus(record.moderationStatus),
    };
}

function serializeQuoteOfDaySettings(settings: QuoteOfDayConfigRecord | null) {
    if (!settings) return null;
    return {
        guildId: settings.guildId,
        channelId: settings.channelId,
        enabled: Boolean(settings.enabled),
        runHourUtc: normalizeRunHour(settings.runHourUtc),
        createdAt: settings.createdAt ?? null,
        updatedAt: settings.updatedAt ?? null,
    };
}

function toQuoteRecord(quote: unknown): QuoteRecord {
    return quote as QuoteRecord;
}

function normalizeOptionalQuoteText(value: string | null | undefined): string | null {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
}

function normalizeQuoteModerationStatus(value: string | null | undefined): QuoteModerationStatus {
    if (value === 'approved' || value === 'rejected' || value === 'pending') return value;
    return 'pending';
}

function parseQuoteOfDayDate(value: string | undefined): Date {
    if (!value) return new Date();
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return formatQuoteOfDayDateKey(parsed) === value ? parsed : new Date();
}

function normalizeRunHour(value: number | undefined): number {
    if (value === undefined || !Number.isFinite(value)) return 9;
    return Math.max(0, Math.min(23, Math.floor(value)));
}

async function resolveQuoteCardUserLabel(guildId: string, userId: string): Promise<string> {
    const nick = await safeCacheGet<string | null>(CACHE_KEYS.userGuildNick(userId, guildId));
    if (nick?.trim()) return nick.trim();

    let profile = await safeCacheGet<DiscordUserProfile>(CACHE_KEYS.userProfile(userId));
    const botToken = process.env.DISCORD_BOT_TOKEN;
    if (!profile && botToken) {
        try {
            const fetched = await getDiscordUserById(userId, botToken);
            profile = {
                id: fetched.id,
                username: fetched.username,
                global_name: fetched.global_name ?? null,
                discriminator: fetched.discriminator ?? null,
                avatar: fetched.avatar ?? null,
            };
            await safeCacheSet(CACHE_KEYS.userProfile(userId), profile, CACHE_TTL.USER_PROFILE);
        } catch {
            profile = null;
        }
    }

    return profile?.global_name?.trim()
        || profile?.username?.trim()
        || `Discord user ${userId.slice(-6)}`;
}

async function safeCacheGet<T>(key: string): Promise<T | null> {
    try {
        return await quoteCardCache.get<T>(key);
    } catch {
        return null;
    }
}

async function safeCacheSet<T>(key: string, value: T, ttlMs: number): Promise<void> {
    try {
        await quoteCardCache.set(key, value, ttlMs);
    } catch {
        // Rendering a quote card should not fail because the profile cache is unavailable.
    }
}
