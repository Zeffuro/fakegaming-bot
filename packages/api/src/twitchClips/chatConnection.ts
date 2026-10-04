import { z } from 'zod';
import { twitchClipChatMessageSchema, type TwitchClipChatMessage } from './chatMessage.js';

const EVENTSUB_URL = 'wss://eventsub.wss.twitch.tv/ws?keepalive_timeout_seconds=30';
const envelopeSchema = z.object({
    metadata: z.object({ message_type: z.string(), message_timestamp: z.string().optional() }),
    payload: z.object({
        session: z.object({
            id: z.string(),
            keepalive_timeout_seconds: z.number().nullable().optional(),
            reconnect_url: z.string().nullable().optional(),
        }).optional(),
        subscription: z.object({ type: z.string(), id: z.string().optional() }).optional(),
        event: z.unknown().optional(),
    }),
});

interface ChatConnectionOptions {
    subscribe: (sessionId: string, broadcasterId: string) => Promise<string>;
    unsubscribe: (subscriptionId: string) => Promise<void>;
    onMessage: (message: TwitchClipChatMessage) => Promise<void>;
    onStatus: (connected: boolean, channelCount: number, errorCode: string | null) => void;
    socketFactory?: (url: string) => WebSocket;
}

export class TwitchClipChatConnection {
    private socket: WebSocket | null = null;
    private replacement: WebSocket | null = null;
    private sessionId: string | null = null;
    private channels = new Set<string>();
    private subscriptions = new Map<string, string>();
    private timers = new Map<WebSocket, ReturnType<typeof setTimeout>>();
    private retryTimer: ReturnType<typeof setTimeout> | null = null;
    private failures = 0;
    private stopped = true;
    private syncing: Promise<void> | null = null;
    private revision = 0;

    constructor(private readonly options: ChatConnectionOptions) {}

    async setChannels(channelIds: string[]): Promise<void> {
        const desired = new Set(channelIds);
        if (desired.size > 100) throw new Error('Twitch clip chat channel limit exceeded');
        this.channels = desired;
        this.revision++;
        if (desired.size === 0) {
            this.stop();
            return;
        }
        this.stopped = false;
        if (!this.socket && !this.retryTimer) this.open(EVENTSUB_URL, false);
        if (this.sessionId) await this.syncSubscriptions();
    }

    stop(): void {
        this.stopped = true;
        this.revision++;
        if (this.retryTimer) clearTimeout(this.retryTimer);
        this.retryTimer = null;
        for (const timer of this.timers.values()) clearTimeout(timer);
        this.timers.clear();
        const sockets = [this.socket, this.replacement];
        this.socket = null;
        this.replacement = null;
        this.sessionId = null;
        this.subscriptions.clear();
        for (const socket of sockets) socket?.close();
        this.options.onStatus(false, 0, null);
    }

    private open(url: string, replacing: boolean): void {
        if (this.stopped) return;
        let socket: WebSocket;
        try {
            socket = (this.options.socketFactory ?? (address => new WebSocket(address)))(url);
        } catch {
            this.retry('chat_connection_failed');
            return;
        }
        if (replacing) this.replacement = socket;
        else this.socket = socket;
        this.watch(socket, 20_000);
        socket.addEventListener('message', event => {
            void this.receive(socket, event.data).catch(() => {
                this.options.onStatus(Boolean(this.sessionId), this.subscriptions.size, 'chat_event_failed');
            });
        });
        socket.addEventListener('error', () => socket.close());
        socket.addEventListener('close', () => this.closed(socket));
    }

    private watch(socket: WebSocket, milliseconds: number): void {
        const previous = this.timers.get(socket);
        if (previous) clearTimeout(previous);
        const timer = setTimeout(() => socket.close(), milliseconds);
        timer.unref?.();
        this.timers.set(socket, timer);
    }

