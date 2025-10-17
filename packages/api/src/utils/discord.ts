import { getLogger } from '@zeffuro/fakegaming-common';

const log = getLogger({ name: 'api:discord' });

/**
 * Send a simple message to a Discord text channel using the bot token.
 * Returns the created message JSON on success or null on failure.
 */
export async function sendChannelMessage(channelId: string, content: string): Promise<any | null> {
    const token = process.env.DISCORD_BOT_TOKEN;
    if (!token) {
        log.warn('DISCORD_BOT_TOKEN is not set; cannot send Discord messages');
        return null;
    }
    try {
        const res = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
            method: 'POST',
            headers: {
                'Authorization': `Bot ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ content })
        });
        if (res.status === 429) {
            const retryAfter = Number(res.headers.get('retry-after') || '1');
            log.warn({ channelId, retryAfter }, 'Discord rate limited while sending message');
        }
        if (!res.ok) {
            const bodyText = await res.text().catch(() => '');
            log.warn({ status: res.status, body: bodyText.slice(0, 512), channelId }, 'Failed to send Discord message');
            return null;
        }
        return await res.json();
    } catch (err) {
        log.error({ err, channelId }, 'Error sending Discord message');
        return null;
    }
}

/**
 * Send a message to a channel with a raw payload (supports embeds, components, etc.).
 * Payload must conform to Discord create message JSON shape.
 */
export async function sendChannelMessagePayload(channelId: string, payload: Record<string, unknown>): Promise<any | null> {
    const token = process.env.DISCORD_BOT_TOKEN;
    if (!token) {
        log.warn('DISCORD_BOT_TOKEN is not set; cannot send Discord messages');
        return null;
    }
    try {
        const res = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
            method: 'POST',
            headers: {
                'Authorization': `Bot ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        if (res.status === 429) {
            const retryAfter = Number(res.headers.get('retry-after') || '1');
            log.warn({ channelId, retryAfter }, 'Discord rate limited while sending message');
        }
        if (!res.ok) {
            const bodyText = await res.text().catch(() => '');
            log.warn({ status: res.status, body: bodyText.slice(0, 512), channelId }, 'Failed to send Discord message');
            return null;
        }
        return await res.json();
    } catch (err) {
        log.error({ err, channelId }, 'Error sending Discord message');
        return null;
    }
}

/**
 * Send a direct message (DM) to a Discord user by creating a DM channel then posting.
 * Returns the created message JSON on success or null on failure.
 */
export async function sendDirectMessage(userId: string, content: string): Promise<any | null> {
    const token = process.env.DISCORD_BOT_TOKEN;
    if (!token) {
        log.warn('DISCORD_BOT_TOKEN is not set; cannot send direct messages');
        return null;
    }
    try {
        // Create (or reuse) a DM channel with the user
        const dmRes = await fetch('https://discord.com/api/v10/users/@me/channels', {
            method: 'POST',
            headers: {
                'Authorization': `Bot ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ recipient_id: userId })
        });
        if (!dmRes.ok) {
            const bodyText = await dmRes.text().catch(() => '');
            log.warn({ status: dmRes.status, body: bodyText.slice(0, 512), userId }, 'Failed to create DM channel');
            return null;
        }
        const dm = await dmRes.json();
        const channelId = dm?.id as string | undefined;
        if (!channelId) {
            log.warn({ userId }, 'DM channel response missing id');
            return null;
        }
        return await sendChannelMessage(channelId, content);
    } catch (err) {
        log.error({ err, userId }, 'Error sending direct message');
        return null;
    }
}
