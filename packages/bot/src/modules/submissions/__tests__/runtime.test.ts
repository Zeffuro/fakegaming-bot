import { Collection, DiscordAPIError } from 'discord.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SubmissionRuntime } from '../shared/runtime.js';
import { downloadSubmissionImages, validateImageInputs } from '../shared/media.js';
import { canSubmit, fetchSubmissionChannels, liveMember, requireReviewer } from '../shared/access.js';
import { mockClient, mockManager, record, category, botId, guildId, itemId, reviewerId, userId, destinationId, reviewId } from './fixtures.js';
import { renderPublication, submissionMarker } from '../shared/presentation.js';

vi.mock('../shared/access.js', () => ({ canSubmit: vi.fn(), fetchSubmissionChannels: vi.fn(), liveMember: vi.fn(), requireReviewer: vi.fn() }));
vi.mock('../shared/media.js', () => ({ downloadSubmissionImages: vi.fn(), validateImageInputs: vi.fn() }));

const edit = vi.fn(async () => undefined);
const fetchMessage = vi.fn();
const send = vi.fn();
const access = { category: category(), guild: { name: 'Server' }, review: { messages: { fetch: fetchMessage }, send }, destination: { send, messages: { fetch: fetchMessage } } };

beforeEach(() => {
    vi.mocked(fetchSubmissionChannels).mockResolvedValue(access as never);
    vi.mocked(requireReviewer).mockResolvedValue(access as never);
    vi.mocked(canSubmit).mockReturnValue(true);
    vi.mocked(liveMember).mockResolvedValue({} as never);
    vi.mocked(downloadSubmissionImages).mockResolvedValue([]);
    fetchMessage.mockResolvedValue({ author: { id: botId }, embeds: [{ footer: { text: submissionMarker(record()) } }], edit });
});
afterEach(() => vi.useRealTimers());

function publicationManager(overrides = {}) {
    const item = record();
    return mockManager({
        claimPublish: vi.fn(async () => record({ status: 'publishing', version: 2 })),
        finishPublish: vi.fn(async () => record({ status: 'published', version: 3, publishedChannelId: destinationId, publishedMessageId: 'published-message' })),
        failPublish: vi.fn(async (_g, _id, _version, uncertain) => record({ status: uncertain ? 'uncertain' : 'publish_failed', version: 3 })),
        get: vi.fn(async () => item), ...overrides,
    });
}

