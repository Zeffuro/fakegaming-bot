import { afterEach, describe, expect, it, vi } from 'vitest';
import { TwitchClipChatConnection } from '../chatConnection.js';

class FakeSocket extends EventTarget {
    closed = false;
    constructor(readonly url: string) { super(); }
    close(): void {
        if (this.closed) return;
        this.closed = true;
        this.dispatchEvent(new Event('close'));
    }
    sendEvent(messageType: string, payload: unknown, timestamp = new Date().toISOString()): void {
        this.dispatchEvent(new MessageEvent('message', {
            data: JSON.stringify({ metadata: { message_type: messageType, message_timestamp: timestamp }, payload }),
        }));
    }
}

const connections: TwitchClipChatConnection[] = [];
afterEach(() => {
    for (const connection of connections.splice(0)) connection.stop();
    vi.useRealTimers();
});

function setup() {
    const sockets: FakeSocket[] = [];
    const subscribe = vi.fn(async (_session: string, channel: string) => `sub-${channel}`);
    const unsubscribe = vi.fn(async () => undefined);
    const onMessage = vi.fn(async () => undefined);
    const onStatus = vi.fn();
    const connection = new TwitchClipChatConnection({
        subscribe, unsubscribe, onMessage, onStatus,
        socketFactory: url => {
            const socket = new FakeSocket(url);
            sockets.push(socket);
            return socket as unknown as WebSocket;
        },
    });
    connections.push(connection);
    return { connection, sockets, subscribe, unsubscribe, onMessage, onStatus };
}

async function welcome(socket: FakeSocket, id = 'session') {
    socket.sendEvent('session_welcome', { session: { id, keepalive_timeout_seconds: 30 } });
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
}

describe('Twitch clip EventSub WebSocket', () => {
    it('reconciles channel changes while a subscription is still pending', async () => {
        const test = setup();
        let resolveSubscription!: (id: string) => void;
        test.subscribe.mockImplementationOnce(() => new Promise<string>(resolve => { resolveSubscription = resolve; }));
        await test.connection.setChannels(['123']);
        await welcome(test.sockets[0]);
        const updated = test.connection.setChannels(['456']);
        resolveSubscription('sub-123');
        await updated;
        expect(test.unsubscribe).toHaveBeenCalledWith('sub-123');
        expect(test.subscribe).toHaveBeenLastCalledWith('session', '456');
        expect(test.onStatus).toHaveBeenLastCalledWith(true, 1, null);
    });

    it('deduplicates channels, subscribes after welcome and reconciles additions/removals', async () => {
        const test = setup();
        await test.connection.setChannels(['123', '123']);
        expect(test.subscribe).not.toHaveBeenCalled();
        await welcome(test.sockets[0]);
        expect(test.subscribe).toHaveBeenCalledExactlyOnceWith('session', '123');
        await test.connection.setChannels(['456']);
        expect(test.unsubscribe).toHaveBeenCalledWith('sub-123');
        expect(test.subscribe).toHaveBeenCalledWith('session', '456');
        await test.connection.setChannels([]);
        expect(test.sockets[0].closed).toBe(true);
    });

    it('passes current valid chat notifications and rejects malformed, stale or unrelated messages', async () => {
        const test = setup();
        await test.connection.setChannels(['123']);
        await welcome(test.sockets[0]);
        const event = {
            broadcaster_user_id: '123', broadcaster_user_name: 'Streamer', chatter_user_id: '456',
            chatter_user_name: 'Viewer', message_id: 'chat-id', message: { text: '!clip' }, badges: [],
        };
        const payload = { subscription: { type: 'channel.chat.message' }, event };
        test.sockets[0].sendEvent('notification', payload);
        test.sockets[0].sendEvent('notification', payload, new Date(Date.now() - 60_000).toISOString());
        test.sockets[0].sendEvent('notification', { ...payload, event: { ...event, broadcaster_user_id: 'other' } });
        test.sockets[0].sendEvent('notification', { ...payload, event: { message: { text: '!clip' } } });
        test.sockets[0].sendEvent('notification', { ...payload, subscription: { type: 'stream.online' } });
        test.sockets[0].dispatchEvent(new MessageEvent('message', { data: 'not json' }));
        await Promise.resolve();
        expect(test.onMessage).toHaveBeenCalledExactlyOnceWith(event);
    });

    it('hands over to a reconnect URL without closing the old socket or duplicating subscriptions early', async () => {
        const test = setup();
        await test.connection.setChannels(['123']);
        await welcome(test.sockets[0]);
        test.sockets[0].sendEvent('session_reconnect', {
            session: { id: 'session', reconnect_url: 'wss://eventsub.wss.twitch.tv/ws?reconnect=trusted' },
        });
        expect(test.sockets).toHaveLength(2);
        expect(test.sockets[0].closed).toBe(false);
        await welcome(test.sockets[1], 'replacement');
        expect(test.sockets[0].closed).toBe(true);
        expect(test.subscribe).toHaveBeenCalledTimes(1);
        expect(test.onStatus).toHaveBeenLastCalledWith(true, 1, null);
    });

    it('rejects untrusted reconnect addresses and restores subscriptions after unexpected disconnect', async () => {
        vi.useFakeTimers();
        const test = setup();
        await test.connection.setChannels(['123']);
        await welcome(test.sockets[0]);
        test.sockets[0].sendEvent('session_reconnect', {
            session: { id: 'session', reconnect_url: 'wss://example.com/ws' },
        });
        expect(test.sockets).toHaveLength(1);
        test.sockets[0].close();
        await vi.advanceTimersByTimeAsync(1000);
        expect(test.sockets).toHaveLength(2);
        await welcome(test.sockets[1], 'new');
        expect(test.subscribe).toHaveBeenCalledWith('new', '123');
        test.connection.stop();
        await vi.advanceTimersByTimeAsync(120_000);
        expect(test.sockets).toHaveLength(2);
    });

    it('reconnects after missing keepalives and reports failed subscriptions and revocations', async () => {
        vi.useFakeTimers();
        const test = setup();
        await test.connection.setChannels(['123']);
        test.subscribe.mockRejectedValueOnce(new Error('auth'));
        await welcome(test.sockets[0]);
        expect(test.onStatus).toHaveBeenLastCalledWith(true, 0, 'chat_subscription_failed');
        await test.connection.setChannels(['123']);
        test.sockets[0].sendEvent('revocation', { subscription: { type: 'channel.chat.message', id: 'sub-123' } });
        expect(test.onStatus).toHaveBeenLastCalledWith(true, 0, 'chat_authorization_revoked');
        await vi.advanceTimersByTimeAsync(41_000);
        expect(test.sockets[0].closed).toBe(true);
        expect(test.sockets.length).toBeGreaterThan(1);
    });

    it('refuses to silently sample configurations beyond the channel limit', async () => {
        const test = setup();
        await expect(test.connection.setChannels(Array.from({ length: 101 }, (_, i) => String(i)))).rejects.toThrow('limit');
        expect(test.sockets).toHaveLength(0);
    });
});
