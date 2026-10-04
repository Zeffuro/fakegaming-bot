export interface TwitchClipRuntimeStatus {
    chatConnected: boolean;
    subscribedChannels: number;
    lastErrorCode: string | null;
}

let status: TwitchClipRuntimeStatus = { chatConnected: false, subscribedChannels: 0, lastErrorCode: null };

export function getTwitchClipRuntimeStatus(): TwitchClipRuntimeStatus {
    return { ...status };
}

export function setTwitchClipRuntimeStatus(update: Partial<TwitchClipRuntimeStatus>): void {
    status = { ...status, ...update };
}
