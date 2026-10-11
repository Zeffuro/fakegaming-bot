import { randomUUID } from 'node:crypto';
import type { Model, ModelStatic } from 'sequelize';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PersonalNotificationPause, ReminderDelivery, UserConfig, UserFollowEvent, UserFollow, UserFollowSettings,
    ScheduleOccurrence, ScheduleNotification, PersonalSchedule, SchedulePreferences, AnimeSubscriptionConfig,
    UserDigestSubscriptionConfig, MorningBriefingSettings, MorningBriefingDelivery } from '@zeffuro/fakegaming-common/models';
import { PersonalNotificationPauseManager, ScheduleNotificationManager, MorningBriefingManager, UserScheduleManager } from '@zeffuro/fakegaming-common/managers';
import { TestJobQueue, runJobHandler } from '@zeffuro/fakegaming-common/testing';
import { configManager } from '../../vitest.setup.js';

const mocks = vi.hoisted(() => ({ send: vi.fn(), channel: vi.fn(), schedule: vi.fn(), twitch: vi.fn(), airing: vi.fn(), agenda: vi.fn() }));
vi.mock('../../utils/discord.js', () => ({ sendDirectMessagePayloadResult: mocks.send, sendChannelMessagePayload: mocks.channel }));
vi.mock('../scheduleDiscord.js', () => ({ sendScheduleMessage: mocks.schedule, editScheduleMessage: vi.fn() }));
vi.mock('@zeffuro/fakegaming-common/notifications', () => ({ fetchPersonalTwitchStreams: mocks.twitch }));
vi.mock('@zeffuro/fakegaming-common/anime', async importOriginal => ({ ...await importOriginal<object>(), getAniListNextAiring: mocks.airing }));
vi.mock('../../personalToday/morningBriefing.js', () => ({ loadMorningAgenda: mocks.agenda, formatMorningBriefing: () => ({ empty: false, day: '2026-10-10', content: 'Briefing' }) }));
vi.mock('../status.js', () => ({ recordJobRun: vi.fn() }));
import { registerRemindersJobs } from '../reminders.js';
import { processPersonalFollows } from '../personalFollows.js';
import { processPersonalSchedules } from '../personalSchedules.js';
import { registerUserDigestJobs } from '../userDigests.js';
import { registerAnimeJobs } from '../anime.js';
import { processMorningBriefings } from '../morningBriefings.js';