describe('submission delivery runtime', () => {
    it('claims approval before the public send and commits its receipt', async () => {
        const manager = publicationManager();
        send.mockResolvedValue({ id: 'published-message', channelId: destinationId });
        const runtime = new SubmissionRuntime(mockClient(), manager);
        vi.spyOn(runtime, 'notify').mockResolvedValue(undefined);
        const updated = await runtime.publish(record(), reviewerId);
        expect(updated).toMatchObject({ status: 'published' });
        expect(manager.claimPublish).toHaveBeenCalledWith(guildId, itemId, 1, reviewerId, 0);
        expect(manager.finishPublish).toHaveBeenCalledWith(guildId, itemId, 2, destinationId, 'published-message');
        expect(vi.mocked(manager.claimPublish).mock.invocationCallOrder[0]).toBeLessThan(send.mock.invocationCallOrder[0]!);
        expect(send).toHaveBeenCalledWith(expect.objectContaining({ enforceNonce: true, nonce: expect.stringMatching(/^[0-9a-f]{24}$/), allowedMentions: { parse: [] } }));
        expect(runtime.notify).toHaveBeenCalledTimes(1);
    });

    it('does not send if another moderator already won the approval claim', async () => {
        const manager = publicationManager({ claimPublish: vi.fn(async () => { throw Object.assign(new Error(), { code: 'stale' }); }) });
        await expect(new SubmissionRuntime(mockClient(), manager).publish(record(), reviewerId)).rejects.toMatchObject({ code: 'stale' });
        expect(send).not.toHaveBeenCalled();
    });

    it('does not claim or send if reviewer access is revoked during file preparation', async () => {
        vi.mocked(requireReviewer).mockResolvedValueOnce(access as never).mockRejectedValueOnce(new Error('Revoked'));
        const manager = publicationManager();
        await expect(new SubmissionRuntime(mockClient(), manager).publish(record(), reviewerId)).rejects.toThrow('Revoked');
        expect(manager.claimPublish).not.toHaveBeenCalled();
        expect(send).not.toHaveBeenCalled();
    });

    it('records ambiguous network delivery without sending twice or notifying success', async () => {
        const manager = publicationManager();
        send.mockRejectedValue(new Error('Connection reset'));
        const runtime = new SubmissionRuntime(mockClient(), manager);
        vi.spyOn(runtime, 'notify').mockResolvedValue(undefined);
        expect(await runtime.publish(record(), reviewerId)).toMatchObject({ status: 'uncertain' });
        expect(manager.failPublish).toHaveBeenCalledWith(guildId, itemId, 2, true);
        expect(send).toHaveBeenCalledTimes(1);
        expect(runtime.notify).not.toHaveBeenCalled();
    });

    it('keeps a definite Discord rejection retryable', async () => {
        const manager = publicationManager();
        send.mockRejectedValue(new DiscordAPIError({ message: 'Missing Permissions', code: 50013 }, 50013, 403, 'POST', 'https://discord.com/api/v10/channels/1/messages', {}));
        expect(await new SubmissionRuntime(mockClient(), manager).publish(record(), reviewerId)).toMatchObject({ status: 'publish_failed' });
        expect(manager.failPublish).toHaveBeenCalledWith(guildId, itemId, 2, false);
    });

    it('does not replay a known post if receipt persistence fails', async () => {
        const manager = publicationManager({ finishPublish: vi.fn(async () => { throw new Error('Database interrupted'); }) });
        send.mockResolvedValue({ id: 'published-message', channelId: destinationId });
        expect(await new SubmissionRuntime(mockClient(), manager).publish(record(), reviewerId)).toMatchObject({ status: 'uncertain' });
        expect(send).toHaveBeenCalledTimes(1);
    });

    it('refetches stored screenshots by exact private message and attachment ID', async () => {
        const stored = { id: '123', name: 'screenshot-1.png', contentType: 'image/png', size: 100 };
        const item = record({ attachments: [stored], attachmentCount: 1 });
        const current = { ...stored, url: 'https://cdn.discordapp.com/attachments/456/123/screenshot-1.png' };
        fetchMessage.mockResolvedValue({ author: { id: botId }, embeds: [{ footer: { text: submissionMarker(item) } }], attachments: new Collection([['123', current]]), edit });
        const manager = publicationManager({ get: vi.fn(async () => item) });
        send.mockResolvedValue({ id: 'published-message', channelId: destinationId });
        await new SubmissionRuntime(mockClient(), manager).publish(item, reviewerId);
        expect(fetchMessage).toHaveBeenCalledWith({ message: item.reviewMessageId, force: true });
        expect(downloadSubmissionImages).toHaveBeenCalledWith([current]);
    });

    it('rejects missing, replaced or foreign review media before claiming a publication', async () => {
        const item = record({ attachments: [{ id: '123', name: 'screenshot-1.png', contentType: 'image/png', size: 100 }], attachmentCount: 1 });
        const manager = publicationManager();
        fetchMessage.mockResolvedValue({ author: { id: botId }, embeds: [{ footer: { text: submissionMarker(item) } }], attachments: new Collection(), edit });
        await expect(new SubmissionRuntime(mockClient(), manager).publish(item, reviewerId)).rejects.toMatchObject({ code: 'imagesInvalid' });
        expect(manager.claimPublish).not.toHaveBeenCalled();
    });

    it('reserves an upload before sending a review and finalizes all saved attachments', async () => {
        const uploading = record({ status: 'uploading', version: 0, reviewMessageId: null });
        const manager = mockManager({ create: vi.fn(async () => uploading), finalizeUpload: vi.fn(async () => record()), failUpload: vi.fn() });
        send.mockResolvedValue({ id: 'review-message', channelId: reviewId, attachments: new Collection() });
        const runtime = new SubmissionRuntime(mockClient(), manager);
        await runtime.submit(category(), userId, { explanation: 'Text', link: 'https://example.com', credit: null, attachmentCount: 0 }, []);
        expect(validateImageInputs).toHaveBeenCalledWith([]);
        expect(manager.finalizeUpload).toHaveBeenCalledWith(guildId, itemId, userId, 0, { reviewChannelId: reviewId, reviewMessageId: 'review-message', attachments: [] });
        expect(vi.mocked(manager.create).mock.invocationCallOrder[0]).toBeLessThan(send.mock.invocationCallOrder[0]!);
    });

    it('marks reserved media failures as editable instead of leaving an active upload', async () => {
        const manager = mockManager({ create: vi.fn(async () => record({ status: 'uploading', version: 0 })), failUpload: vi.fn(async () => record({ status: 'upload_failed' })) });
        vi.mocked(downloadSubmissionImages).mockRejectedValueOnce(new Error('Expired media'));
        await expect(new SubmissionRuntime(mockClient(), manager).submit(category(), userId,
            { explanation: 'Text', link: 'https://example.com', credit: null, attachmentCount: 0 }, [])).rejects.toMatchObject({ code: 'uploadFailed' });
        expect(manager.failUpload).toHaveBeenCalledWith(guildId, itemId, userId, 0);
        expect(send).not.toHaveBeenCalled();
    });

    it('reconciles a positively matched bot post without publishing it again', async () => {
        const uncertain = record({ status: 'uncertain', version: 3 });
        const expected = renderPublication(uncertain, 'nl').embeds[0]!.toJSON();
        fetchMessage.mockResolvedValue(new Collection([['found', { author: { id: botId }, id: 'found', channelId: destinationId,
            embeds: [expected], attachments: new Collection() }]]));
        const manager = publicationManager({ reconcilePublish: vi.fn(async () => record({ status: 'published' })) });
        const runtime = new SubmissionRuntime(mockClient(), manager);
        vi.spyOn(runtime, 'refresh').mockResolvedValue(undefined);
        vi.spyOn(runtime, 'notify').mockResolvedValue(undefined);
        await runtime.reconcile(uncertain, reviewerId);
        expect(manager.reconcilePublish).toHaveBeenCalledWith(guildId, itemId, 3, destinationId, 'found');
        expect(send).not.toHaveBeenCalled();
    });

    it('keeps uncertainty when no matching bot post is found', async () => {
        fetchMessage.mockResolvedValue(new Collection());
        const manager = publicationManager({ reconcilePublish: vi.fn() });
        expect(await new SubmissionRuntime(mockClient(), manager).reconcile(record({ status: 'uncertain' }), reviewerId)).toBeNull();
        expect(manager.reconcilePublish).not.toHaveBeenCalled();
        expect(send).not.toHaveBeenCalled();
    });

    it('recovers interrupted work before refreshing and retries failed startup recovery', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(1_800_000_000_000);
        const cutoff = Date.now();
        const manager = mockManager({ recoverInterrupted: vi.fn().mockRejectedValueOnce(new Error('DB down')).mockResolvedValue(1),
            listForRefresh: vi.fn(async () => []), pruneFinalized: vi.fn() });
        const runtime = new SubmissionRuntime(mockClient(), manager);
        await expect(runtime.start()).rejects.toThrow('DB down');
        await vi.advanceTimersByTimeAsync(60_000);
        expect(manager.recoverInterrupted).toHaveBeenCalledTimes(2);
        expect(manager.recoverInterrupted).toHaveBeenNthCalledWith(1, cutoff);
        expect(manager.recoverInterrupted).toHaveBeenNthCalledWith(2, cutoff);
        expect(manager.listForRefresh).toHaveBeenCalledTimes(1);
        expect(send).not.toHaveBeenCalled();
        runtime.stop();
    });
});
