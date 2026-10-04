import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { Op } from 'sequelize';
import { z } from 'zod';
import { TwitchClipBotAuth, TwitchClipOAuthState } from '@zeffuro/fakegaming-common/models';

const BOT_ID = 'default';
const SCOPES = ['user:read:chat', 'clips:edit'];
const VALIDATION_INTERVAL_MS = 55 * 60 * 1000;
const STATE_TTL_MS = 10 * 60 * 1000;
const tokenSchema = z.object({ access_token: z.string().min(1), refresh_token: z.string().min(1), expires_in: z.number().positive() });
const identitySchema = z.object({ client_id: z.string(), user_id: z.string().min(1), login: z.string().min(1), scopes: z.array(z.string()), expires_in: z.number().nonnegative() });

export interface TwitchClipBotToken {
    accessToken: string;
    userId: string;
    login: string;
}

export class TwitchClipAuthError extends Error {
    constructor(public readonly code: 'not_configured' | 'not_connected' | 'invalid_state' | 'identity_mismatch' | 'invalid_token' | 'provider_unavailable') {
        super(`Twitch clip bot authentication failed: ${code}`);
    }
}

let validated: { encryptedToken: string; at: number; expectedLogin: string; clientId: string } | undefined;
let pending: Promise<TwitchClipBotToken> | undefined;
let operations = Promise.resolve();

function serialize<T>(operation: () => Promise<T>): Promise<T> {
    const result = operations.then(operation, operation);
    operations = result.then(() => undefined, () => undefined);
    return result;
}

function settings() {
    const clientId = process.env.TWITCH_CLIENT_ID?.trim();
    const clientSecret = process.env.TWITCH_CLIENT_SECRET?.trim();
    const expectedLogin = process.env.TWITCH_BOT_USERNAME?.trim().toLowerCase();
    const redirectUri = process.env.TWITCH_REDIRECT_URI?.trim()
        || `${(process.env.DASHBOARD_URL || process.env.PUBLIC_URL || 'http://localhost:3000').replace(/\/$/, '')}/api/auth/twitch/callback`;
    const encryptionSecret = process.env.TWITCH_TOKEN_ENC_KEY;
    if (!clientId || !clientSecret || !expectedLogin || !redirectUri || !encryptionSecret) {
        throw new TwitchClipAuthError('not_configured');
    }
    return { clientId, clientSecret, expectedLogin, redirectUri, encryptionSecret };
}

function encryptionKey(): Buffer {
    return createHash('sha256').update(settings().encryptionSecret).digest();
}

function encrypt(value: string, purpose: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
    cipher.setAAD(Buffer.from(`twitch-clip-bot:${purpose}`));
    const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), encrypted.toString('base64url')].join('.');
}

function decrypt(value: string, purpose: string): string {
    try {
        const [version, iv, tag, ciphertext, extra] = value.split('.');
        if (version !== 'v1' || !iv || !tag || !ciphertext || extra !== undefined) throw new Error('Invalid ciphertext');
        const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(iv, 'base64url'));
        decipher.setAAD(Buffer.from(`twitch-clip-bot:${purpose}`));
        decipher.setAuthTag(Buffer.from(tag, 'base64url'));
        return Buffer.concat([decipher.update(Buffer.from(ciphertext, 'base64url')), decipher.final()]).toString('utf8');
    } catch {
        throw new TwitchClipAuthError('invalid_token');
    }
}

async function twitchFetch(url: string, init: RequestInit): Promise<Response> {
    try {
        return await fetch(url, { ...init, signal: AbortSignal.timeout(15_000) });
    } catch {
        throw new TwitchClipAuthError('provider_unavailable');
    }
}

async function exchange(params: Record<string, string>) {
    const config = settings();
    const response = await twitchFetch('https://id.twitch.tv/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ client_id: config.clientId, client_secret: config.clientSecret, ...params }),
    });
    if (!response.ok) throw new TwitchClipAuthError(response.status >= 500 || response.status === 429 ? 'provider_unavailable' : 'invalid_token');
    const result = tokenSchema.safeParse(await response.json().catch(() => null));
    if (!result.success) throw new TwitchClipAuthError('invalid_token');
    return result.data;
}

async function validateIdentity(accessToken: string) {
    const response = await twitchFetch('https://id.twitch.tv/oauth2/validate', { headers: { Authorization: `OAuth ${accessToken}` } });
    if (response.status === 401) return null;
    if (!response.ok) throw new TwitchClipAuthError('provider_unavailable');
    const parsed = identitySchema.safeParse(await response.json().catch(() => null));
    if (!parsed.success) throw new TwitchClipAuthError('invalid_token');
    const config = settings();
    const identity = parsed.data;
    if (identity.client_id !== config.clientId || identity.login.toLowerCase() !== config.expectedLogin
        || SCOPES.some(scope => !identity.scopes.includes(scope))) {
        throw new TwitchClipAuthError('identity_mismatch');
    }
    return identity;
}

