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


