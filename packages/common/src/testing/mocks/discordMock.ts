import { vi, beforeEach } from 'vitest';
import {
    PermissionsBitField,
    GuildMember,
    User,
    Guild,
    Channel,
    TextChannel,
    Message,
    CommandInteraction,
    ButtonInteraction,
    ModalSubmitInteraction,
    MessagePayload,
    MessageCreateOptions,
    InteractionType
} from 'discord.js';
import type {
    Client
} from 'discord.js';

/**
 * Helper function to create channel mention string
 */
function channelMention(id: string): `<#${string}>` {
    return `<#${id}>` as `<#${string}>`;
}

/**
 * Helper function to create user mention string
 */
function userMention(id: string): `<@${string}>` {
    return `<@${id}>` as `<@${string}>`;
}

/**
 * Creates a mock Discord User
 */
export function createMockUser(overrides: Partial<User> = {}): User {
    const userId = overrides.id || '123456789012345678';

    return {
        id: userId,
        username: 'testuser',
        discriminator: '0001',
        tag: 'testuser#0001',
        displayAvatarURL: vi.fn(() => 'https://example.com/avatar.png'),
        bot: false,
        system: false,
        flags: { bitfield: 0n },
        createdAt: new Date(),
        createdTimestamp: Date.now() - 1000000,
        avatar: 'test_avatar_hash',
        send: vi.fn(async () => createMockMessage()),
        dmChannel: null,
        toString: () => userMention(userId),
        valueOf: () => userId,
        ...overrides
    } as unknown as User;
}

/**
 * Creates a mock Discord Channel
 */
export function createMockChannel(overrides: Partial<Channel> = {}): Channel {
    const channelId = overrides.id || '929533532185956352';

    return {
        id: channelId,
        type: 0,
        send: vi.fn(async () => createMockMessage()),
        messages: {
            fetch: vi.fn(async () => createMockMessage()),
            cache: new Map(),
        },
        toString: () => channelMention(channelId),
        valueOf: () => channelId,
        ...overrides
    } as unknown as Channel;
}

/**
 * Creates a mock Discord TextChannel
 */
export function createMockTextChannel(overrides: Partial<TextChannel> = {}): TextChannel {
    const channelId = overrides.id || '929533532185956352';

    // Create a base channel without recursive guild creation
    const baseChannelProps = {
        id: channelId,
        type: 0,
        send: vi.fn(async () => createMockMessage()),
        messages: {
            fetch: vi.fn(async () => createMockMessage()),
            cache: new Map(),
        },
        toString: () => channelMention(channelId),
        valueOf: () => channelId,
    };

    return {
        ...baseChannelProps,
        name: 'test-channel',
        guild: createMockGuild(overrides.guild),
        permissionsFor: vi.fn(() => {
            return {
                has: vi.fn(() => true)
            };
        }),
        ...overrides
    } as unknown as TextChannel;
}

/**
 * Creates a mock Discord Guild
 */
export function createMockGuild(overrides: Partial<Guild> = {}): Guild {
    const guildId = overrides?.id || '135381928284343204';
    return {
        id: guildId,
        name: 'Test Guild',
        channels: {
            cache: new Map(),
            fetch: vi.fn(async (channelId: string) => createMockChannel({
                id: channelId,
                toString: () => channelMention(channelId),
                valueOf: () => channelId,
            })),
        },
        members: {
            cache: new Map(),
            fetch: vi.fn(async (userId: string) => {
                const member = createMockGuildMember({ id: userId });
                return member;
            }),
        },
        roles: {
            cache: new Map(),
            everyone: { id: 'everyone-role-id' },
        },
        toString: () => guildId,
        valueOf: () => guildId,
        ...overrides
    } as unknown as Guild;
}

/**
 * Creates a mock Discord GuildMember
 */
export function createMockGuildMember(overrides: Record<string, any> = {}): GuildMember {
    const userId = overrides.id || '123456789012345678';
    const guildId = overrides.guildId || '135381928284343204';

    // Create user without circular guild reference
    const user = {
        id: userId,
        username: 'testuser',
        discriminator: '0001',
        tag: 'testuser#0001',
        displayAvatarURL: vi.fn(() => 'https://example.com/avatar.png'),
        bot: false,
        system: false,
        flags: { bitfield: 0n },
        toString: () => userMention(userId),
        valueOf: () => userId,
    };

    return {
        id: userId,
        user: user as unknown as User,
        // Reference guild by ID only to avoid circular structure
        guild: {
            id: guildId,
            toString: () => guildId,
            valueOf: () => guildId
        } as unknown as Guild,
        displayName: user.username,
        nickname: null,
        permissions: new PermissionsBitField(BigInt('8')), // ADMINISTRATOR
        roles: {
            cache: new Map(),
            highest: { position: 1 },
        },
        toString: () => userMention(userId),
        valueOf: () => userId,
        ...overrides
    } as unknown as GuildMember;
}

/**
 * Creates a mock Discord Message
 */
export function createMockMessage(overrides: Partial<Message> = {}): Message {
    const messageId = overrides.id || '123456789123456789';

    return {
        id: messageId,
        content: 'Test message',
        author: createMockUser(),
        channel: createMockTextChannel(),
        guild: createMockGuild(),
        createdAt: new Date(),
        createdTimestamp: Date.now(),
        edit: vi.fn(async () => createMockMessage()),
        delete: vi.fn(async () => true),
        reply: vi.fn(async () => createMockMessage()),
        reactions: {
            cache: new Map(),
            resolve: vi.fn(),
        },
        valueOf: () => messageId,
        ...overrides
    } as unknown as Message;
}

/**
 * Creates a mock Discord Client
 */
