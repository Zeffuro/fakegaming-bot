import { randomUUID } from 'node:crypto';
import type { Model, ModelStatic } from 'sequelize';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PersonalNotificationPause, ReminderDelivery, UserConfig, UserFollowEvent, UserFollow, UserFollowSettings,
    ScheduleOccurrence, ScheduleNotification, PersonalSchedule, SchedulePreferences, AnimeSubscriptionConfig,
    UserDigestSubscriptionConfig, MorningBriefingSettings, MorningBriefingDelivery, PersonalNotificationHistory } from '@zeffuro/fakegaming-common/models';
import { PersonalNotificationPauseManager, ScheduleNotificationManager, MorningBriefingManager, UserScheduleManager } from '@zeffuro/fakegaming-common/managers';
import { TestJobQueue, runJobHandler } from '@zeffuro/fakegaming-common/testing';
import { configManager } from '../../vitest.setup.js';
import * as localization from '../../localization/locale.js';

const mocks = vi.hoisted(() => ({ send: vi.fn(), channel: vi.fn(), schedule: vi.fn(), twitch: vi.fn(), airing: vi.fn(), agenda: vi.fn() }));
vi.mock('../../utils/discord.js', () => ({ sendDirectMessagePayloadResult: mocks.send, sendChannelMessagePayload: mocks.channel }));
vi.mock('../scheduleDiscord.js', () => ({ sendScheduleMessage: mocks.schedule, editScheduleMessage: vi.fn() }));
vi.mock('@zeffuro/fakegaming-common/notifications', () => ({ fetchPersonalTwitchStreams: mocks.twitch }));
vi.mock('@zeffuro/fakegaming-common/anime', async importOriginal => ({ ...await importOriginal<object>(), getAniListNextAiring: mocks.airing }));
vi.mock('../../personalToday/morningBriefing.js', () => ({ loadMorningAgenda: mocks.agenda, formatMorningBriefing: () => ({ empty: false, day: new Date(Date.now()).toISOString().slice(0, 10), content: 'Briefing' }) }));
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
        ScheduleOccurrence, PersonalSchedule, SchedulePreferences, AnimeSubscriptionConfig, UserDigestSubscriptionConfig, MorningBriefingDelivery, MorningBriefingSettings, PersonalNotificationHistory]) await (model as ModelStatic<Model>).destroy({ where: {} });
    await configManager.reminderManager.removeAll();
    await UserConfig.findOrCreate({ where: { discordId: owner }, defaults: { discordId: owner } });
    await UserConfig.update({ timezone: 'UTC' }, { where: { discordId: owner } });
    mocks.send.mockResolvedValue({ status: 'sent', message: { id: '123456789012345678', channel_id: '987654321012345678' } }); mocks.channel.mockResolvedValue({ id: 'public' });
    mocks.schedule.mockResolvedValue({ status: 'sent', messageId: '123456789012345678', channelId: '987654321012345678' }); mocks.agenda.mockResolvedValue({});
    mocks.twitch.mockResolvedValue([{ id: 'live', user_login: 'example', user_name: 'Example', title: 'Stream', started_at: new Date(now).toISOString() }]);
    mocks.airing.mockResolvedValue([{ mediaId: 123, episode: 2, airingAt: (now + 10 * 60_000) / 1000 }]);
});
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });
describe('all automatic personal DM gates', () => {
    it('keeps one original history occurrence through pause, preparation failure, backoff and successful retry', async () => {
        const originalAt = now - 1000;
        const reminder = await configManager.reminderManager.createForUser({ id: randomUUID(), userId: owner, message: 'Keep original time', timespan: '1h', timestamp: originalAt });
        await configure(true); await run(registerRemindersJobs, 'reminders:run');
        const delayed = (await configManager.personalNotificationHistoryManager.list(owner)).items[0]!;
        expect(delayed).toMatchObject({ status: 'delayed', scheduledAt: originalAt });
        expect(await ReminderDelivery.count()).toBe(0);
        await configure(false);
        vi.spyOn(localization, 'resolveUserOutputLocale').mockRejectedValueOnce(new Error('preparation offline'));
        await run(registerRemindersJobs, 'reminders:run'); expect(mocks.send).not.toHaveBeenCalled();
        const source = (await configManager.reminderManager.getForUser(reminder.id, owner))!;
        const anchor = (await ReminderDelivery.findOne({ where: { reminderId: reminder.id } }))!;
        expect(Number(source.timestamp)).toBe(now + 60_000);
        expect(anchor).toMatchObject({ status: 'pending', scheduledAt: originalAt, sourceTimestamp: now + 60_000 });
        expect((await configManager.personalNotificationHistoryManager.list(owner)).items[0]).toMatchObject({ id: delayed.id, scheduledAt: originalAt, status: 'failed', reason: 'retry' });
        vi.setSystemTime(now + 61_000); await run(registerRemindersJobs, 'reminders:run');
        expect(mocks.send).toHaveBeenCalledOnce();
        expect((await configManager.personalNotificationHistoryManager.list(owner)).items).toEqual([expect.objectContaining({ id: delayed.id, scheduledAt: originalAt, status: 'sent' })]);
        expect(await anchor.reload()).toMatchObject({ status: 'delivered', finalized: true });
    });

    it.each(['day', 'settings', 'timezone', 'unchanged'])('uses the authoritative briefing claim when the %s snapshot changes before claim', async change => {
        const manager = new MorningBriefingManager();
        await manager.configure(owner, { enabled: true, localTime: '09:00', timezone: 'UTC', version: 0 });
        const original = MorningBriefingManager.prototype.historyCandidate;
        const claimedAt = now + 15 * 60_000 + (change === 'day' ? 86_400_000 : 0);
        vi.spyOn(MorningBriefingManager.prototype, 'historyCandidate').mockImplementationOnce(async function (this: MorningBriefingManager, ...args) {
            const snapshot = await original.apply(this, args);
            vi.setSystemTime(claimedAt);
            if (change === 'settings') await manager.configure(owner, { enabled: true, localTime: '09:05', timezone: 'UTC', version: 1 });
            if (change === 'timezone') await UserConfig.update({ timezone: 'Europe/London' }, { where: { discordId: owner } });
            return snapshot;
        });
        expect((await processMorningBriefings(now)).sent).toBe(1);
        const delivery = (await MorningBriefingDelivery.findOne({ where: { userId: owner } }))!;
        const journal = (await PersonalNotificationHistory.findOne({ where: { userId: owner, kind: 'briefing' } }))!;
        expect(journal).toMatchObject({ status: 'sent', occurrenceKey: delivery.localDate });
        expect(Number(journal.scheduledAt)).toBe(change === 'unchanged' ? now : claimedAt);
        expect(await PersonalNotificationHistory.count()).toBe(1);
    });
    it.each(['early', 'claim'])('preserves due reminders when pause wins at %s and sends them after resume', async stage => {
        const reminder = await configManager.reminderManager.createForUser({ id: randomUUID(), userId: owner, message: 'Due reminder', timespan: '1h', timestamp: now - 1000 });
        const manager = configManager.reminderInteractionManager;
        if (stage === 'early') await configure(true);
        else {
            const original = manager.claimDelivery.bind(manager);
            vi.spyOn(manager, 'claimDelivery').mockImplementationOnce(async (...args) => { const result = await original(...args); await configure(true); return result; });
        }
        await run(registerRemindersJobs, 'reminders:run'); expect(mocks.send).not.toHaveBeenCalled();
        const delayed = (await configManager.personalNotificationHistoryManager.list(owner)).items;
        expect(delayed).toHaveLength(1); expect(delayed[0]).toMatchObject({ kind: 'reminder', status: 'delayed', reason: 'paused', title: 'Due reminder', scheduledAt: now - 1000, messageUrl: null });
        await run(registerRemindersJobs, 'reminders:run'); expect(await PersonalNotificationHistory.count()).toBe(1);
        expect(Number((await configManager.reminderManager.getForUser(reminder.id, owner))!.timestamp)).toBe(now - 1000);
        expect(await ReminderDelivery.count({ where: { status: 'sending' } })).toBe(0);
        await configure(false); await run(registerRemindersJobs, 'reminders:run'); expect(mocks.send).toHaveBeenCalledOnce();
        expect(await configManager.reminderManager.getForUser(reminder.id, owner)).toBeNull();
        const sent = (await configManager.personalNotificationHistoryManager.list(owner)).items;
        expect(sent).toHaveLength(1); expect(sent[0]).toMatchObject({ id: delayed[0]!.id, status: 'sent', reason: null, scheduledAt: now - 1000,
            messageUrl: 'https://discord.com/channels/@me/987654321012345678/123456789012345678' });
    });
    it.each(['early', 'claim'])('keeps private follow events pending when pause wins at %s and drains after resume', async stage => {
        const manager = configManager.userFollowManager; await manager.add(owner, 'twitch', 'example', 'Example', 'digest');
        if (stage === 'early') await configure(true);
        else {
            const original = manager.claim.bind(manager);
            vi.spyOn(manager, 'claim').mockImplementationOnce(async (...args) => { const result = await original(...args); await configure(true); return result; });
        }
        expect((await processPersonalFollows(now)).errors).toBe(0); expect(mocks.send).not.toHaveBeenCalled();
        const history = (await configManager.personalNotificationHistoryManager.list(owner)).items;
        expect(history).toHaveLength(1); expect(history[0]).toMatchObject({ kind: 'follow', status: 'delayed', reason: 'paused', title: 'Example: Stream', scheduledAt: now });
        expect(await UserFollowEvent.count({ where: { status: 'pending' } })).toBe(1);
        expect((await manager.preferences(owner)).lastDigestDate).toBeNull();
        await configure(false); expect((await processPersonalFollows(now)).sent).toBe(1);
        expect((await manager.list(owner))[0]).toMatchObject({ paused: false, mode: 'digest' });
        expect((await configManager.personalNotificationHistoryManager.list(owner)).items[0]).toMatchObject({ id: history[0]!.id, status: 'sent' });
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
        expect((await configManager.personalNotificationHistoryManager.list(owner)).items).toEqual([expect.objectContaining({ kind: 'digest', status: 'skipped', reason: 'paused', title: '', scheduledAt: now, sentAt: null })]);
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
        const history = (await configManager.personalNotificationHistoryManager.list(owner)).items;
        expect(history).toHaveLength(1); expect(history[0]).toMatchObject({ kind: 'anime', status: 'delayed', reason: 'paused', title: 'AniList #123', scheduledAt: now - 20 * 60_000 });
        expect(await dm.reload()).toMatchObject({ paused: false, lastNotifiedEpisode: null });
        await configure(false); await run(registerAnimeJobs, 'anime:notifications'); expect(mocks.send).toHaveBeenCalledOnce();
        expect(await dm.reload()).toMatchObject({ paused: false, lastNotifiedEpisode: 2 }); expect(mocks.channel).toHaveBeenCalledOnce();
        expect((await configManager.personalNotificationHistoryManager.list(owner)).items).toEqual([expect.objectContaining({ id: history[0]!.id, status: 'sent' })]);
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
        const history = (await configManager.personalNotificationHistoryManager.list(owner)).items;
        expect(history).toHaveLength(1); expect(history[0]).toMatchObject({ kind: 'schedule', status: 'delayed', reason: 'paused', title: 'Event', scheduledAt: now - 1000 });
        expect(await ScheduleOccurrence.findByPk(item.id)).toMatchObject({ state: 'pending', notificationCount: 0 });
        await configure(false); vi.setSystemTime(now + 5 * 60_000 + 1000);
        expect((await processPersonalSchedules(Date.now())).sent).toBe(1); expect(mocks.schedule).toHaveBeenCalledOnce();
        expect((await configManager.personalNotificationHistoryManager.list(owner)).items[0]).toMatchObject({ id: history[0]!.id, status: 'sent', scheduledAt: now - 1000 });
    });
    it.each(['early', 'prepare'])('waits on the current-day briefing when pause wins at %s without retry-budget consumption', async stage => {
        const manager = new MorningBriefingManager(); await manager.configure(owner, { enabled: true, localTime: '09:00', timezone: 'UTC', version: 0 });
        if (stage === 'early') await configure(true);
        else mocks.agenda.mockImplementationOnce(async () => { await configure(true); return {}; });
        expect((await processMorningBriefings(now)).errors).toBe(0); expect(mocks.send).not.toHaveBeenCalled();
        const history = (await configManager.personalNotificationHistoryManager.list(owner)).items;
        expect(history).toHaveLength(1); expect(history[0]).toMatchObject({ kind: 'briefing', status: 'delayed', reason: 'paused', title: '', scheduledAt: now });
        expect(await MorningBriefingSettings.findByPk(owner)).toMatchObject({ enabled: true });
        if (stage === 'prepare') expect(await MorningBriefingDelivery.findOne()).toMatchObject({ status: 'rejected', attempts: 0 });
        await configure(false); vi.setSystemTime(now + 61_000); expect((await processMorningBriefings(Date.now())).sent).toBe(1);
        expect(mocks.send).toHaveBeenCalledOnce();
        expect((await configManager.personalNotificationHistoryManager.list(owner)).items[0]).toMatchObject({ id: history[0]!.id, status: 'sent', scheduledAt: now });
    });
    it.each(['unknown', 'rejected'])('retires unknown digest outcomes but retries definitive %s delivery appropriately', async status => {
        const manager = configManager.userDigestSubscriptionManager;
        await manager.upsertForUser({ discordId: owner, frequency: 'daily', timezone: 'UTC', runAt: '09:00', categories: ['reminders'], nextRunAt: now });
        await configManager.reminderManager.createForUser({ id: randomUUID(), userId: owner, message: 'Soon', timespan: '1h', timestamp: now + 60 * 60_000 });
        mocks.send.mockResolvedValueOnce({ status }); await run(registerUserDigestJobs, 'user-digests:run');
        const history = (await configManager.personalNotificationHistoryManager.list(owner)).items;
        expect(history[0]).toMatchObject({ kind: 'digest', status: status === 'unknown' ? 'uncertain' : 'failed', reason: status === 'unknown' ? 'unknown' : 'retry', messageUrl: null, sentAt: null });
        const record = (await manager.getForUser(owner))!;
        expect(record.lastSentAt).toBeNull(); expect(Number(record.nextRunAt)).toBe(now + (status === 'unknown' ? 86_400_000 : 15 * 60_000));
        vi.setSystemTime(now + 16 * 60_000); await run(registerUserDigestJobs, 'user-digests:run');
        expect(mocks.send).toHaveBeenCalledTimes(status === 'unknown' ? 1 : 2);
        expect((await configManager.personalNotificationHistoryManager.list(owner)).items).toEqual([expect.objectContaining({ id: history[0]!.id,
            status: status === 'unknown' ? 'uncertain' : 'sent', scheduledAt: now })]);
    });
    it.each(['unknown', 'rejected'])('retires unknown anime episodes but retries definitive %s delivery and permits future episodes', async status => {
        const subscription = await AnimeSubscriptionConfig.create({ anilistId: 123, targetType: 'dm', userId: owner, reminderMinutes: 30, paused: false });
        mocks.send.mockResolvedValueOnce({ status }); await run(registerAnimeJobs, 'anime:notifications');
        const history = (await configManager.personalNotificationHistoryManager.list(owner)).items;
        expect(history[0]).toMatchObject({ kind: 'anime', status: status === 'unknown' ? 'uncertain' : 'failed', messageUrl: null, sentAt: null });
        expect((await subscription.reload()).lastNotifiedEpisode).toBe(status === 'unknown' ? 2 : null);
        await run(registerAnimeJobs, 'anime:notifications'); expect(mocks.send).toHaveBeenCalledTimes(status === 'unknown' ? 1 : 2);
        mocks.airing.mockResolvedValue([{ mediaId: 123, episode: 3, airingAt: (now + 15 * 60_000) / 1000 }]);
        await run(registerAnimeJobs, 'anime:notifications'); expect((await subscription.reload()).lastNotifiedEpisode).toBe(3);
        expect(mocks.send).toHaveBeenCalledTimes(status === 'unknown' ? 2 : 3);
        expect((await configManager.personalNotificationHistoryManager.list(owner)).items).toHaveLength(2);
    });
    it('settles sent reminders and never replays when history storage is unavailable', async () => {
        const reminder = await configManager.reminderManager.createForUser({ id: randomUUID(), userId: owner, message: 'History unavailable', timespan: '1h', timestamp: now - 1000 });
        vi.spyOn(configManager.personalNotificationHistoryManager, 'record').mockRejectedValue(new Error('journal offline'));
        await run(registerRemindersJobs, 'reminders:run'); await run(registerRemindersJobs, 'reminders:run');
        expect(mocks.send).toHaveBeenCalledOnce(); expect(await configManager.reminderManager.getForUser(reminder.id, owner)).toBeNull();
        expect(await ReminderDelivery.findOne({ where: { reminderId: reminder.id } })).toMatchObject({ status: 'delivered', finalized: true });
        expect(await PersonalNotificationHistory.count()).toBe(0);
    });
    it('keeps actual reminder and briefing sends working when journal-only reads fail', async () => {
        const reminder = await configManager.reminderManager.createForUser({ id: randomUUID(), userId: owner, message: 'Still send', timespan: '1h', timestamp: now - 1000 });
        vi.spyOn(configManager.reminderInteractionManager, 'pendingDelivery').mockRejectedValueOnce(new Error('history lookup offline'));
        await run(registerRemindersJobs, 'reminders:run');
        expect(await configManager.reminderManager.getForUser(reminder.id, owner)).toBeNull();
        await new MorningBriefingManager().configure(owner, { enabled: true, localTime: '09:00', timezone: 'UTC', version: 0 });
        vi.spyOn(MorningBriefingManager.prototype, 'historyCandidate').mockRejectedValueOnce(new Error('history clock lookup offline'));
        expect((await processMorningBriefings(now)).sent).toBe(1);
        expect(mocks.send).toHaveBeenCalledTimes(2);
        expect((await configManager.personalNotificationHistoryManager.list(owner)).items.every(row => row.status === 'sent')).toBe(true);
    });
    it('keeps a confirmed briefing send in history when settlement rolls back and recovery retires the claim', async () => {
        await new MorningBriefingManager().configure(owner, { enabled: true, localTime: '09:00', timezone: 'UTC', version: 0 });
        vi.spyOn(MorningBriefingDelivery.prototype, 'update').mockRejectedValueOnce(new Error('settlement offline'));
        expect((await processMorningBriefings(now)).errors).toBe(1);
        expect((await configManager.personalNotificationHistoryManager.list(owner)).items[0]).toMatchObject({ status: 'sent', scheduledAt: now,
            messageUrl: 'https://discord.com/channels/@me/987654321012345678/123456789012345678' });
        vi.setSystemTime(now + 6 * 60_000); await processMorningBriefings(Date.now());
        expect(mocks.send).toHaveBeenCalledOnce(); expect((await configManager.personalNotificationHistoryManager.list(owner)).items[0]?.status).toBe('sent');
        expect(await MorningBriefingDelivery.findOne()).toMatchObject({ status: 'uncertain' });
    });
});
