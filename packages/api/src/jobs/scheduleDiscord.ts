const base = 'https://discord.com/api/v10';
type Payload = Record<string, unknown>;

async function request(path: string, method: string, payload: Payload): Promise<Response | null> {
    const token = process.env.DISCORD_BOT_TOKEN;
    if (!token) return null;
    try {
        return await fetch(`${base}${path}`, { method, headers: { Authorization: `Bot ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(payload), signal: AbortSignal.timeout(15_000) });
    } catch { return null; }
}

export async function sendScheduleMessage(userId: string, payload: Payload): Promise<
    { status: 'sent'; messageId: string; channelId: string } | { status: 'rejected' | 'uncertain' }
> {
    const dm = await request('/users/@me/channels', 'POST', { recipient_id: userId });
    if (!dm?.ok) return { status: 'rejected' };
    const channel: unknown = await dm.json().catch(() => null);
    if (!channel || typeof channel !== 'object' || !('id' in channel) || typeof channel.id !== 'string' || !/^\d+$/.test(channel.id)) return { status: 'rejected' };
    const response = await request(`/channels/${channel.id}/messages`, 'POST', payload);
    if (!response) return { status: 'uncertain' };
    if (!response.ok) return { status: response.status >= 500 ? 'uncertain' : 'rejected' };
    const message: unknown = await response.json().catch(() => null);
    if (!message || typeof message !== 'object' || !('id' in message) || typeof message.id !== 'string' || !/^\d+$/.test(message.id)) return { status: 'uncertain' };
    return { status: 'sent', messageId: message.id, channelId: channel.id };
}

export async function editScheduleMessage(channelId: string, messageId: string, payload: Payload): Promise<'edited' | 'missing' | 'retry'> {
    if (!/^\d+$/.test(channelId) || !/^\d+$/.test(messageId)) return 'missing';
    const response = await request(`/channels/${channelId}/messages/${messageId}`, 'PATCH', payload);
    return response?.ok ? 'edited' : response?.status === 404 || response?.status === 403 ? 'missing' : 'retry';
}