export function createMockClient(overrides: Partial<Client> = {}): Client {
    return {
        user: createMockUser({
            id: 'bot-id',
            bot: true,
            toString: () => userMention('bot-id'),
            valueOf: () => 'bot-id' as string,
        }),
        guilds: {
            cache: new Map(),
            fetch: vi.fn(async (guildId: string) => createMockGuild({
                id: guildId,
                toString: () => guildId,
                valueOf: () => guildId as string,
            })),
        },
        channels: {
            cache: new Map(),
            fetch: vi.fn(async (channelId: string) => createMockChannel({
                id: channelId,
                toString: () => channelMention(channelId),
                valueOf: () => channelId as string,
            })),
        },
        users: {
            cache: new Map(),
            fetch: vi.fn(async (userId: string) => createMockUser({
                id: userId,
                toString: () => userMention(userId),
                valueOf: () => userId as string,
            })),
        },
        login: vi.fn(async () => 'mockToken'),
        destroy: vi.fn(),
        ...overrides
    } as unknown as Client;
}

/**
 * Creates a mock Discord CommandInteraction
 */
export function createMockCommandInteraction(overrides: Record<string, any> = {}): CommandInteraction {
    const interactionId = overrides.id || '987654321987654321';
    const guildId = overrides.guildId || '135381928284343204';
    const channelId = overrides.channelId || '929533532185956352';
    const userId = (overrides.user as User)?.id || '123456789012345678';

    const interactionOptions = overrides.options || {};
    const stringOptions = overrides.stringOptions || {};
    const userOptions = overrides.userOptions || {};
    const channelOptions = overrides.channelOptions || {};
    const integerOptions = overrides.integerOptions || {};
    const booleanOptions = overrides.booleanOptions || {};

    // Remove custom properties that would conflict with the cast
    const {
        stringOptions: _,
        userOptions: __,
        channelOptions: ___,
        integerOptions: ____,
        booleanOptions: _____,
        ...cleanOverrides
    } = overrides;

    return {
        id: interactionId,
        type: InteractionType.ApplicationCommand,
        user: createMockUser({
            id: userId,
            toString: () => userMention(userId),
            valueOf: () => userId
        }),
        member: createMockGuildMember({ id: userId }),
        guild: createMockGuild({
            id: guildId,
            toString: () => guildId,
            valueOf: () => guildId
        }),
        guildId,
        channelId,
        channel: createMockTextChannel({
            id: channelId,
            toString: () => channelMention(channelId),
            valueOf: () => channelId
        }),
        commandName: 'test-command',
        options: {
            getString: vi.fn((name: string) => stringOptions[name] || null),
            getUser: vi.fn((name: string) => {
                if (!userOptions[name]) return null;
                return createMockUser({
                    id: userOptions[name],
                    toString: () => userMention(userOptions[name]),
                    valueOf: () => userOptions[name]
                });
            }),
            getChannel: vi.fn((name: string) => {
                if (!channelOptions[name]) return null;
                return createMockChannel({
                    id: channelOptions[name],
                    toString: () => channelMention(channelOptions[name]),
                    valueOf: () => channelOptions[name]
                });
            }),
            getInteger: vi.fn((name: string) => integerOptions[name] || null),
            getBoolean: vi.fn((name: string) => booleanOptions[name] || null),
            getSubcommand: vi.fn(() => overrides.subcommand || null),
            ...interactionOptions,
        },
        reply: vi.fn(async () => undefined),
        editReply: vi.fn(async () => createMockMessage()),
        deleteReply: vi.fn(async () => true),
        followUp: vi.fn(async () => createMockMessage()),
        deferReply: vi.fn(async () => undefined),
        valueOf: () => interactionId,
        ...cleanOverrides
    } as unknown as CommandInteraction;
}

/**
 * Creates a mock Discord ButtonInteraction
 */
export function createMockButtonInteraction(overrides: Record<string, any> = {}): ButtonInteraction {
    // Create a mock interaction without type to avoid conflicts
    const mockInteraction = createMockCommandInteraction({
        ...overrides,
        type: undefined
    });

    // Create a new object without inheritance to avoid type conflicts
    const buttonProps = {
        ...JSON.parse(JSON.stringify(mockInteraction)),
        type: InteractionType.MessageComponent,
        customId: 'test-button-id',
        componentType: 2, // BUTTON
        update: vi.fn(async () => undefined),
        ...overrides
    };

    return buttonProps as unknown as ButtonInteraction;
}

/**
 * Creates a mock Discord ModalSubmitInteraction
 */
export function createMockModalSubmitInteraction(overrides: Record<string, any> = {}): ModalSubmitInteraction {
    // Create a mock interaction without type to avoid conflicts
    const mockInteraction = createMockCommandInteraction({
        ...overrides,
        type: undefined
    });

    // Create a new object without inheritance to avoid type conflicts
    const modalProps = {
        ...JSON.parse(JSON.stringify(mockInteraction)),
        type: InteractionType.ModalSubmit,
        customId: 'test-modal-id',
        fields: {
            getTextInputValue: vi.fn((id: string) => `test-value-for-${id}`),
        },
        ...overrides
    };

    return modalProps as unknown as ModalSubmitInteraction;
}

/**
 * Creates a mock message send function
 */
export function createMockSend(): ReturnType<typeof vi.fn> {
    return vi.fn(async (_options?: string | MessagePayload | MessageCreateOptions) => createMockMessage());
}

/**
 * Setup mocks for discord.js
 */
export function setupDiscordMocks(): void {
    vi.mock('discord.js', async (importOriginal: () => Promise<typeof import('discord.js')>) => {
        const actual = await importOriginal();
        return {
            ...actual,
        };
    });
}

/**
 * Helper to setup and teardown Discord mocks for a test suite
 */
export function withDiscordMocks(): void {
    beforeEach(() => {
        setupDiscordMocks();
    });
}
