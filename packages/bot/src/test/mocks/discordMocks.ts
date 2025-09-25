import {jest} from '@jest/globals';

export function createMockSend() {
    return jest.fn();
}

export function createMockChannel({send}: { send?: jest.Mock } = {}): Record<string, unknown> {
    return {
        isTextBased: () => true,
        type: 0, // GuildText
        send: send || createMockSend(),
    };
}

export function createMockUser({send}: { send?: jest.Mock } = {}): Record<string, unknown> {
    return {
        send: send || createMockSend(),
    };
}

export function createMockClient({channel, user}: { channel?: unknown, user?: unknown } = {}): Record<string, unknown> {
    return {
        channels: {
            fetch: jest.fn(() => Promise.resolve(channel || createMockChannel())),
            cache: {
                get: jest.fn(() => channel || createMockChannel()),
            },
        },
        users: {
            fetch: jest.fn(() => Promise.resolve(user || createMockUser())),
        },
    };
}
