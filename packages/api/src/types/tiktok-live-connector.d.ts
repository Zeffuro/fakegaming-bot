declare module 'tiktok-live-connector' {
    export interface TikTokLiveConnectionOptions {
        fetchRoomInfoOnConnect?: boolean;
        enableExtendedGiftInfo?: boolean;
        webClientOptions?: Record<string, unknown>;
        wsClientOptions?: Record<string, unknown>;
        sessionId?: string | null;
        ttTargetIdc?: string | null;
        disableEulerFallbacks?: boolean;
        signedWebSocketProvider?: (props: unknown) => Promise<unknown>;
    }

    export class TikTokLiveConnection {
        constructor(uniqueId?: string, options?: TikTokLiveConnectionOptions);
        connect(roomId?: string): Promise<{ roomId?: string; roomInfo?: unknown } | unknown>;
        disconnect(): Promise<void>;
        roomId?: string;
        roomInfo?: unknown;
    }

    // Minimal SignConfig surface used by our code
    export const SignConfig: {
        apiKey?: string;
        basePath?: string;
        baseOptions?: { headers?: Record<string, string> };
    };
}
