import { createHash, randomBytes } from "node:crypto";
import { cacheDel, cacheGet, cacheSet } from "@zeffuro/fakegaming-common";
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

export async function createRefreshSession(params: {
    user: RefreshSessionUser;
    discordRefreshToken?: string | null;
    nowMs?: number;
}): Promise<IssuedRefreshSession> {
    const nowMs = params.nowMs ?? Date.now();
    const token = generateRefreshToken();
    const record: RefreshSessionRecord = {
        version: 1,
        user: params.user,
        createdAt: nowMs,
        updatedAt: nowMs,
        absoluteExpiresAt: nowMs + REFRESH_SESSION_ABSOLUTE_MAX_AGE_SECONDS * 1000,
        discordRefreshToken: params.discordRefreshToken ?? null
    };

    await cacheSet(refreshSessionKey(token), record, getTtlMs(record, nowMs));
    return { token, record };
}

export async function getRefreshSession(token: string | undefined, nowMs: number = Date.now()): Promise<RefreshSessionRecord | null> {
    if (!token) return null;

    const key = refreshSessionKey(token);
    const record = await cacheGet<RefreshSessionRecord>(key);
    if (!record) return null;

    if (record.absoluteExpiresAt <= nowMs) {
        await cacheDel(key);
        return null;
    }

    return record;
}

export async function rotateRefreshSession(token: string | undefined, nowMs: number = Date.now()): Promise<IssuedRefreshSession | null> {
    if (!token) return null;

    const oldKey = refreshSessionKey(token);
    const record = await getRefreshSession(token, nowMs);
    if (!record) return null;

    const newToken = generateRefreshToken();
    const newRecord: RefreshSessionRecord = {
        ...record,
        updatedAt: nowMs
    };

    await cacheDel(oldKey);
    await cacheSet(refreshSessionKey(newToken), newRecord, getTtlMs(newRecord, nowMs));
    return { token: newToken, record: newRecord };
}

export async function updateRefreshSession(token: string | undefined, updates: {
    discordRefreshToken?: string | null;
}, nowMs: number = Date.now()): Promise<boolean> {
    if (!token) return false;

    const key = refreshSessionKey(token);
    const record = await getRefreshSession(token, nowMs);
    if (!record) return false;

    const updatedRecord: RefreshSessionRecord = {
        ...record,
        ...updates,
        updatedAt: nowMs
    };
    await cacheSet(key, updatedRecord, getTtlMs(updatedRecord, nowMs));
    return true;
}

export async function revokeRefreshSession(token: string | undefined): Promise<void> {
    if (!token) return;
    await cacheDel(refreshSessionKey(token));
}

