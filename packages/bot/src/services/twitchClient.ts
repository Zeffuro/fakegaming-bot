import { ApiClient } from '@twurple/api';
import type { AuthProvider } from '@twurple/auth';
import { getExpiryDateOfAccessToken, type AccessToken } from '@twurple/auth';
import type { UserIdResolvable } from '@twurple/common';
import { getConfigManager } from '@zeffuro/fakegaming-common/managers';
import { getLogger, incMetric } from '@zeffuro/fakegaming-common';
import { createHash, createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const log = getLogger({ name: 'twitchAuth' });

function getEncKey(): Buffer | null {
    const raw = process.env.TWITCH_TOKEN_ENC_KEY;
    if (!raw) return null;
    // Derive 32-byte key from provided string
    return createHash('sha256').update(raw).digest();
}

function encryptIfPossible(plain: string): string {
    const key = getEncKey();
    if (!key) return plain;
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    const payload = Buffer.concat([iv, tag, enc]).toString('base64');
    return `enc:${payload}`;
}

function decryptIfPossible(stored: string): string | null {
    if (!stored.startsWith('enc:')) return stored; // plaintext JSON
    const key = getEncKey();
    if (!key) return null; // encrypted but no key available
    try {
        const buf = Buffer.from(stored.slice(4), 'base64');
        const iv = buf.subarray(0, 12);
        const tag = buf.subarray(12, 28);
        const enc = buf.subarray(28);
        const decipher = createDecipheriv('aes-256-gcm', key, iv);
        decipher.setAuthTag(tag);
        const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
        return dec.toString('utf8');
    } catch (err) {
        log.warn({ err }, 'Failed to decrypt stored Twitch token');
        return null;
    }
}

/**
 * Compute delay for proactive refresh, skewing by ~2 minutes.
 */
export function computeProactiveRefreshDelay(expiry: Date, now: number = Date.now(), skewMs = 2 * 60 * 1000): number {
    const delay = expiry.getTime() - now - skewMs;
    return Math.max(0, delay);
}

/**
 * Persistent app-token auth provider for Twurple that stores the app token
 * in the DB (CacheConfig) via the shared CacheManager. This avoids
 * thundering herd on restarts and respects free/limited Redis setups.
 */
class PersistentAppAuthProvider implements AuthProvider {
    readonly clientId: string;
    private readonly _clientSecret: string;

    private _memToken: AccessToken | null = null;
    private _memTokenExpiresAt: number | null = null;
    private readonly _cacheKey = 'twitch:app_token';
    private _refreshTimer: NodeJS.Timeout | null = null;

    constructor(clientId: string, clientSecret: string) {
        this.clientId = clientId;
        this._clientSecret = clientSecret;
    }

    // We don't support user tokens in the bot today.
    getCurrentScopesForUser(_user: UserIdResolvable): string[] { return []; }

    async getAccessTokenForUser(_user: UserIdResolvable): Promise<(AccessToken & { userId: string }) | null> {
        // Not supported for app-only usage; return null per AuthProvider contract.
        return null;
    }

    async getAnyAccessToken(_user?: UserIdResolvable): Promise<AccessToken> {
        return this._getOrFetchAppToken();
    }

    async getAppAccessToken(forceNew?: boolean): Promise<AccessToken> {
        return this._getOrFetchAppToken(!!forceNew);
    }

    private async _getOrFetchAppToken(forceNew = false): Promise<AccessToken> {
        const now = Date.now();

        // Serve from memory if valid
        if (!forceNew && this._memToken && this._memTokenExpiresAt && this._memTokenExpiresAt - now > 30_000) {
            log.debug({ source: 'memory', expiresAt: new Date(this._memTokenExpiresAt).toISOString() }, 'Using cached Twitch app token');
            return this._memToken;
        }

        // Try DB cache via shared CacheManager
        try {
            if (!forceNew) {
                const cm = getConfigManager().cacheManager;
                const row = await cm.getOne({ key: this._cacheKey });
                if (row && row.value) {
                    const raw = decryptIfPossible(row.value);
                    if (raw === null) {
                        log.warn('Encrypted Twitch token present but no valid key; ignoring stored value');
                    } else {
                        const token = JSON.parse(raw) as AccessToken;
                        const expiry = getExpiryDateOfAccessToken(token);
                        if (expiry && expiry.getTime() - now > 30_000) {
                            this._memToken = token;
                            this._memTokenExpiresAt = expiry.getTime();
                            log.debug({ source: 'db', expiresAt: expiry.toISOString() }, 'Loaded Twitch app token from DB cache');
                            this._scheduleProactiveRefresh(expiry);
                            return token;
                        }
                        log.debug({ source: 'db', expired: true }, 'DB token expired or near expiry; fetching new');
                    }
                } else {
                    log.debug({ source: 'db', hit: false }, 'No Twitch app token in DB cache');
                }
            }
        } catch (err) {
            log.warn({ err }, 'Failed to read Twitch token from CacheConfig');
        }

        // Fetch new token with exponential backoff + jitter
        const token = await this._fetchWithBackoff();

        // Persist to DB cache
        try {
            const cm = getConfigManager().cacheManager;
            const expiry = getExpiryDateOfAccessToken(token);
            const serialized = JSON.stringify(token);
            const stored = encryptIfPossible(serialized);
            await cm.upsert({
                key: this._cacheKey,
                value: stored,
                expires: expiry ?? new Date(Date.now() + 60 * 60 * 1000)
            } as any, ['key']);
            if (expiry) log.debug({ expiresAt: expiry.toISOString(), encrypted: stored.startsWith('enc:') }, 'Persisted Twitch app token to DB');
        } catch (err) {
            log.warn({ err }, 'Failed to write Twitch token to CacheConfig');
        }

        // Update memory cache and schedule refresh
        const expiry = getExpiryDateOfAccessToken(token);
        this._memToken = token;
        this._memTokenExpiresAt = expiry ? expiry.getTime() : (Date.now() + 55 * 60 * 1000);
        if (expiry) this._scheduleProactiveRefresh(expiry);

        return token;
    }

    private async _fetchWithBackoff(): Promise<AccessToken> {
        const maxAttempts = 3;
        let attempt = 0;
        let lastErr: unknown = null;

        while (attempt < maxAttempts) {
            try {
                // Dynamic import to play nice with test mocks
                const mod = await import('@twurple/auth');
                const getAppToken = (mod as any).getAppToken as (clientId: string, clientSecret: string) => Promise<AccessToken>;
                if (typeof getAppToken !== 'function') {
                    throw new Error('getAppToken is not available');
                }
                attempt += 1;
                incMetric('twitch_token_fetch_attempt');
                log.info({ attempt }, 'Fetching new Twitch app token');
                const token = await getAppToken(this.clientId, this._clientSecret);
                log.info({ attempt }, 'Fetched new Twitch app token');
                return token;
            } catch (err) {
                lastErr = err;
                attempt += 1;
                incMetric('twitch_token_fetch_error');
                const base = 500 * Math.pow(2, attempt - 1); // 500ms, 1000ms, 2000ms
                const jitter = Math.floor(Math.random() * 250);
                const delay = base + jitter;
                log.warn({ attempt, delay, err }, 'Twitch app token fetch failed; backing off');
                await new Promise(res => setTimeout(res, delay));
            }
        }

        log.error({ err: lastErr }, 'Failed to fetch Twitch app token after retries');
        throw lastErr instanceof Error ? lastErr : new Error('Failed to fetch Twitch app token');
    }

    private _scheduleProactiveRefresh(expiry: Date): void {
        if (process.env.NODE_ENV === 'test') return;
        if (this._refreshTimer) {
            clearTimeout(this._refreshTimer);
            this._refreshTimer = null;
        }
        const delay = computeProactiveRefreshDelay(expiry);
        if (delay <= 0) return;
        log.debug({ delay }, 'Scheduling proactive Twitch token refresh');
        this._refreshTimer = setTimeout(async () => {
            try {
                log.info('Proactive Twitch token refresh starting');
                await this.getAppAccessToken(true);
                log.info('Proactive Twitch token refresh completed');
            } catch (err) {
                log.warn({ err }, 'Proactive Twitch token refresh failed');
            }
        }, delay);
    }
}

function getStartupJitterMs(): number {
    if (process.env.NODE_ENV === 'test') return 0;
    const raw = process.env.TWITCH_STARTUP_JITTER_MS;
    const max = raw ? Number(raw) : 10_000;
    if (!Number.isFinite(max) || max <= 0) return 0;
    return Math.floor(Math.random() * max);
}

let _clientPromise: Promise<ApiClient> | null = null;

export async function getTwitchApiClient(): Promise<ApiClient> {
    if (_clientPromise) return _clientPromise;

    const clientId = process.env.TWITCH_CLIENT_ID;
    const clientSecret = process.env.TWITCH_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
        throw new Error('[TwitchAuth] Missing TWITCH_CLIENT_ID/TWITCH_CLIENT_SECRET');
    }

    _clientPromise = (async () => {
        const jitter = getStartupJitterMs();
        if (jitter > 0) {
            log.debug({ jitter }, 'Applying startup jitter before creating Twitch ApiClient');
            await new Promise(res => setTimeout(res, jitter));
        }
        const authProvider = new PersistentAppAuthProvider(clientId, clientSecret);
        return new ApiClient({ authProvider });
    })();

    return _clientPromise;
}

// A convenience singleton for legacy imports
let _singletonClient: ApiClient | null = null;
export async function getOrCreateTwitchClient(): Promise<ApiClient> {
    if (!_singletonClient) {
        _singletonClient = await getTwitchApiClient();
    }
    return _singletonClient;
}