export function invalidateTwitchClipBotToken(): void {
    validated = undefined;
}

export function getTwitchClipBotToken(): Promise<TwitchClipBotToken> {
    if (pending) return pending;
    pending = serialize(loadToken).finally(() => { pending = undefined; });
    return pending;
}

async function loadToken(): Promise<TwitchClipBotToken> {
    const config = settings();
    const row = await TwitchClipBotAuth.findByPk(BOT_ID);
    if (!row) throw new TwitchClipAuthError('not_connected');
    let accessToken = decrypt(row.encryptedAccessToken, 'access');
    const shouldRefresh = new Date(row.expiresAt).getTime() <= Date.now() + 60_000;
    const shouldValidate = !validated || validated.encryptedToken !== row.encryptedAccessToken
        || validated.expectedLogin !== config.expectedLogin || validated.clientId !== config.clientId
        || Date.now() - validated.at >= VALIDATION_INTERVAL_MS;
    if (shouldRefresh || shouldValidate) {
        let identity = shouldRefresh ? null : await validateIdentity(accessToken);
        if (!identity) {
            const tokens = await exchange({ grant_type: 'refresh_token', refresh_token: decrypt(row.encryptedRefreshToken, 'refresh') });
            accessToken = tokens.access_token;
            await row.update({
                encryptedAccessToken: encrypt(accessToken, 'access'),
                encryptedRefreshToken: encrypt(tokens.refresh_token, 'refresh'),
                expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
            });
            identity = await validateIdentity(accessToken);
            if (!identity || identity.user_id !== row.userId) throw new TwitchClipAuthError('identity_mismatch');
            await row.update({ expiresAt: new Date(Date.now() + identity.expires_in * 1000) });
        } else {
            if (identity.user_id !== row.userId) throw new TwitchClipAuthError('identity_mismatch');
            await row.update({ expiresAt: new Date(Date.now() + identity.expires_in * 1000) });
        }
        validated = { encryptedToken: row.encryptedAccessToken, at: Date.now(), expectedLogin: config.expectedLogin, clientId: config.clientId };
    }
    return { accessToken, userId: row.userId, login: row.login };
}

export async function beginTwitchClipBotConnection(actorId: string): Promise<{ url: string; state: string }> {
    const config = settings();
    const state = randomBytes(32).toString('base64url');
    await TwitchClipOAuthState.destroy({ where: { expiresAt: { [Op.lte]: new Date() } } });
    await TwitchClipOAuthState.create({ id: createHash('sha256').update(state).digest('hex'), actorId, expiresAt: new Date(Date.now() + STATE_TTL_MS) });
    const query = new URLSearchParams({ client_id: config.clientId, redirect_uri: config.redirectUri,
        response_type: 'code', scope: SCOPES.join(' '), state, force_verify: 'true' });
    return { url: `https://id.twitch.tv/oauth2/authorize?${query}`, state };
}

export async function completeTwitchClipBotConnection(actorId: string, code: string, state: string): Promise<void> {
    settings();
    const consumed = await TwitchClipOAuthState.destroy({ where: {
        id: createHash('sha256').update(state).digest('hex'), actorId, expiresAt: { [Op.gt]: new Date() },
    } });
    if (consumed !== 1) throw new TwitchClipAuthError('invalid_state');
    await serialize(async () => {
        const tokens = await exchange({ grant_type: 'authorization_code', code, redirect_uri: settings().redirectUri });
        const identity = await validateIdentity(tokens.access_token);
        if (!identity) throw new TwitchClipAuthError('invalid_token');
        await TwitchClipBotAuth.upsert({ id: BOT_ID, userId: identity.user_id, login: identity.login.toLowerCase(),
            encryptedAccessToken: encrypt(tokens.access_token, 'access'), encryptedRefreshToken: encrypt(tokens.refresh_token, 'refresh'),
            expiresAt: new Date(Date.now() + identity.expires_in * 1000) });
        invalidateTwitchClipBotToken();
    });
}

export async function disconnectTwitchClipBot(): Promise<void> {
    await serialize(async () => {
        await TwitchClipBotAuth.destroy({ where: { id: BOT_ID } });
        await TwitchClipOAuthState.destroy({ where: {} });
        invalidateTwitchClipBotToken();
    });
}

export async function getTwitchClipBotStatus() {
    const row = await TwitchClipBotAuth.findByPk(BOT_ID, { attributes: ['login'] });
    let configured = true;
    try { settings(); } catch { configured = false; }
    return { configured, connected: Boolean(row), login: row?.login ?? null,
        expectedLogin: process.env.TWITCH_BOT_USERNAME?.trim().toLowerCase() || null,
        jobsEnabled: process.env.JOBS_ENABLED === '1' };
}
