import { vi } from 'vitest';
import { ChannelType, User, TextChannel } from 'discord.js';

/**
 * Creates a mock Discord text channel with send capability
 * This is a simplified version of createMockTextChannel for service tests
 */
export function createMockChannelWithSend(overrides: Omit<Partial<TextChannel>, 'toString' | 'valueOf'> = {}): TextChannel {
    const channelId = overrides.id || 'channel-123';
    const channelMention = `<#${channelId}>` as const;
    return {
        id: channelId,
        type: ChannelType.GuildText,
        isTextBased: () => true,
        send: vi.fn(async (content: any) => ({ id: 'msg-123', content } as any)),
        toString: (): `<#${string}>` => channelMention,
        valueOf: () => channelId,
        ...overrides,
    } as unknown as TextChannel;
}

/**
 * Creates a mock Discord user with DM capability
 */
export function createMockUserWithDM(overrides: Omit<Partial<User>, 'toString' | 'valueOf'> = {}): User {
    const userId = overrides.id || 'user-123';
    const userMention = `<@${userId}>` as const;
    return {
        id: userId,
        tag: 'TestUser#1234',
        username: 'TestUser',
        discriminator: '1234',
        bot: false,
        send: vi.fn(async (content: any) => ({ id: 'dm-123', content } as any)),
        toString: (): `<@${string}>` => userMention,
        valueOf: () => userId,
        ...overrides,
    } as unknown as User;
}

/**
 * Helper to create a date for testing
 */
export function createTestDate(dateString: string): Date {
    return new Date(dateString);
}

/**
 * Helper to advance time in tests (requires vi.useFakeTimers())
 */
export function advanceTime(ms: number): void {
    vi.advanceTimersByTime(ms);
}

/**
 * Helper to reset time to real timers
 */
export function resetTime(): void {
    vi.useRealTimers();
}
