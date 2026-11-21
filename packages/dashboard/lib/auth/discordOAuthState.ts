import { randomBytes, timingSafeEqual } from 'node:crypto';
import { sanitizeReturnTo } from '@/lib/util/sanitizeReturnTo';

const maxAge = 600;
const statePattern = /^[A-Za-z0-9_-]{43}$/;

export function discordOAuthCookie() {
    const secure = process.env.NODE_ENV === 'production';
    return { name: secure ? '__Host-fg-discord-oauth' : 'fg-discord-oauth', secure, httpOnly: true, sameSite: 'lax' as const, path: '/', maxAge };
}

export function createDiscordOAuthState(returnTo: string | null) {
    const state = randomBytes(32).toString('base64url');
    const record = { state, returnTo: sanitizeReturnTo(returnTo) ?? '/dashboard', expiresAt: Date.now() + maxAge * 1000 };
    return { state, value: Buffer.from(JSON.stringify(record)).toString('base64url') };
}

export function verifyDiscordOAuthState(value: string | undefined, state: string | null): string | null {
    if (!value || !state || !statePattern.test(state)) return null;
    try {
        const record = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
        if (typeof record.state !== 'string' || !statePattern.test(record.state)
            || !Number.isSafeInteger(record.expiresAt) || record.expiresAt <= Date.now()) return null;
        if (!timingSafeEqual(Buffer.from(state), Buffer.from(record.state))) return null;
        return sanitizeReturnTo(record.returnTo) ?? '/dashboard';
    } catch { return null; }
}
