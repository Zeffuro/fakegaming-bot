import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Collection, PermissionFlagsBits as P, type Attachment, type Client } from 'discord.js';
import { createCanvas } from 'canvas';
import { closeSequelize, getSequelize } from '@zeffuro/fakegaming-common';
import { SubmissionCategory, SubmissionLock, SubmissionPanel, SubmissionRecord } from '@zeffuro/fakegaming-common/models';
import { SubmissionManager } from '@zeffuro/fakegaming-common/managers';
import { createMockConfigManager } from '@zeffuro/fakegaming-common/testing';
import { SubmissionRuntime } from '../shared/runtime.js';
import { botId, destinationId, guildId, reviewerId, reviewId, userId } from './fixtures.js';

beforeAll(async () => {
    vi.stubEnv('DATABASE_PROVIDER', 'sqlite');
    vi.stubEnv('DATABASE_URL', '');
    vi.stubEnv('TEST_SQLITE_FILE', '');
    getSequelize(true);
    for (const model of [SubmissionCategory, SubmissionRecord, SubmissionLock, SubmissionPanel]) await model.sync({ force: true });
});
afterAll(async () => { await closeSequelize(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe('submission workflow with real SQLite persistence and Discord payloads', () => {
    it('uploads all screenshots privately, requests a correction, then publishes the replacement exactly once', async () => {
        let now = 1_800_000_000_000;
        let sequence = 700;
        const media = new Map<string, Buffer>();
        const allMessages = new Map<string, ReturnType<typeof message>>();
        const writes = P.SendMessages | P.CreatePublicThreads | P.CreatePrivateThreads | P.SendMessagesInThreads;
        const needed = P.ViewChannel | P.SendMessages | P.ReadMessageHistory | P.EmbedLinks | P.AttachFiles;
        const botRole = '100000000000000009';
        const roles = new Collection([
            [guildId, { id: guildId, managed: false, permissions: { bitfield: P.ViewChannel | P.ReadMessageHistory | writes } }],
            [reviewerId, { id: reviewerId, managed: false, permissions: { bitfield: 0n } }],
            [botRole, { id: botRole, managed: true, permissions: { bitfield: needed } }],
        ]);
        const overwrite = (id: string, allow: bigint, deny = 0n) => ({ id, type: 0, allow: { bitfield: allow }, deny: { bitfield: deny } });
        function member(id: string) { return { id, permissions: { has: () => false }, roles: { cache: new Collection(
            (id === botId ? [botRole] : id === reviewerId ? [reviewerId] : []).map(role => [role, roles.get(role)]),
        ) } }; }
        function message(channelId: string, payload: { embeds: { toJSON: () => unknown }[]; files?: { attachment: Buffer; name: string }[] }) {
            const id = String(++sequence);
            const attachments = new Collection((payload.files ?? []).map(file => {
                const attachmentId = String(++sequence);
                const url = `https://cdn.discordapp.com/attachments/${channelId}/${attachmentId}/${file.name}`;
                media.set(url, Buffer.from(file.attachment));
                return [attachmentId, { id: attachmentId, name: file.name, size: file.attachment.length, contentType: 'image/png', url }];
            }));
            const value = { id, channelId, author: { id: botId }, embeds: payload.embeds.map(embed => embed.toJSON()), attachments,
                edit: vi.fn(async (next: { embeds: { toJSON: () => unknown }[]; attachments?: unknown[] }) => {
                    value.embeds = next.embeds.map(embed => embed.toJSON());
                    if (next.attachments?.length === 0) value.attachments.clear();
                    return value;
                }) };
            allMessages.set(id, value);
            return value;
        }
        function channel(id: string, review: boolean) {
            return { id, guildId, type: 0, permissionsFor: () => ({ has: () => true }), permissionOverwrites: { cache: new Collection([
                [guildId, overwrite(guildId, 0n, review ? P.ViewChannel : writes)],
                [reviewerId, overwrite(reviewerId, review ? P.ViewChannel : 0n)],
                [botRole, overwrite(botRole, needed)],
            ]) }, send: vi.fn(async payload => message(id, payload)),
            messages: { fetch: vi.fn(async (request: { message?: string; limit?: number } | string) => {
                const requestedId = typeof request === 'string' ? request : request.message;
                return requestedId ? allMessages.get(requestedId) : new Collection([...allMessages].filter(([, value]) => value.channelId === id));
            }) } };
        }
        const review = channel(reviewId, true);
        const destination = channel(destinationId, false);
        const channels = new Map([[reviewId, review], [destinationId, destination]]);
        const guild = { id: guildId, name: 'Test server', roles: { fetch: async () => roles }, channels: { fetch: async (id: string) => channels.get(id) },
            members: { fetchMe: async () => member(botId), fetch: async ({ user }: { user: string }) => member(user) } };
        const client = { user: { id: botId }, guilds: { fetch: async () => guild }, channels: guild.channels,
            users: { fetch: async () => ({ send: vi.fn() }) } } as unknown as Client;
        vi.stubGlobal('fetch', vi.fn(async (url: string) => new Response(Uint8Array.from(media.get(url)!).buffer)));
        const manager = new SubmissionManager({ now: () => now });
        createMockConfigManager({ submissionManager: { getCategory: vi.fn(manager.getCategory.bind(manager)) } });
        const category = await manager.saveCategory(guildId, { name: 'Marktplaats', destinationChannelId: destinationId,
            reviewChannelId: reviewId, reviewerRoleIds: [reviewerId], submitterRoleIds: [], enabled: true });
        const runtime = new SubmissionRuntime(client, manager);
        const input = (colour: string, count: number): Attachment[] => Array.from({ length: count }, () => {
            const canvas = createCanvas(2, 2);
            const ctx = canvas.getContext('2d'); ctx.fillStyle = colour; ctx.fillRect(0, 0, 2, 2);
            const bytes = canvas.toBuffer('image/png');
            const id = String(++sequence);
            const url = `https://cdn.discordapp.com/ephemeral-attachments/${reviewId}/${id}/input.png`;
            media.set(url, bytes);
            return { id, url, size: bytes.length, contentType: 'image/png' } as Attachment;
        });
        const first = await runtime.submit(category, userId, { explanation: 'Original screenshots', link: null, credit: null, attachmentCount: 4 }, input('red', 4));
        expect(first).toMatchObject({ status: 'pending' });
        expect(first.attachments).toHaveLength(4);
        expect(review.send).toHaveBeenCalledTimes(1);
        expect(destination.send).not.toHaveBeenCalled();
        const changes = await manager.review(guildId, first.id, first.version, reviewerId, 'changes', 'Censor the name');
        now += 60_000;
        const revised = await runtime.submit(category, userId, { explanation: 'Corrected screenshots', link: null, credit: null, attachmentCount: 2 }, input('blue', 2), changes);
        expect(revised.attachments).toHaveLength(2);
        expect(allMessages.get(first.reviewMessageId!)!.attachments.size).toBe(0);
        await expect(runtime.publish(first, reviewerId)).rejects.toThrow();
        expect(destination.send).not.toHaveBeenCalled();
        const results = await Promise.allSettled([runtime.publish(revised, reviewerId), runtime.publish(revised, reviewerId)]);
        if (results.every(value => value.status === 'rejected')) throw new AggregateError(results.flatMap(value => value.status === 'rejected' ? [value.reason] : []), 'Neither approval completed');
        expect(results.filter(value => value.status === 'fulfilled')).toHaveLength(1);
        expect(destination.send).toHaveBeenCalledTimes(1);
        const published = (await new SubmissionManager().get(guildId, first.id))!;
        expect(published).toMatchObject({ status: 'published', reviewerId, attachmentCount: 2, explanation: 'Corrected screenshots' });
        const publicPost = allMessages.get(published.publishedMessageId!)!;
        expect(publicPost.attachments.size).toBe(2);
        expect(JSON.stringify(publicPost.embeds)).not.toContain(userId);
        expect(JSON.stringify(publicPost.embeds)).not.toContain('Censor the name');
        expect((await manager.listOwn(guildId, userId))[0]!.publishedMessageId).toBe(publicPost.id);
        expect(await manager.listOwn(guildId, 'another-user')).toEqual([]);
    });
});
