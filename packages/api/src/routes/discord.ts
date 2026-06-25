import { z } from 'zod';
import { createBaseRouter } from '../utils/createBaseRouter.js';
import { jwtAuth } from '../middleware/auth.js';
import { checkUserGuildAccess } from '../utils/authHelpers.js';
import * as common from '@zeffuro/fakegaming-common';
import { discordResolveUsersRequestSchema } from '@zeffuro/fakegaming-common/api';
import { buildProfileCardFilename, PROFILE_CARD_MIME_TYPE, renderProfileCard } from '@zeffuro/fakegaming-common/profile-card';
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
 *             $ref: '#/components/schemas/DiscordResolveUsersRequest'
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
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.post('/users/resolve', jwtAuth, common.validateBody(discordResolveUsersRequestSchema), async (req, res) => {
    const { guildId, ids } = req.body as z.infer<typeof discordResolveUsersRequestSchema>;

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
            } catch {
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
const profileCardParamsSchema = z.object({
    guildId: z.string().min(1),
    userId: z.string().min(1),
}).strict();
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
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       429:
 *         $ref: '#/components/responses/RateLimitExceeded'
 *     headers:
 *       X-RateLimit-Limit:
 *         $ref: '#/components/headers/X-RateLimit-Limit'
 *       X-RateLimit-Remaining:
 *         $ref: '#/components/headers/X-RateLimit-Remaining'
 *       X-RateLimit-Reset:
 *         $ref: '#/components/headers/X-RateLimit-Reset'
 *       Retry-After:
 *         $ref: '#/components/headers/Retry-After'
 */
router.get('/guilds/:guildId/members/search', jwtAuth, common.validateParams(memberSearchParamsSchema), common.validateQuery(memberSearchQuerySchema), async (req, res) => {
    const { guildId } = req.params as z.infer<typeof memberSearchParamsSchema>;
    const { query, limit } = req.query as { query: string; limit?: string };

    const accessResult = await checkUserGuildAccess(req, res, guildId);
    if (!accessResult.authorized) return;

    const user = (req as any).user as { discordId?: string } | undefined;
    const bucketKey = `${user?.discordId || 'anon'}:${guildId}:membersearch`;
    if (!allowRequest(bucketKey)) {
        return res.status(429).json({ error: { code: 'RATE_LIMIT', message: 'Too many requests' } });
    }

    // Normalize query to reduce number of unique cache keys and keep Discord search effective
    const q = query
        .trim()
        .replace(/\s+/g, ' ')        // collapse internal whitespace
        .toLowerCase()                // case-insensitive for cache and Discord search
        .slice(0, 24);                // cap length to avoid overly granular keys
    const limNumRaw = Number(limit ?? '25');
    const lim = Number.isFinite(limNumRaw) ? Math.max(1, Math.min(25, Math.floor(limNumRaw))) : 25;

    const botToken = shouldUseDiscordMemberSearch() ? process.env.DISCORD_BOT_TOKEN : undefined;

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
        // Prefer explicit env override if present (milliseconds)
        const envTtlRaw = process.env.API_MEMBER_SEARCH_TTL_MS;
        if (envTtlRaw) {
            const n = Number(envTtlRaw);
            if (Number.isFinite(n) && n >= 0) return Math.floor(n);
        }
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
        } catch {
            // fall through to fallback
        }
    }

    // Fallback: search recent quote participants and cached profiles only
    const quotes = await common.getConfigManager().quoteManager.getQuotesByGuild(guildId);
    const candidateIds = Array.from(new Set((quotes || []).flatMap((q) => [q.authorId, q.submitterId]).filter(Boolean)));

    const lowered = q; // already lower-cased above
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

/**
 * @openapi
 * /discord/guilds/{guildId}/users/{userId}/profile-card:
 *   get:
 *     summary: Download a Discord user profile card as a PNG
 *     tags: [Discord]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: guildId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: PNG profile card
 *         content:
 *           image/png:
 *             schema:
 *               type: string
 *               format: binary
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get('/guilds/:guildId/users/:userId/profile-card', jwtAuth, common.validateParams(profileCardParamsSchema), async (req, res) => {
    const { guildId, userId } = req.params as z.infer<typeof profileCardParamsSchema>;

    const accessResult = await checkUserGuildAccess(req, res, guildId);
    if (!accessResult.authorized) return;

    const resolved = await resolveProfileCardUser(guildId, userId);
    const displayName = resolved.nick
        ?? resolved.profile?.global_name
        ?? resolved.profile?.username
        ?? formatFallbackProfileName(userId);

    const buffer = renderProfileCard({
        userId,
        displayName,
        username: resolved.profile?.username ?? null,
        discriminator: resolved.profile?.discriminator ?? null,
        globalName: resolved.profile?.global_name ?? null,
        nickname: resolved.nick,
    });

    res.status(200)
        .set({
            'Cache-Control': 'private, max-age=300',
            'Content-Disposition': `attachment; filename="${buildProfileCardFilename(userId)}"`,
            'Content-Type': PROFILE_CARD_MIME_TYPE,
        })
        .send(buffer);
});

function shouldUseDiscordMemberSearch(): boolean {
    const value = process.env.API_DISCORD_MEMBER_SEARCH_ENABLED;
    if (!value) return true;
    return !['0', 'false', 'off', 'no'].includes(value.trim().toLowerCase());
}

async function resolveProfileCardUser(guildId: string, userId: string): Promise<{ profile: common.DiscordUserProfile | null; nick: string | null }> {
    const [cachedProfile, cachedNick] = await Promise.all([
        readCacheValue<common.DiscordUserProfile>(common.CACHE_KEYS.userProfile(userId)),
        readCacheValue<string | null>(common.CACHE_KEYS.userGuildNick(userId, guildId)),
    ]);
    if (cachedProfile) {
        return { profile: cachedProfile, nick: cachedNick ?? null };
    }

    const botToken = process.env.DISCORD_BOT_TOKEN;
    if (!botToken) {
        return { profile: null, nick: cachedNick ?? null };
    }

    try {
        const member = await common.getDiscordGuildMember(guildId, userId, botToken) as {
            user?: common.DiscordUserProfile;
            nick?: string | null;
        };
        const profile = normalizeDiscordProfile(member.user, userId);
        if (profile) {
            await Promise.all([
                writeCacheValue(common.CACHE_KEYS.userProfile(userId), profile, common.CACHE_TTL.USER_PROFILE),
                writeCacheValue(common.CACHE_KEYS.userGuildNick(userId, guildId), member.nick ?? null, common.CACHE_TTL.USER_PROFILE),
            ]);
            return { profile, nick: member.nick ?? cachedNick ?? null };
        }
    } catch {
        // Fallback to the global user endpoint below.
    }

    try {
        const fetched = await common.getDiscordUserById(userId, botToken);
        const profile = normalizeDiscordProfile(fetched, userId);
        if (profile) {
            await writeCacheValue(common.CACHE_KEYS.userProfile(userId), profile, common.CACHE_TTL.USER_PROFILE);
            return { profile, nick: cachedNick ?? null };
        }
    } catch {
        // Rendering can still proceed with a stable fallback label.
    }

    return { profile: null, nick: cachedNick ?? null };
}

function normalizeDiscordProfile(value: common.DiscordUserProfile | undefined, fallbackId: string): common.DiscordUserProfile | null {
    if (!value) return null;
    return {
        id: value.id ?? fallbackId,
        username: value.username,
        global_name: value.global_name ?? null,
        discriminator: value.discriminator ?? null,
        avatar: value.avatar ?? null,
    };
}

async function readCacheValue<T>(key: string): Promise<T | null> {
    try {
        return await cache.get<T>(key);
    } catch {
        return null;
    }
}

async function writeCacheValue<T>(key: string, value: T, ttlMs: number): Promise<void> {
    try {
        await cache.set(key, value, ttlMs);
    } catch {
        // Profile-card rendering should not fail because the cache is unavailable.
    }
}

function formatFallbackProfileName(userId: string): string {
    const normalized = userId.trim();
    return normalized ? `Discord user ${normalized.slice(-6)}` : 'Discord user';
}

export { router };
