import { describe, it, expect, vi, beforeEach } from 'vitest';
import { startBotServices } from '../botScheduler.js';
import { Client } from 'discord.js';
import * as twitchService from '../twitchService.js';
import * as youtubeService from '../youtubeService.js';
import * as reminderService from '../reminderService.js';
import * as birthdayService from '../birthdayService.js';
import * as patchNotesService from '../patchNotesService.js';
import * as scheduleAtTime from '../../utils/scheduleAtTime.js';

vi.mock('../twitchService.js');
vi.mock('../youtubeService.js');
vi.mock('../reminderService.js');
vi.mock('../birthdayService.js');
vi.mock('../patchNotesService.js');
vi.mock('../../utils/scheduleAtTime.js');
vi.mock('@zeffuro/fakegaming-common/managers', () => ({
    getConfigManager: () => ({ patchNotesManager: {} }),
}));

describe('botScheduler', () => {
    let mockClient: Client;

    beforeEach(() => {
        vi.clearAllMocks();
        mockClient = {} as Client;

        vi.mocked(twitchService.subscribeAllStreams).mockResolvedValue(undefined);
        vi.mocked(youtubeService.checkAndAnnounceNewVideos).mockResolvedValue(undefined);
        vi.mocked(reminderService.checkAndSendReminders).mockResolvedValue(undefined);
        vi.mocked(birthdayService.checkAndAnnounceBirthdays).mockResolvedValue(undefined);
        vi.mocked(patchNotesService.scanAndUpdatePatchNotes).mockResolvedValue(undefined);
        vi.mocked(patchNotesService.announceNewPatchNotes).mockResolvedValue(undefined);
        vi.mocked(scheduleAtTime.scheduleAtTime).mockImplementation(() => {});

        vi.spyOn(global, 'setInterval').mockImplementation((() => {}) as any);
    });

    it('should start all services on initialization', () => {
        startBotServices(mockClient);

        expect(twitchService.subscribeAllStreams).toHaveBeenCalledWith(mockClient);
        expect(youtubeService.checkAndAnnounceNewVideos).toHaveBeenCalledWith(mockClient);
        expect(reminderService.checkAndSendReminders).toHaveBeenCalledWith(mockClient);
        expect(birthdayService.checkAndAnnounceBirthdays).toHaveBeenCalledWith(mockClient);
        expect(patchNotesService.scanAndUpdatePatchNotes).toHaveBeenCalledWith(expect.any(Object));
        expect(patchNotesService.announceNewPatchNotes).toHaveBeenCalledWith(mockClient);
    });

    it('should set up recurring intervals for services', () => {
        startBotServices(mockClient);

        expect(setInterval).toHaveBeenCalledTimes(5);
        expect(setInterval).toHaveBeenCalledWith(expect.any(Function), 60000); // 1 minute
        expect(setInterval).toHaveBeenCalledWith(expect.any(Function), 300000); // 5 minutes
        expect(setInterval).toHaveBeenCalledWith(expect.any(Function), 3600000); // 60 minutes
        expect(setInterval).toHaveBeenCalledWith(expect.any(Function), 600000); // 10 minutes
    });

    it('should schedule birthday announcements at 9:00 AM', () => {
        startBotServices(mockClient);

        expect(scheduleAtTime.scheduleAtTime).toHaveBeenCalledWith(9, 0, expect.any(Function));
    });

    it('should handle service errors gracefully', async () => {
        vi.mocked(twitchService.subscribeAllStreams).mockRejectedValue(new Error('Service error'));

        startBotServices(mockClient);

        // Wait for promise rejection to be handled
        await new Promise(resolve => setTimeout(resolve, 0));

        const sharedLogger = (globalThis as Record<string, unknown>).__TEST_LOGGER__ as { error: (...args: unknown[]) => void };
        expect(sharedLogger.error).toHaveBeenCalledWith(
            expect.objectContaining({ service: 'subscribeAllStreams', err: expect.any(Error) }),
            expect.stringContaining('Error in subscribeAllStreams')
        );
    });
});
