import { describe, it, expect, beforeEach, vi, type MockedFunction } from 'vitest';
import { ChannelType, TextChannel } from 'discord.js';
import { setupServiceTest, createMockTextChannel, expectSendHasEmbed } from '@zeffuro/fakegaming-common/testing';
import { buildPatchNoteEmbed } from '../../modules/patchnotes/shared/patchNoteEmbed.js';
import { getConfigManager } from '@zeffuro/fakegaming-common/managers';

vi.mock('../../modules/patchnotes/shared/patchNoteEmbed.js', () => ({
    buildPatchNoteEmbed: vi.fn(() => ({ title: 'Test Embed' })),
}));

const { mockFetchLatestPatchNote, mockLoadPatchNoteFetchers } = vi.hoisted(() => {
    type Patch = { id: string; title: string; version: string; publishedAt: Date };
    type FetchLatestPatch = () => Promise<Patch | null>;
    const mockFetchLatestPatchNote: MockedFunction<FetchLatestPatch> = vi.fn(async () => ({
        id: 'patch1',
        title: 'Version 1.0',
        version: '1.0',
        publishedAt: new Date(),
    }));

    const mockLoadPatchNoteFetchers = vi.fn(async () => [{
        game: 'fakegame',
        fetchLatestPatchNote: mockFetchLatestPatchNote,
    }]);

    return { mockFetchLatestPatchNote, mockLoadPatchNoteFetchers };
});

vi.mock('../../loaders/loadPatchNoteFetchers.js', () => ({
    loadPatchNoteFetchers: mockLoadPatchNoteFetchers,
}));

import { announceNewPatchNotes, scanAndUpdatePatchNotes } from '../patchNotesService.js';

describe('patchNotesService', () => {
    let client: Awaited<ReturnType<typeof setupServiceTest>>['client'];
    let configManager: ReturnType<typeof getConfigManager>;
    let mockChannel: TextChannel;

    beforeEach(async () => {
        const setup = await setupServiceTest();
        client = setup.client;
        configManager = setup.configManager;

        mockChannel = createMockTextChannel({
            id: 'test-channel-id',
            type: ChannelType.GuildText,
            send: vi.fn(async () => ({ id: 'msg-1' } as any)),
            toString: () => '<#test-channel-id>',
        } as unknown as TextChannel);

        client.channels.cache.set(mockChannel.id, mockChannel);

        // Reset only the mocks we control, not the core manager mock
        vi.mocked(buildPatchNoteEmbed).mockClear();
        mockFetchLatestPatchNote.mockClear();
        mockLoadPatchNoteFetchers.mockClear();
    });

    // ---- announceNewPatchNotes tests ----
    it('should announce new patch notes to subscribed channels', async () => {
        const testNote = {
            id: '1',
            game: 'fakegame',
            title: 'Version 1.0',
            version: '1.0',
            publishedAt: new Date('2025-10-06'),
            get: vi.fn((_options?: { raw: boolean }) => ({
                id: '1',
                game: 'fakegame',
                title: 'Version 1.0',
                version: '1.0',
                publishedAt: new Date('2025-10-06'),
            })),
        };

        const mockSubscription = {
            game: 'fakegame',
            channelId: mockChannel.id,
            lastAnnouncedAt: null,
        };

        vi.spyOn(configManager.patchNotesManager, 'getAll').mockResolvedValue([testNote] as any);
        vi.spyOn(configManager.patchSubscriptionManager, 'getSubscriptionsForGame').mockResolvedValue([mockSubscription] as any);
        vi.spyOn(configManager.patchSubscriptionManager, 'upsert').mockResolvedValue(undefined as any);

        await announceNewPatchNotes(client);

        expect(buildPatchNoteEmbed).toHaveBeenCalledWith(expect.objectContaining({ id: '1' }));
        expectSendHasEmbed(mockChannel);
        expect(configManager.patchSubscriptionManager.upsert).toHaveBeenCalledWith(
            expect.objectContaining({ lastAnnouncedAt: testNote.publishedAt }),
        );
    });

    it('should skip already announced patch notes', async () => {
        const publishedAt = new Date('2025-10-06');

        const testNote = {
            id: '1',
            game: 'fakegame',
            title: 'Version 1.0',
            version: '1.0',
            publishedAt,
            get: vi.fn((_options?: { raw: boolean }) => ({
                id: '1',
                game: 'fakegame',
                title: 'Version 1.0',
                version: '1.0',
                publishedAt,
            })),
        };

        const mockSubscription = {
            game: 'fakegame',
            channelId: mockChannel.id,
            lastAnnouncedAt: new Date('2025-10-07'), // already newer
        };

        vi.spyOn(configManager.patchNotesManager, 'getAll').mockResolvedValue([testNote] as any);
        vi.spyOn(configManager.patchSubscriptionManager, 'getSubscriptionsForGame').mockResolvedValue([mockSubscription] as any);

        await announceNewPatchNotes(client);

        expect(mockChannel.send).not.toHaveBeenCalled();
    });

    // ---- scanAndUpdatePatchNotes tests ----
    it('should fetch and update patch notes when new ones are available', async () => {
        vi.spyOn(configManager.patchNotesManager, 'getLatestPatch').mockResolvedValue(null);
        vi.spyOn(configManager.patchNotesManager, 'setLatestPatch').mockResolvedValue(undefined as any);

        await scanAndUpdatePatchNotes(configManager.patchNotesManager);

        // Verify the loader was called
        expect(mockLoadPatchNoteFetchers).toHaveBeenCalled();
        expect(mockFetchLatestPatchNote).toHaveBeenCalled();
        expect(configManager.patchNotesManager.setLatestPatch).toHaveBeenCalledWith(
            expect.objectContaining({
                game: 'fakegame',
                title: 'Version 1.0',
            }),
        );
    });

    it('should not update if no new patch notes are found', async () => {
        vi.spyOn(configManager.patchNotesManager, 'getLatestPatch').mockResolvedValue({
            game: 'fakegame',
            title: 'Version 0.9',
            publishedAt: new Date('2025-10-05'),
        } as any);

        mockFetchLatestPatchNote.mockResolvedValue(null);

        await scanAndUpdatePatchNotes(configManager.patchNotesManager);

        expect(configManager.patchNotesManager.setLatestPatch).not.toHaveBeenCalled();
    });
});
