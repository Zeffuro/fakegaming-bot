import { z } from 'zod';
import { createBaseRouter } from '../utils/createBaseRouter.js';
import { jwtAuth } from '../middleware/auth.js';
import { checkUserGuildAccess } from '../utils/authHelpers.js';
import * as common from '@zeffuro/fakegaming-common';
import { memberSearchRateBuckets } from '../utils/memberSearchLimiter.js';

const router = createBaseRouter();

// Prefer the shared in-memory cache used by tests, fallback to default
const cache = ((globalThis as any).__testCacheManager ?? common.defaultCacheManager) as common.CacheManager;

/**
 * @openapi
 * components:
 *   schemas:
 *     DiscordMemberMinimal:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         username:
 *           type: string
 *         global_name:
 *           type: string
 *           nullable: true
 *         discriminator:
 *           type: string
 *           nullable: true
 *         avatar:
 *           type: string
 *           nullable: true
 *         nick:
 *           type: string
 *           nullable: true
 */

const resolveUsersBodySchema = z.object({
    guildId: z.string().min(1),
    ids: z.array(z.string().min(1)).max(50)
}).strict();

/**
 * @openapi
 * /discord/users/resolve:
 *   post:
 *     summary: Resolve minimal user profiles and guild nicknames
 *     description: |
 *       Given a guildId and up to 50 user IDs, returns minimal user profiles
 *       with optional cached guild nickname where available. Profiles are cached
 *       in the server-side cache. Any IDs that could not be resolved are listed
 *       under `missed`.
 *     tags: [Discord]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [guildId, ids]
 *             properties:
 *               guildId:
 *                 type: string
 *               ids:
 *                 type: array
 *                 maxItems: 50
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Resolved users and list of missed IDs
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 users:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/DiscordMemberMinimal'
 *                 missed:
 *                   type: array
 *                   items:
 *                     type: string
 *       400:
 *         description: Validation failed
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden — insufficient guild access
 */
router.post('/users/resolve', jwtAuth, common.validateBody(resolveUsersBodySchema), async (req, res) => {
    const { guildId, ids } = req.body as z.infer<typeof resolveUsersBodySchema>;

    const accessResult = await checkUserGuildAccess(req, res, guildId);
    if (!accessResult.authorized) return;

    const toResolve = Array.from(new Set((ids || []).filter((id) => id.trim().length > 0)));

    const users: Array<{ id: string; username?: string; global_name?: string | null; discriminator?: string | null; avatar?: string | null; nick?: string | null }> = [];
    const missed: string[] = [];

    for (const id of toResolve) {
        // Resolve profile (from cache first)
        let profile = await cache.get<common.DiscordUserProfile>(common.CACHE_KEYS.userProfile(id));
        const botToken = process.env.DISCORD_BOT_TOKEN;
        if (!profile && botToken) {
            try {
                const fetched = await common.getDiscordUserById(id, botToken);
                profile = {
                    id: fetched.id,
                    username: fetched.username,
                    global_name: fetched.global_name ?? null,
                    discriminator: fetched.discriminator ?? null,
                    avatar: fetched.avatar ?? null
                };
                await cache.set(common.CACHE_KEYS.userProfile(id), profile, common.CACHE_TTL.USER_PROFILE);
            } catch (_err) {
                // Could not fetch profile; record as missed and continue
                users.push({ id, username: undefined, global_name: null, discriminator: null, avatar: null, nick: null });
                missed.push(id);
                continue;
            }
        } else if (!profile && !botToken) {
            // No token to fetch and no cache; record minimal entry and mark missed
            users.push({ id, username: undefined, global_name: null, discriminator: null, avatar: null, nick: null });
            missed.push(id);
            continue;
        }

        // Resolve nickname from cache (best effort). Cache returns null when missing.
        const cachedNick = await cache.get<string | null>(common.CACHE_KEYS.userGuildNick(id, guildId));

        // Construct the payload explicitly to keep strict typing intact
        if (profile) {
            users.push({
                id: profile.id,
                username: profile.username,
                global_name: profile.global_name ?? null,
                discriminator: profile.discriminator ?? null,
                avatar: profile.avatar ?? null,
                nick: cachedNick ?? null,
            });
        } else {
            // Defensive fallback (should be unreachable due to continues above)
            users.push({ id, username: undefined, global_name: null, discriminator: null, avatar: null, nick: cachedNick ?? null });
            missed.push(id);
        }
    }

    return res.json({ users, missed });
});

// Simple in-memory token bucket rate limiter per user+guild for this search endpoint (shared store)
const rateBuckets = memberSearchRateBuckets;
const RATE_LIMIT_TOKENS = 10; // 10 requests
const RATE_LIMIT_WINDOW_MS = 10_000; // per 10 seconds
function allowRequest(bucketKey: string): boolean {
    const now = Date.now();
    const bucket = rateBuckets.get(bucketKey) || { tokens: RATE_LIMIT_TOKENS, lastRefill: now };
    // Refill tokens proportionally
    const elapsed = now - bucket.lastRefill;
    if (elapsed > 0) {
        const refill = Math.floor((elapsed / RATE_LIMIT_WINDOW_MS) * RATE_LIMIT_TOKENS);
        if (refill > 0) {
            bucket.tokens = Math.min(RATE_LIMIT_TOKENS, bucket.tokens + refill);
            bucket.lastRefill = now;
        }
    }
    if (bucket.tokens <= 0) {
        rateBuckets.set(bucketKey, bucket);
        return false;
    }
    bucket.tokens -= 1;
    rateBuckets.set(bucketKey, bucket);
    return true;
}

