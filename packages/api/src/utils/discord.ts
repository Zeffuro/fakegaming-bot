import { getLogger } from '@zeffuro/fakegaming-common';

const log = getLogger({ name: 'api:discord' });
const DISCORD_API_BASE = 'https://discord.com/api/v10';

interface DiscordPostOptions {
    path: string;
    payload: Record<string, unknown>;
    logContext: Record<string, unknown>;
    missingTokenMessage: string;
    failureMessage: string;
    exceptionMessage: string;
}

function getBotToken(missingTokenMessage: string): string | null {
    const token = process.env.DISCORD_BOT_TOKEN;
    if (!token) {
        log.warn(missingTokenMessage);
        return null;
    }
    return token;
}

async function postDiscordJson({
    path,
    payload,
    logContext,
    missingTokenMessage,
    failureMessage,
    exceptionMessage
}: DiscordPostOptions): Promise<any | null> {
    const token = getBotToken(missingTokenMessage);
    if (!token) return null;

    try {
        const res = await fetch(`${DISCORD_API_BASE}${path}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bot ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (res.status === 429) {
            const retryAfter = Number(res.headers.get('retry-after') || '1');
            log.warn({ ...logContext, retryAfter }, 'Discord rate limited while sending message');
        }

        if (!res.ok) {
            const bodyText = await res.text().catch(() => '');
            log.warn({ ...logContext, status: res.status, body: bodyText.slice(0, 512) }, failureMessage);
            return null;
        }

        return await res.json();
    } catch (err) {
        log.error({ ...logContext, err }, exceptionMessage);
        return null;
    }
}

async function sendChannelPayload(channelId: string, payload: Record<string, unknown>): Promise<any | null> {
    return await postDiscordJson({
        path: `/channels/${channelId}/messages`,
        payload,
        logContext: { channelId },
        missingTokenMessage: 'DISCORD_BOT_TOKEN is not set; cannot send Discord messages',
        failureMessage: 'Failed to send Discord message',
        exceptionMessage: 'Error sending Discord message'
    });
}

async function createDmChannel(userId: string): Promise<string | null> {
    const dm = await postDiscordJson({
        path: '/users/@me/channels',
        payload: { recipient_id: userId },
        logContext: { userId },
        missingTokenMessage: 'DISCORD_BOT_TOKEN is not set; cannot send direct messages',
        failureMessage: 'Failed to create DM channel',
        exceptionMessage: 'Error creating DM channel'
    });
    if (!dm) return null;

    const channelId = (dm as { id?: unknown }).id;
    if (typeof channelId !== 'string') {
        log.warn({ userId }, 'DM channel response missing id');
        return null;
    }

    return channelId;
}

/**
 * Send a simple message to a Discord text channel using the bot token.
 * Returns the created message JSON on success or null on failure.
 */
export async function sendChannelMessage(channelId: string, content: string): Promise<any | null> {
    return await sendChannelPayload(channelId, { content });
}

/**
 * Send a message to a channel with a raw payload (supports embeds, components, etc.).
 * Payload must conform to Discord create message JSON shape.
 */
export async function sendChannelMessagePayload(channelId: string, payload: Record<string, unknown>): Promise<any | null> {
    return await sendChannelPayload(channelId, payload);
}

/**
 * Send a direct message (DM) to a Discord user by creating a DM channel then posting.
 * Returns the created message JSON on success or null on failure.
 */
export async function sendDirectMessage(userId: string, content: string): Promise<any | null> {
    const channelId = await createDmChannel(userId);
    return channelId ? await sendChannelMessage(channelId, content) : null;
}

/**
 * Send a direct message (DM) with a raw payload by creating a DM channel then posting.
 */
export async function sendDirectMessagePayload(userId: string, payload: Record<string, unknown>): Promise<any | null> {
    const channelId = await createDmChannel(userId);
    return channelId ? await sendChannelMessagePayload(channelId, payload) : null;
}