    private async receive(socket: WebSocket, data: unknown): Promise<void> {
        if (this.stopped || (socket !== this.socket && socket !== this.replacement)) return;
        if (typeof data !== 'string' || data.length > 1024 * 1024) return;
        let json: unknown;
        try { json = JSON.parse(data); } catch { return; }
        const parsed = envelopeSchema.safeParse(json);
        if (!parsed.success) return;
        const { metadata, payload } = parsed.data;
        this.watch(socket, 40_000);

        if (metadata.message_type === 'session_welcome' && payload.session) {
            this.revision++;
            if (socket === this.replacement) {
                const oldSocket = this.socket;
                this.socket = socket;
                this.replacement = null;
                this.sessionId = payload.session.id;
                oldSocket?.close();
            } else {
                this.sessionId = payload.session.id;
                this.subscriptions.clear();
            }
            this.watch(socket, ((payload.session.keepalive_timeout_seconds ?? 30) + 5) * 1000);
            await this.syncSubscriptions();
            return;
        }

        if (metadata.message_type === 'session_reconnect') {
            const reconnectUrl = payload.session?.reconnect_url;
            if (reconnectUrl && !this.replacement) {
                const url = new URL(reconnectUrl);
                if (url.protocol === 'wss:' && url.hostname === 'eventsub.wss.twitch.tv' && !url.username && !url.password) {
                    this.open(reconnectUrl, true);
                }
            }
            return;
        }

        if (metadata.message_type === 'revocation') {
            for (const [channel, id] of this.subscriptions) {
                if (id === payload.subscription?.id) this.subscriptions.delete(channel);
            }
            this.options.onStatus(true, this.subscriptions.size, 'chat_authorization_revoked');
            return;
        }

        if (metadata.message_type !== 'notification' || payload.subscription?.type !== 'channel.chat.message') return;
        const timestamp = Date.parse(metadata.message_timestamp ?? '');
        const age = Date.now() - timestamp;
        if (!Number.isFinite(timestamp) || age > 30_000 || age < -10_000) return;
        const message = twitchClipChatMessageSchema.safeParse(payload.event);
        if (message.success && this.channels.has(message.data.broadcaster_user_id)) {
            await this.options.onMessage(message.data);
        }
    }

    private async syncSubscriptions(): Promise<void> {
        if (this.syncing) return this.syncing;
        this.syncing = (async () => {
            let revision: number;
            do {
                revision = this.revision;
                await this.sync();
            } while (revision !== this.revision && !this.stopped);
        })();
        try { await this.syncing; } finally { this.syncing = null; }
    }

    private async sync(): Promise<void> {
        const sessionId = this.sessionId;
        if (!sessionId || this.stopped) return;
        let failed = false;
        for (const [channel, subscriptionId] of this.subscriptions) {
            if (!this.channels.has(channel)) {
                try {
                    await this.options.unsubscribe(subscriptionId);
                    this.subscriptions.delete(channel);
                } catch { failed = true; }
            }
        }
        for (const channel of this.channels) {
            if (this.subscriptions.has(channel)) continue;
            if (this.stopped || this.sessionId !== sessionId) return;
            try {
                const id = await this.options.subscribe(sessionId, channel);
                if (!this.stopped && this.sessionId === sessionId && this.channels.has(channel)) {
                    this.subscriptions.set(channel, id);
                } else {
                    await this.options.unsubscribe(id);
                }
            } catch { failed = true; }
        }
        if (this.stopped || this.sessionId !== sessionId) return;
        if (this.subscriptions.size > 0) this.failures = 0;
        this.options.onStatus(true, this.subscriptions.size, failed ? 'chat_subscription_failed' : null);
    }

    private closed(socket: WebSocket): void {
        const timer = this.timers.get(socket);
        if (timer) clearTimeout(timer);
        this.timers.delete(socket);
        if (socket === this.replacement) {
            this.replacement = null;
            if (!this.socket) this.retry('chat_disconnected');
            return;
        }
        if (socket !== this.socket) return;
        this.socket = null;
        this.sessionId = null;
        this.subscriptions.clear();
        if (!this.replacement) this.retry('chat_disconnected');
    }

    private retry(errorCode: string): void {
        this.options.onStatus(false, 0, errorCode);
        if (this.stopped || this.retryTimer) return;
        const delay = Math.min(60_000, 1000 * 2 ** Math.min(this.failures++, 6));
        this.retryTimer = setTimeout(() => {
            this.retryTimer = null;
            this.open(EVENTSUB_URL, false);
        }, delay);
        this.retryTimer.unref?.();
    }
}