const memberSearchParamsSchema = z.object({ guildId: z.string().min(1) }).strict();
const memberSearchQuerySchema = z.object({
    query: z.string().min(1),
    limit: z.string().optional()
}).strict();

/**
 * @openapi
 * /discord/guilds/{guildId}/members/search:
 *   get:
 *     summary: Search guild members by query (autocomplete)
 *     tags: [Discord]
 *     parameters:
 *       - in: path
 *         name: guildId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: query
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: limit
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 25
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of minimal guild members
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/DiscordMemberMinimal'
 *       400:
 *         description: Validation failed
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden — insufficient guild access
 *       429:
 *         description: Too many requests
 */
router.get('/guilds/:guildId/members/search', jwtAuth, common.validateParams(memberSearchParamsSchema), common.validateQuery(memberSearchQuerySchema), async (req, res) => {
    const { guildId } = req.params as z.infer<typeof memberSearchParamsSchema>;
    const { query, limit } = req.query as { query: string; limit?: string };

    const accessResult = await checkUserGuildAccess(req, res, guildId);
    if (!accessResult.authorized) return;

    const user = (req as any).user as { discordId?: string } | undefined;
    const bucketKey = `${user?.discordId || 'anon'}:${guildId}:membersearch`;
    if (!allowRequest(bucketKey)) {
        return res.status(429).json({ error: 'Too many requests' });
    }

    const q = query.trim();
    const limNumRaw = Number(limit ?? '25');
    const lim = Number.isFinite(limNumRaw) ? Math.max(1, Math.min(25, Math.floor(limNumRaw))) : 25;

    const botToken = process.env.DISCORD_BOT_TOKEN;

    // Try cache first
    // Fallback local cache key and TTL for member search to avoid runtime dependency on new common builds
    function _localGuildMemberSearchCacheKey(guildId: string, query: string, limit: number): string {
        return `guild:${guildId}:member_search:${encodeURIComponent(query.toLowerCase())}:limit:${limit}`;
    }
    const _LOCAL_MEMBER_SEARCH_TTL_MS = 5 * 60 * 1000;

    function getMemberSearchCacheKey(guildId: string, q: string, lim: number): string {
        const maybe = (common.CACHE_KEYS as any).guildMemberSearch as ((g: string, q: string, l: number) => string) | undefined;
        return maybe ? maybe(guildId, q, lim) : _localGuildMemberSearchCacheKey(guildId, q, lim);
    }
    function getMemberSearchTtlMs(): number {
        const maybeTtl = (common.CACHE_TTL as any).MEMBER_SEARCH as number | undefined;
        return typeof maybeTtl === 'number' ? maybeTtl : _LOCAL_MEMBER_SEARCH_TTL_MS;
    }

    const cacheKey = getMemberSearchCacheKey(guildId, q, lim);
    const cached = await cache.get<Array<{ id: string; username?: string; global_name?: string | null; discriminator?: string | null; avatar?: string | null; nick?: string | null }>>(cacheKey);
    if (cached) {
        return res.json(cached);
    }

    // Try Discord API search if bot token configured
    if (botToken) {
        try {
            const url = `https://discord.com/api/guilds/${guildId}/members/search?query=${encodeURIComponent(q)}&limit=${lim}`;
            const results = await common.Discord.retryFetchJson<any[]>({
                url,
                init: { headers: { Authorization: `Bot ${botToken}` } },
                rateLimitExhaustedMessage: 'Discord rate limit exceeded for guild member search'
            });
            const mapped = (results || []).map((m: any) => ({
                id: m?.user?.id ?? '',
                username: m?.user?.username ?? undefined,
                global_name: m?.user?.global_name ?? null,
                discriminator: m?.user?.discriminator ?? null,
                avatar: m?.user?.avatar ?? null,
                nick: m?.nick ?? null
            })).filter((m: any) => m.id);
            if (mapped.length > 0) {
                await cache.set(cacheKey, mapped, getMemberSearchTtlMs());
                return res.json(mapped);
            }
            // If empty, fall through to fallback below
        } catch (_err) {
            // fall through to fallback
        }
    }

    // Fallback: search recent quote participants and cached profiles only
    const quotes = await common.getConfigManager().quoteManager.getQuotesByGuild(guildId);
    const candidateIds = Array.from(new Set((quotes || []).flatMap((q) => [q.authorId, q.submitterId]).filter(Boolean)));

    const lowered = q.toLowerCase();
    const matched: Array<{ id: string; username?: string; global_name?: string | null; discriminator?: string | null; avatar?: string | null; nick?: string | null }> = [];
    for (const id of candidateIds) {
        if (matched.length >= lim) break;
        const profile = await cache.get<common.DiscordUserProfile>(common.CACHE_KEYS.userProfile(id));
        const nick = await cache.get<string | null>(common.CACHE_KEYS.userGuildNick(id, guildId));

        if (!profile && nick === null) {
            continue; // no cached data; skip in fallback
        }
        const username = profile?.username;
        const global_name = profile?.global_name ?? null;
        const discriminator = profile?.discriminator ?? null;
        const avatar = profile?.avatar ?? null;

        const displayCandidates = [nick ?? undefined, global_name ?? undefined, username ?? undefined]
            .filter((s): s is string => typeof s === 'string' && s.length > 0)
            .map((s) => s.toLowerCase());
        const idCandidate = String(id);
        const isMatch = displayCandidates.some((s) => s.includes(lowered)) || idCandidate.includes(q);
        if (isMatch) {
            matched.push({ id, username, global_name, discriminator, avatar, nick: nick ?? null });
        }
    }

    await cache.set(cacheKey, matched, getMemberSearchTtlMs());
    return res.json(matched);
});

export { router };
