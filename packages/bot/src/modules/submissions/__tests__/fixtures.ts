import type { SubmissionCategoryData, SubmissionManager, SubmissionRecordData } from '@zeffuro/fakegaming-common/managers';
import type { ButtonInteraction, Client } from 'discord.js';
import { Collection, MessageFlags } from 'discord.js';
import { vi } from 'vitest';

export const guildId = '100000000000000001';
export const userId = '100000000000000002';
export const botId = '100000000000000003';
export const reviewerId = '100000000000000004';
export const reviewId = '100000000000000005';
export const destinationId = '100000000000000006';
export const categoryId = '9dc9b20c-b817-4c20-b5e2-6224ec6e37d8';
export const itemId = 'e276962c-3fe8-465b-adb4-96671c1ffdbc';

export function category(overrides: Partial<SubmissionCategoryData> = {}): SubmissionCategoryData {
    return { id: categoryId, guildId, name: 'Marktplaats', destinationChannelId: destinationId, reviewChannelId: reviewId,
        reviewerRoleIds: [reviewerId], submitterRoleIds: [], enabled: true, version: 0, ...overrides };
}

export function record(overrides: Partial<SubmissionRecordData> = {}): SubmissionRecordData {
    return { id: itemId, guildId, categoryId, categoryName: 'Marktplaats', destinationChannelId: destinationId,
        userId, status: 'pending', version: 1, explanation: 'A funny screenshot', link: 'https://example.com/item', credit: null,
        attachmentCount: 0, attachments: [], reviewChannelId: reviewId, reviewMessageId: '100000000000000007',
        reviewerId: null, reason: null, publishedChannelId: null, publishedMessageId: null,
        createdAt: 1_800_000_000_000, updatedAt: 1_800_000_000_000, ...overrides };
}

export function mockManager(overrides: Partial<Record<keyof SubmissionManager, unknown>> = {}): SubmissionManager {
    return { get: vi.fn(async () => record()), getCategory: vi.fn(async () => category()),
        listCategories: vi.fn(async () => [category()]), listOwn: vi.fn(async () => [record()]),
        getPanel: vi.fn(async () => ({ guildId, channelId: 'panel-channel', messageId: 'panel-message' })),
        ...overrides } as unknown as SubmissionManager;
}

export function interaction(customId: string, overrides: Record<string, unknown> = {}) {
    const value = {
        customId, guildId, channelId: reviewId, user: { id: userId }, member: { roles: [reviewerId] },
        memberPermissions: { has: vi.fn(() => false) }, client: { user: { id: botId } }, deferred: false, replied: false,
        message: { id: '100000000000000007', author: { id: botId }, flags: { has: (flag: number) => flag === MessageFlags.Ephemeral } },
        reply: vi.fn(async () => { value.replied = true; }), editReply: vi.fn(async () => undefined),
        deferReply: vi.fn(async () => { value.deferred = true; }), showModal: vi.fn(async (_modal: { toJSON: () => { custom_id: string } }) => { value.replied = true; }),
        fields: { getTextInputValue: vi.fn((key: string) => ({ explanation: 'A funny screenshot', link: '', credit: '', reason: 'Please censor the name' })[key] ?? ''),
            getStringSelectValues: vi.fn(() => [categoryId]), getUploadedFiles: vi.fn(() => new Collection()) },
        ...overrides,
    };
    return value as typeof value & ButtonInteraction;
}

export function mockClient(): Client {
    return { user: { id: botId }, users: { fetch: vi.fn() }, guilds: { fetch: vi.fn() }, channels: { fetch: vi.fn() } } as unknown as Client;
}
