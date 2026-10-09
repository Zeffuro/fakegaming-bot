import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { Op } from 'sequelize';
import { z } from 'zod';
import { CalendarConnection, CalendarOAuthState, CalendarSource } from '@zeffuro/fakegaming-common/models';
import { serializedTransaction } from '@zeffuro/fakegaming-common/managers';

export const GOOGLE_SCOPES = ['https://www.googleapis.com/auth/calendar.calendarlist.readonly', 'https://www.googleapis.com/auth/calendar.events.readonly'];
export class CalendarError extends Error {
    constructor(public readonly code: 'not_configured' | 'not_connected' | 'invalid_state' | 'invalid_token' | 'provider_unavailable' | 'invalid_snapshot' | 'conflict' | 'not_found') {
        super(`Google Calendar operation failed: ${code}`);
    }
}

export function calendarSettings() {
    const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID?.trim();
    const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET?.trim();
    const redirectUri = process.env.GOOGLE_CALENDAR_REDIRECT_URI?.trim();
    const encryptionSecret = process.env.GOOGLE_CALENDAR_TOKEN_ENC_KEY;
    if (!clientId || !clientSecret || !redirectUri || !encryptionSecret || encryptionSecret.length < 32) throw new CalendarError('not_configured');
    try { const url = new URL(redirectUri); if (!['http:', 'https:'].includes(url.protocol)) throw new Error(); } catch { throw new CalendarError('not_configured'); }
    return { clientId, clientSecret, redirectUri, encryptionSecret };
}

export function encryptCalendarSecret(value: string, userId: string, purpose: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', createHash('sha256').update(calendarSettings().encryptionSecret).digest(), iv);
    cipher.setAAD(Buffer.from(`google-calendar:${userId}:${purpose}`));
    const bytes = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), bytes.toString('base64url')].join('.');
}

export function decryptCalendarSecret(value: string, userId: string, purpose: string): string {
    try {
        const [version, iv, tag, ciphertext, extra] = value.split('.');
        if (version !== 'v1' || !iv || !tag || !ciphertext || extra) throw new Error();
        const cipher = createDecipheriv('aes-256-gcm', createHash('sha256').update(calendarSettings().encryptionSecret).digest(), Buffer.from(iv, 'base64url'));
        cipher.setAAD(Buffer.from(`google-calendar:${userId}:${purpose}`));
        cipher.setAuthTag(Buffer.from(tag, 'base64url'));
        return Buffer.concat([cipher.update(Buffer.from(ciphertext, 'base64url')), cipher.final()]).toString('utf8');
    } catch { throw new CalendarError('invalid_token'); }
}

export async function googleJson(url: string, init: RequestInit = {}): Promise<unknown> {
    try {
        const response = await fetch(url, { ...init, signal: AbortSignal.timeout(15_000) });
        if (!response.ok) throw new CalendarError(response.status === 401 || response.status === 400 ? 'invalid_token' : 'provider_unavailable');
        const reader = response.body?.getReader();
        if (!reader) throw new CalendarError('invalid_snapshot');
        const chunks: Uint8Array[] = [];
        let size = 0;
        try {
            while (true) {
                const part = await reader.read();
                if (part.done) break;
                size += part.value.length;
                if (size > 2_000_000) throw new CalendarError('invalid_snapshot');
                chunks.push(part.value);
            }
        } finally { await reader.cancel().catch(() => undefined); }
        return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
    } catch (error) { if (error instanceof CalendarError) throw error; throw new CalendarError('provider_unavailable'); }
}

const tokenSchema = z.object({ access_token: z.string().min(1), refresh_token: z.string().min(1).optional(), expires_in: z.number().positive().max(86400), scope: z.string().optional() });
async function exchange(params: Record<string, string>) {
    const config = calendarSettings();
    const parsed = tokenSchema.safeParse(await googleJson('https://oauth2.googleapis.com/token', {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ client_id: config.clientId, client_secret: config.clientSecret, ...params }),
    }));
    if (!parsed.success || (parsed.data.scope && GOOGLE_SCOPES.some(scope => !parsed.data.scope!.split(' ').includes(scope)))) throw new CalendarError('invalid_token');
    return parsed.data;
}

const digest = (value: string) => createHash('sha256').update(value).digest('hex');

