import { createHash, randomBytes } from "node:crypto";
import { requireRedis } from "@zeffuro/fakegaming-common";
import {
    REFRESH_SESSION_ABSOLUTE_MAX_AGE_SECONDS,
    REFRESH_SESSION_IDLE_MAX_AGE_SECONDS
} from "@/lib/auth/sessionConstants";

export interface RefreshSessionUser {
    id: string;
    username?: string | null;
    global_name?: string | null;
    avatar?: string | null;
    discriminator?: string | null;
}

export interface RefreshSessionRecord {
    version: 1;
    sessionId?: string;
    user: RefreshSessionUser;
    createdAt: number;
    updatedAt: number;
    absoluteExpiresAt: number;
    discordRefreshToken?: string | null;
}

export interface IssuedRefreshSession {
    token: string;
    record: RefreshSessionRecord;
}

const REFRESH_SESSION_KEY_PREFIX = "dashboard:refresh-session:";
const REFRESH_SESSION_INDEX_PREFIX = "dashboard:refresh-index:";
const REFRESH_SESSION_REVOCATION_PREFIX = "dashboard:refresh-revocation:";
type SessionStore = Awaited<ReturnType<typeof requireRedis>>;

const rotateIfCurrent = `
    if redis.call('GET', KEYS[1]) ~= ARGV[1] then
        if redis.call('GET', KEYS[3]) == KEYS[2] and redis.call('EXISTS', KEYS[2]) == 1 then return 1 end
        return 0
    end
    if not redis.call('SET', KEYS[2], ARGV[2], 'PX', ARGV[3], 'NX') then return 0 end
    redis.call('SET', KEYS[3], KEYS[2], 'PX', ARGV[3])
    redis.call('SET', KEYS[4], ARGV[4], 'PX', math.min(120000, tonumber(ARGV[3])))
    return redis.call('DEL', KEYS[1])
`;
const updateIfCurrent = `
    if redis.call('GET', KEYS[1]) ~= ARGV[1] then return 0 end
    redis.call('SET', KEYS[1], ARGV[2], 'PX', ARGV[3])
    return 1
`;
const revokeFamily = `
    local raw = redis.call('GET', KEYS[1])
    local id = raw and (cjson.decode(raw).sessionId or ARGV[1]) or redis.call('GET', KEYS[2])
    if not id then return 0 end
    local index = ARGV[2] .. id
    local active = redis.call('GET', index)
    if active then redis.call('DEL', index, active) end
    return redis.call('DEL', KEYS[1], KEYS[2])
`;

async function withStore<T>(action: (store: SessionStore) => Promise<T>): Promise<T> {
    try { return await action(await requireRedis()); }
    catch { throw new Error('Refresh session store unavailable'); }
}

function generateRefreshToken(): string {
    return randomBytes(32).toString("base64url");
}

function refreshSessionKey(token: string): string {
    const hash = createHash("sha256").update(token).digest("hex");
    return `${REFRESH_SESSION_KEY_PREFIX}${hash}`;
}

function getTtlMs(record: RefreshSessionRecord, nowMs: number): number {
    const idleTtlMs = REFRESH_SESSION_IDLE_MAX_AGE_SECONDS * 1000;
    const absoluteRemainingMs = record.absoluteExpiresAt - nowMs;
    return Math.max(0, Math.min(idleTtlMs, absoluteRemainingMs));
}

async function readSession(store: SessionStore, key: string, nowMs: number) {
    const raw = await store.get(key);
    if (!raw) return null;
    const record = JSON.parse(raw) as RefreshSessionRecord;
    if (record.absoluteExpiresAt <= nowMs) {
        await store.del(key);
        return null;
    }
    return { raw, record: { ...record, sessionId: record.sessionId ?? key.slice(REFRESH_SESSION_KEY_PREFIX.length) } };
}

export async function createRefreshSession(params: {
    user: RefreshSessionUser;
    discordRefreshToken?: string | null;
    nowMs?: number;
}): Promise<IssuedRefreshSession> {
    const nowMs = params.nowMs ?? Date.now();
    const token = generateRefreshToken();
    const key = refreshSessionKey(token);
    const record: RefreshSessionRecord = {
        version: 1,
        sessionId: key.slice(REFRESH_SESSION_KEY_PREFIX.length),
        user: params.user,
        createdAt: nowMs,
        updatedAt: nowMs,
        absoluteExpiresAt: nowMs + REFRESH_SESSION_ABSOLUTE_MAX_AGE_SECONDS * 1000,
        discordRefreshToken: params.discordRefreshToken ?? null
    };

    const saved = await withStore(store => store.set(key, JSON.stringify(record), 'PX', getTtlMs(record, nowMs), 'NX'));
    if (saved !== 'OK') throw new Error('Refresh session could not be created');
    return { token, record };
}

export async function getRefreshSession(token: string | undefined, nowMs: number = Date.now()): Promise<RefreshSessionRecord | null> {
    if (!token) return null;

    return withStore(async store => (await readSession(store, refreshSessionKey(token), nowMs))?.record ?? null);
}

export async function rotateRefreshSession(token: string | undefined, nowMs: number = Date.now()): Promise<IssuedRefreshSession | null> {
    if (!token) return null;

    return withStore(async store => {
        const oldKey = refreshSessionKey(token);
        const oldTokenHash = oldKey.slice(REFRESH_SESSION_KEY_PREFIX.length);
        const newToken = generateRefreshToken();
        for (let attempt = 0; attempt < 2; attempt++) {
            const current = await readSession(store, oldKey, nowMs);
            if (!current) return null;
            const record = { ...current.record, updatedAt: nowMs };
            const moved = await store.eval(rotateIfCurrent, 4, oldKey, refreshSessionKey(newToken), `${REFRESH_SESSION_INDEX_PREFIX}${record.sessionId}`,
                `${REFRESH_SESSION_REVOCATION_PREFIX}${oldTokenHash}`, current.raw, JSON.stringify(record), getTtlMs(record, nowMs), record.sessionId);
            if (moved === 1) return { token: newToken, record };
        }
        return null;
    });
}

export async function updateRefreshSession(token: string | undefined, updates: {
    discordRefreshToken?: string | null;
}, nowMs: number = Date.now(), previous?: RefreshSessionRecord): Promise<boolean> {
    if (!token) return false;

    return withStore(async store => {
        const originalKey = refreshSessionKey(token);
        for (let attempt = 0; attempt < 2; attempt++) {
            const activeKey = previous?.sessionId ? await store.get(`${REFRESH_SESSION_INDEX_PREFIX}${previous.sessionId}`) : null;
            const key = activeKey ?? originalKey;
            const current = await readSession(store, key, nowMs);
            if (!current) continue;
            if (previous && (previous.sessionId !== current.record.sessionId
                || previous.discordRefreshToken !== current.record.discordRefreshToken)) return false;
            const record = { ...current.record, ...updates, updatedAt: nowMs };
            if (await store.eval(updateIfCurrent, 1, key, current.raw, JSON.stringify(record), getTtlMs(record, nowMs)) === 1) return true;
        }
        return false;
    });
}

export async function revokeRefreshSession(token: string | undefined): Promise<void> {
    if (!token) return;
    const key = refreshSessionKey(token);
    const tokenHash = key.slice(REFRESH_SESSION_KEY_PREFIX.length);
    await withStore(store => store.eval(revokeFamily, 2, key, `${REFRESH_SESSION_REVOCATION_PREFIX}${tokenHash}`, tokenHash, REFRESH_SESSION_INDEX_PREFIX));
}