const owner = 'pause-job-owner'; const now = Date.parse('2026-10-10T09:00Z'); const pause = new PersonalNotificationPauseManager();
async function configure(enabled: boolean) {
    const current = await pause.preferences(owner); return pause.configure(owner, { enabled, resumeAt: null, timezone: current.timezone, version: current.version });
}
async function run(register: (queue: TestJobQueue) => Promise<void>, name: string) {
    const queue = new TestJobQueue(); await register(queue); await runJobHandler(queue, name, {});
}
beforeEach(async () => {
    vi.restoreAllMocks(); vi.clearAllMocks(); vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(now);
    for (const model of [PersonalNotificationPause, ReminderDelivery, UserFollowEvent, UserFollow, UserFollowSettings, ScheduleNotification,
        ScheduleOccurrence, PersonalSchedule, SchedulePreferences, AnimeSubscriptionConfig, UserDigestSubscriptionConfig, MorningBriefingDelivery, MorningBriefingSettings]) await (model as ModelStatic<Model>).destroy({ where: {} });
    await configManager.reminderManager.removeAll();
    await UserConfig.findOrCreate({ where: { discordId: owner }, defaults: { discordId: owner } });
    await UserConfig.update({ timezone: 'UTC' }, { where: { discordId: owner } });
    mocks.send.mockResolvedValue({ status: 'sent', message: { id: '123', channel_id: '456' } }); mocks.channel.mockResolvedValue({ id: 'public' });
    mocks.schedule.mockResolvedValue({ status: 'sent', messageId: '123', channelId: '456' }); mocks.agenda.mockResolvedValue({});
    mocks.twitch.mockResolvedValue([{ id: 'live', user_login: 'example', user_name: 'Example', title: 'Stream', started_at: new Date(now).toISOString() }]);
    mocks.airing.mockResolvedValue([{ mediaId: 123, episode: 2, airingAt: (now + 10 * 60_000) / 1000 }]);
});
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });
describe('all automatic personal DM gates', () => {
    it.each(['early', 'claim'])('preserves due reminders when pause wins at %s and sends them after resume', async stage => {
        const reminder = await configManager.reminderManager.createForUser({ id: randomUUID(), userId: owner, message: 'Due reminder', timespan: '1h', timestamp: now - 1000 });
        const manager = configManager.reminderInteractionManager;
        if (stage === 'early') await configure(true);
        else {
            const original = manager.claimDelivery.bind(manager);
            vi.spyOn(manager, 'claimDelivery').mockImplementationOnce(async (...args) => { const result = await original(...args); await configure(true); return result; });
        }
        await run(registerRemindersJobs, 'reminders:run'); expect(mocks.send).not.toHaveBeenCalled();
        expect(Number((await configManager.reminderManager.getForUser(reminder.id, owner))!.timestamp)).toBe(now - 1000);
        expect(await ReminderDelivery.count({ where: { status: 'sending' } })).toBe(0);
        await configure(false); await run(registerRemindersJobs, 'reminders:run'); expect(mocks.send).toHaveBeenCalledOnce();
        expect(await configManager.reminderManager.getForUser(reminder.id, owner)).toBeNull();
    });
    it.each(['early', 'claim'])('keeps private follow events pending when pause wins at %s and drains after resume', async stage => {
        const manager = configManager.userFollowManager; await manager.add(owner, 'twitch', 'example', 'Example', 'digest');
        if (stage === 'early') await configure(true);
        else {
            const original = manager.claim.bind(manager);
            vi.spyOn(manager, 'claim').mockImplementationOnce(async (...args) => { const result = await original(...args); await configure(true); return result; });
        }
        expect((await processPersonalFollows(now)).errors).toBe(0); expect(mocks.send).not.toHaveBeenCalled();
        expect(await UserFollowEvent.count({ where: { status: 'pending' } })).toBe(1);
        expect((await manager.preferences(owner)).lastDigestDate).toBeNull();
        await configure(false); expect((await processPersonalFollows(now)).sent).toBe(1);
        expect((await manager.list(owner))[0]).toMatchObject({ paused: false, mode: 'digest' });
    });
    it.each(['early', 'prepare'])('skips paused digest runs at %s without lastSent changes or catch-up replay', async stage => {
        const manager = configManager.userDigestSubscriptionManager;
        await manager.upsertForUser({ discordId: owner, frequency: 'daily', timezone: 'UTC', runAt: '09:00', categories: ['reminders'], nextRunAt: now });
        await configManager.reminderManager.createForUser({ id: randomUUID(), userId: owner, message: 'Soon', timespan: '1h', timestamp: now + 60_000 });
        if (stage === 'early') await configure(true);
        else {
            const original = configManager.reminderManager.getRemindersByUser.bind(configManager.reminderManager);
            vi.spyOn(configManager.reminderManager, 'getRemindersByUser').mockImplementationOnce(async (...args) => { const result = await original(...args); await configure(true); return result; });
        }
        await run(registerUserDigestJobs, 'user-digests:run'); expect(mocks.send).not.toHaveBeenCalled();
        const stored = (await manager.getForUser(owner))!;
        expect(stored).toMatchObject({ lastRunAt: now, lastSentAt: null, nextRunAt: now + 86_400_000 }); expect(Boolean(stored.paused)).toBe(false);
        await configure(false); await run(registerUserDigestJobs, 'user-digests:run'); expect(mocks.send).not.toHaveBeenCalled();
    });
    it('pauses anime DMs without changing episode pointers or public posts, then sends the current episode after resume', async () => {
        const dm = await AnimeSubscriptionConfig.create({ anilistId: 123, targetType: 'dm', userId: owner, reminderMinutes: 30, paused: false });
        await AnimeSubscriptionConfig.create({ anilistId: 123, targetType: 'channel', guildId: 'guild', channelId: 'channel', reminderMinutes: 30, paused: false });
        const original = configManager.userManager.getPreferredLocale.bind(configManager.userManager);
        vi.spyOn(configManager.userManager, 'getPreferredLocale').mockImplementationOnce(async (...args) => { await configure(true); return original(...args); });
        await run(registerAnimeJobs, 'anime:notifications'); expect(mocks.send).not.toHaveBeenCalled(); expect(mocks.channel).toHaveBeenCalledOnce();
        expect(await dm.reload()).toMatchObject({ paused: false, lastNotifiedEpisode: null });
        await configure(false); await run(registerAnimeJobs, 'anime:notifications'); expect(mocks.send).toHaveBeenCalledOnce();
        expect(await dm.reload()).toMatchObject({ paused: false, lastNotifiedEpisode: 2 }); expect(mocks.channel).toHaveBeenCalledOnce();
    });
    it.each(['early', 'claim'])('preserves pending schedule occurrences when pause wins at %s and resumes without consuming follow-ups', async stage => {
        const item = await new UserScheduleManager(() => Date.now()).createManual({ userId: owner, title: 'Event', plannedAt: now + 60_000, timezone: 'UTC' });
        await ScheduleOccurrence.update({ nextNotifyAt: now - 1000 }, { where: { id: item.id } });
        if (stage === 'early') await configure(true);
        else {
            const original = ScheduleNotificationManager.prototype.claim;
            vi.spyOn(ScheduleNotificationManager.prototype, 'claim').mockImplementationOnce(async function (this: ScheduleNotificationManager, ...args) { const result = await original.apply(this, args); await configure(true); return result; });
        }
        expect(await processPersonalSchedules(now)).toEqual({ sent: 0, edited: 0, errors: 0 }); expect(mocks.schedule).not.toHaveBeenCalled();
        expect(await ScheduleOccurrence.findByPk(item.id)).toMatchObject({ state: 'pending', notificationCount: 0 });
        await configure(false); vi.setSystemTime(now + 5 * 60_000 + 1000);
        expect((await processPersonalSchedules(Date.now())).sent).toBe(1); expect(mocks.schedule).toHaveBeenCalledOnce();
    });
    it.each(['early', 'prepare'])('waits on the current-day briefing when pause wins at %s without retry-budget consumption', async stage => {
        const manager = new MorningBriefingManager(); await manager.configure(owner, { enabled: true, localTime: '09:00', timezone: 'UTC', version: 0 });
        if (stage === 'early') await configure(true);
        else mocks.agenda.mockImplementationOnce(async () => { await configure(true); return {}; });
        expect((await processMorningBriefings(now)).errors).toBe(0); expect(mocks.send).not.toHaveBeenCalled();
        expect(await MorningBriefingSettings.findByPk(owner)).toMatchObject({ enabled: true });
        if (stage === 'prepare') expect(await MorningBriefingDelivery.findOne()).toMatchObject({ status: 'rejected', attempts: 0 });
        await configure(false); vi.setSystemTime(now + 61_000); expect((await processMorningBriefings(Date.now())).sent).toBe(1);
        expect(mocks.send).toHaveBeenCalledOnce();
    });
    it.each(['unknown', 'rejected'])('retires unknown digest outcomes but retries definitive %s delivery appropriately', async status => {
        const manager = configManager.userDigestSubscriptionManager;
        await manager.upsertForUser({ discordId: owner, frequency: 'daily', timezone: 'UTC', runAt: '09:00', categories: ['reminders'], nextRunAt: now });
        await configManager.reminderManager.createForUser({ id: randomUUID(), userId: owner, message: 'Soon', timespan: '1h', timestamp: now + 60 * 60_000 });
        mocks.send.mockResolvedValueOnce({ status }); await run(registerUserDigestJobs, 'user-digests:run');
        const record = (await manager.getForUser(owner))!;
        expect(record.lastSentAt).toBeNull(); expect(Number(record.nextRunAt)).toBe(now + (status === 'unknown' ? 86_400_000 : 15 * 60_000));
        vi.setSystemTime(now + 16 * 60_000); await run(registerUserDigestJobs, 'user-digests:run');
        expect(mocks.send).toHaveBeenCalledTimes(status === 'unknown' ? 1 : 2);
    });
    it.each(['unknown', 'rejected'])('retires unknown anime episodes but retries definitive %s delivery and permits future episodes', async status => {
        const subscription = await AnimeSubscriptionConfig.create({ anilistId: 123, targetType: 'dm', userId: owner, reminderMinutes: 30, paused: false });
        mocks.send.mockResolvedValueOnce({ status }); await run(registerAnimeJobs, 'anime:notifications');
        expect((await subscription.reload()).lastNotifiedEpisode).toBe(status === 'unknown' ? 2 : null);
        await run(registerAnimeJobs, 'anime:notifications'); expect(mocks.send).toHaveBeenCalledTimes(status === 'unknown' ? 1 : 2);
        mocks.airing.mockResolvedValue([{ mediaId: 123, episode: 3, airingAt: (now + 15 * 60_000) / 1000 }]);
        await run(registerAnimeJobs, 'anime:notifications'); expect((await subscription.reload()).lastNotifiedEpisode).toBe(3);
        expect(mocks.send).toHaveBeenCalledTimes(status === 'unknown' ? 2 : 3);
    });
});