export async function beginCalendarConnection(userId: string, browserBinding: string) {
    const config = calendarSettings();
    const state = randomBytes(32).toString('base64url');
    const verifier = randomBytes(48).toString('base64url');
    const database = CalendarConnection.sequelize!;
    await serializedTransaction(database, async transaction => {
        await CalendarConnection.findOrCreate({ where: { userId }, defaults: { userId }, transaction });
        const row = await CalendarConnection.findByPk(userId, { transaction, lock: transaction.LOCK.UPDATE });
        if (!row) throw new CalendarError('conflict');
        await CalendarOAuthState.destroy({ where: { userId }, transaction });
        await CalendarOAuthState.destroy({ where: { expiresAt: { [Op.lte]: Date.now() } }, transaction });
        await CalendarOAuthState.create({ id: digest(state), userId,
            encryptedVerifier: encryptCalendarSecret(JSON.stringify({ verifier, version: row.version, browserHash: digest(browserBinding) }), userId, 'verifier'), expiresAt: Date.now() + 600_000 }, { transaction });
    });
    const query = new URLSearchParams({ client_id: config.clientId, redirect_uri: config.redirectUri, response_type: 'code',
        scope: GOOGLE_SCOPES.join(' '), access_type: 'offline', prompt: 'consent', state,
        code_challenge: createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256' });
    return { url: `https://accounts.google.com/o/oauth2/v2/auth?${query}`, state };
}

export async function completeCalendarConnection(userId: string, code: string, state: string, browserBinding: string): Promise<void> {
    calendarSettings();
    const pending = await CalendarOAuthState.findOne({ where: { id: digest(state), userId, expiresAt: { [Op.gt]: Date.now() } } });
    if (!pending) throw new CalendarError('invalid_state');
    const parsed = z.object({ verifier: z.string(), version: z.number().int().positive(), browserHash: z.string() }).safeParse(JSON.parse(decryptCalendarSecret(pending.encryptedVerifier, userId, 'verifier')));
    if (!parsed.success || parsed.data.browserHash !== digest(browserBinding)) throw new CalendarError('invalid_state');
    const consumed = await CalendarOAuthState.destroy({ where: { id: pending.id, userId, expiresAt: { [Op.gt]: Date.now() } } });
    if (consumed !== 1) throw new CalendarError('invalid_state');
    const tokens = await exchange({ grant_type: 'authorization_code', code, code_verifier: parsed.data.verifier, redirect_uri: calendarSettings().redirectUri });
    const refreshToken = tokens.refresh_token;
    if (!refreshToken) throw new CalendarError('invalid_token');
    await serializedTransaction(CalendarConnection.sequelize!, async transaction => {
        const connection = await CalendarConnection.findByPk(userId, { transaction, lock: transaction.LOCK.UPDATE });
        if (!connection || connection.version !== parsed.data.version) throw new CalendarError('conflict');
        await connection.update({ encryptedAccessToken: encryptCalendarSecret(tokens.access_token, userId, 'access'),
            encryptedRefreshToken: encryptCalendarSecret(refreshToken, userId, 'refresh'), expiresAt: Date.now() + tokens.expires_in * 1000,
            status: 'connected', version: parsed.data.version + 1 }, { transaction });
        const sources = await CalendarSource.findAll({ where: { userId }, transaction, lock: transaction.LOCK.UPDATE });
        for (const source of sources) await source.update({ version: source.version + 1, lastSyncedAt: null }, { transaction });
    });
}

const refreshing = new Map<string, Promise<string>>();
export async function getCalendarToken(userId: string): Promise<string> {
    calendarSettings();
    const existing = refreshing.get(userId);
    if (existing) return existing;
    const pending = loadToken(userId).finally(() => refreshing.delete(userId));
    refreshing.set(userId, pending);
    return pending;
}

async function loadToken(userId: string): Promise<string> {
    const row = await CalendarConnection.findByPk(userId);
    if (!row || row.status !== 'connected' || !row.encryptedAccessToken || !row.encryptedRefreshToken) throw new CalendarError('not_connected');
    if (Number(row.expiresAt) > Date.now() + 60_000) return decryptCalendarSecret(row.encryptedAccessToken, userId, 'access');
    const tokens = await exchange({ grant_type: 'refresh_token', refresh_token: decryptCalendarSecret(row.encryptedRefreshToken, userId, 'refresh') });
    const [changed] = await CalendarConnection.update({ encryptedAccessToken: encryptCalendarSecret(tokens.access_token, userId, 'access'),
        encryptedRefreshToken: tokens.refresh_token ? encryptCalendarSecret(tokens.refresh_token, userId, 'refresh') : row.encryptedRefreshToken,
        expiresAt: Date.now() + tokens.expires_in * 1000, version: row.version + 1 }, { where: { userId, status: 'connected', version: row.version } });
    if (changed !== 1) throw new CalendarError('conflict');
    return tokens.access_token;
}

export async function disconnectCalendar(userId: string): Promise<void> {
    await serializedTransaction(CalendarConnection.sequelize!, async transaction => {
        const row = await CalendarConnection.findByPk(userId, { transaction, lock: transaction.LOCK.UPDATE });
        if (row) await row.update({ status: 'disconnected', version: row.version + 1, encryptedAccessToken: null, encryptedRefreshToken: null, expiresAt: 0 }, { transaction });
        await CalendarOAuthState.destroy({ where: { userId }, transaction });
        const sources = await CalendarSource.findAll({ where: { userId }, transaction, lock: transaction.LOCK.UPDATE });
        for (const source of sources) await source.update({ enabled: false, version: source.version + 1 }, { transaction });
    });
}

export async function calendarStatus(userId: string) {
    let configured = true;
    try { calendarSettings(); } catch { configured = false; }
    const row = await CalendarConnection.findByPk(userId, { attributes: ['status'] });
    return { configured, connected: row?.status === 'connected' };
}
