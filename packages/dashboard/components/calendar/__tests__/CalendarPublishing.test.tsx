import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { formatDashboardMessage, type DashboardTranslator } from '@/lib/i18n/messages';
import { CalendarPublishingDialog } from '../CalendarPublishingDialog';
import { CalendarPublishingList } from '../CalendarPublishingList';

const mocks = vi.hoisted(() => ({ locale: 'en' as 'en' | 'nl', preview: vi.fn(), confirm: vi.fn(), list: vi.fn(), stop: vi.fn(), close: vi.fn(), published: vi.fn() }));
vi.mock('@/lib/api/calendarPublishing', () => ({ calendarPublishingApi: mocks }));
vi.mock('@/components/i18n/DashboardI18nProvider', () => ({ useDashboardI18n: () => ({ t: translate, formatDate: (at: number) => String(at) }) }));
vi.mock('@/components/hooks/useDashboardData', () => ({ useDashboardData: () => ({ guilds: [{ id: 'guild', name: 'Gaming' }, { id: 'other', name: 'Other' }], loading: false, error: null }) }));
vi.mock('@/components/hooks/useGuildChannels', () => ({ useGuildChannels: () => ({ channels: [{ id: 'channel', name: 'events', type: 0 }, { id: 'announcements', name: 'announcements', type: 5 }, { id: 'voice', name: 'voice', type: 2 }], loading: false, error: null }) }));
const translate: DashboardTranslator = (key, values) => formatDashboardMessage(mocks.locale, key, values);
const source = { id: 'source', calendarId: 'calendar', label: 'My calendar', timezone: 'UTC', titleFilter: null, enabled: true, version: 0, lastSyncedAt: null };
const events = Array.from({ length: 6 }, (_, index) => ({ title: `Event ${index}`, plannedAt: 1_900_000_000_000 + index * 86_400_000, endAt: null, timezone: 'UTC', allDay: false, discordEvent: null }));
const preview = { draftId: 'draft', expiresAt: Date.now() + 600_000, guildName: 'Gaming', channelName: 'events', count: 6, eventCount: 0, lookaheadDays: 180, eventLeadDays: null, publicTitle: null, events };

describe('calendar publication consent', () => {
    let root: ReturnType<typeof createRoot>;
    let container: HTMLDivElement;
    beforeEach(() => {
        vi.clearAllMocks(); mocks.locale = 'en';
        mocks.preview.mockResolvedValue({ ...preview, expiresAt: Date.now() + 600_000 });
        mocks.confirm.mockResolvedValue({ publication: {} });
        mocks.list.mockResolvedValue({ publications: [{ id: 'publication', sourceId: 'source', guildId: 'guild', channelId: 'channel', guildName: 'Gaming', channelName: 'events', lookaheadDays: 180, eventLeadDays: null, publicTitle: null, enabled: true, lastError: 'provider detail', uncertainCount: 2 }] });
        mocks.stop.mockResolvedValue({ success: true });
        container = document.createElement('div'); document.body.append(container); root = createRoot(container);
    });
    afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
    const render = async () => { await act(async () => root.render(<CalendarPublishingDialog source={source} onClose={mocks.close} onPublished={mocks.published} />)); };
    const button = (key: Parameters<typeof translate>[0]) => [...document.querySelectorAll('button')].find(element => element.textContent === translate(key))!;
    const click = async (key: Parameters<typeof translate>[0]) => { expect(button(key)).toBeDefined(); await act(async () => button(key).click()); };
    const field = (key: Parameters<typeof translate>[0]) => {
        const label = [...document.querySelectorAll('label')].find(element => element.textContent === translate(key));
        expect(label).toBeDefined();
        return document.getElementById(label!.htmlFor) as HTMLInputElement | HTMLSelectElement;
    };
    const change = async (key: Parameters<typeof translate>[0], value: string) => {
        const input = field(key);
        await act(async () => {
            const prototype = input.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
            Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(input, value);
            input.dispatchEvent(new Event(input.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
        });
    };
    const check = async (key: Parameters<typeof translate>[0]) => {
        const label = [...document.querySelectorAll('label')].find(element => element.textContent === translate(key));
        expect(label).toBeDefined(); await act(async () => label!.querySelector('input')!.click());
    };
    const destination = async () => { await change('calendar.publishing.guild', 'guild'); await change('calendar.publishing.channel', 'channel'); };
    const channelConsent = async () => { await check('calendar.publishing.acknowledgeChannel'); await change('calendar.publishing.confirmName', 'events'); };

    it.each(['en', 'nl'] as const)('requires explicit destination, preview, consent and exact channel name in %s', async locale => {
        mocks.locale = locale; await render();
        expect(field('calendar.publishing.guild').value).toBe('');
        expect(field('calendar.publishing.channel').value).toBe('');
        expect(field('calendar.publishing.lookahead').value).toBe('180');
        expect(document.querySelector<HTMLInputElement>('input[type=checkbox]')!.checked).toBe(false);
        expect(button('calendar.publishing.preview').disabled).toBe(true);
        expect(button('calendar.publishing.enable').disabled).toBe(true);
        expect(mocks.preview).not.toHaveBeenCalled(); expect(mocks.confirm).not.toHaveBeenCalled();
        await destination();
        expect(field('calendar.publishing.channel').textContent).not.toContain('voice');
        await click('calendar.publishing.preview');
        expect(mocks.preview).toHaveBeenCalledWith({ sourceId: 'source', guildId: 'guild', channelId: 'channel', lookaheadDays: 180, eventLeadDays: null, publicTitle: null });
        expect(document.body.textContent).toContain(translate('calendar.publishing.destination', { guild: 'Gaming', channel: 'events' }));
        for (const event of events) expect(document.body.textContent).toContain(event.title);
        await check('calendar.publishing.acknowledgeChannel');
        await change('calendar.publishing.confirmName', '#events');
        expect(button('calendar.publishing.enable').disabled).toBe(true);
        await change('calendar.publishing.confirmName', 'events');
        expect(button('calendar.publishing.enable').disabled).toBe(false);
        await click('calendar.publishing.enable');
        expect(mocks.confirm).toHaveBeenCalledWith({ draftId: 'draft', acknowledgeChannel: true, acknowledgeServerEvents: false, confirmChannelName: 'events' });
        expect(mocks.published).toHaveBeenCalled(); expect(mocks.close).toHaveBeenCalled();
    });
    it('requires separate consent for optional server-wide Discord Events', async () => {
        mocks.preview.mockResolvedValue({ ...preview, eventLeadDays: 7, eventCount: 6 });
        await render(); await destination(); await check('calendar.publishing.createEvents');
        expect(field('calendar.publishing.eventLeadLabel').value).toBe('7');
        expect(document.body.textContent).toContain(translate('calendar.publishing.serverWarning'));
        await click('calendar.publishing.preview'); await channelConsent();
        expect(mocks.preview).toHaveBeenCalledWith(expect.objectContaining({ eventLeadDays: 7 }));
        expect(button('calendar.publishing.enable').disabled).toBe(true);
        await check('calendar.publishing.acknowledgeEvents'); await click('calendar.publishing.enable');
        expect(mocks.confirm).toHaveBeenCalledWith(expect.objectContaining({ acknowledgeServerEvents: true }));
    });
    it.each(['guild', 'channel', 'lookahead', 'override', 'createEvents'] as const)('invalidates preview and consent when %s changes', async setting => {
        await render(); await destination(); await click('calendar.publishing.preview'); await channelConsent();
        expect(button('calendar.publishing.enable').disabled).toBe(false);
        if (setting === 'guild') await change('calendar.publishing.guild', 'other');
        if (setting === 'channel') await change('calendar.publishing.channel', 'announcements');
        if (setting === 'lookahead') await change('calendar.publishing.lookahead', '90');
        if (setting === 'override') await change('calendar.publishing.override', 'Appointment');
        if (setting === 'createEvents') await check('calendar.publishing.createEvents');
        expect(button('calendar.publishing.enable').disabled).toBe(true);
        expect(document.body.textContent).not.toContain('Event 5');
        expect(mocks.confirm).not.toHaveBeenCalled();
        if (setting === 'guild') expect(field('calendar.publishing.channel').value).toBe('');
        await click('calendar.publishing.cancel'); expect(mocks.confirm).not.toHaveBeenCalled();
    });
    it('rejects an expired preview and clears consent after a confirmation failure', async () => {
        mocks.preview.mockResolvedValueOnce({ ...preview, expiresAt: Date.now() - 1 });
        await render(); await destination(); await click('calendar.publishing.preview'); await channelConsent();
        expect(button('calendar.publishing.enable').disabled).toBe(true);
        await click('calendar.publishing.preview'); await channelConsent();
        mocks.confirm.mockRejectedValueOnce(new Error('Localized confirmation failure'));
        await click('calendar.publishing.enable');
        expect(document.body.textContent).toContain('Localized confirmation failure');
        expect(button('calendar.publishing.enable').disabled).toBe(true);
        expect(mocks.published).not.toHaveBeenCalled();
    });
    it('surfaces a preview error without allowing confirmation', async () => {
        mocks.preview.mockRejectedValueOnce(new Error('Localized preview failure'));
        await render(); await destination(); await click('calendar.publishing.preview');
        expect(document.body.textContent).toContain('Localized preview failure');
        expect(button('calendar.publishing.enable').disabled).toBe(true);
    });
    it('rechecks expiry at the enable click and does not submit an expired draft', async () => {
        await render(); await destination(); await click('calendar.publishing.preview'); await channelConsent();
        const clock = vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 601_000);
        try {
            await click('calendar.publishing.enable');
            expect(mocks.confirm).not.toHaveBeenCalled();
            expect(document.body.textContent).toContain(translate('calendar.publishing.confirmFailed'));
        } finally { clock.mockRestore(); }
    });
    it('previews the title override actually shared publicly', async () => {
        mocks.preview.mockResolvedValueOnce({ ...preview, publicTitle: 'Appointment' });
        await render(); await destination(); await change('calendar.publishing.override', 'Appointment'); await click('calendar.publishing.preview');
        expect(mocks.preview).toHaveBeenCalledWith(expect.objectContaining({ publicTitle: 'Appointment' }));
        expect(document.body.textContent).not.toContain('Event 5');
        expect(document.body.textContent).toContain('Appointment');
    });
    it.each(['en', 'nl'] as const)('shows every exact Discord Event field including truncation and fallback duration in %s', async locale => {
        mocks.locale = locale;
        const longTitle = 'A'.repeat(110);
        const eventRows = events.map((event, index) => ({ ...event, title: index === 0 ? longTitle : event.title,
            plannedAt: event.plannedAt + 30 * 86_400_000, allDay: index === 0,
            discordEvent: { name: index === 0 ? longTitle.slice(0, 100) : event.title,
                plannedAt: event.plannedAt + 30 * 86_400_000, endAt: event.plannedAt + 30 * 86_400_000 + 3_600_000,
                location: `Discord location ${index}`, description: `Generated description ${index}\nSecond line` } }));
        mocks.preview.mockResolvedValueOnce({ ...preview, eventLeadDays: 7, eventCount: 0, events: eventRows });
        await render(); await destination(); await check('calendar.publishing.createEvents'); await click('calendar.publishing.preview');
        expect(document.body.textContent).toContain(longTitle);
        expect(document.body.textContent).toContain(translate('calendar.publishing.discordEventName', { name: longTitle.slice(0, 100) }));
        expect(document.body.textContent).toContain(translate('calendar.publishing.eventDurationHelp'));
        expect(document.body.textContent).toContain(translate('calendar.publishing.approvalHelp'));
        for (const event of eventRows) {
            const details = event.discordEvent;
            expect(document.body.textContent).toContain(translate('calendar.publishing.discordEventStart', { date: String(details.plannedAt) }));
            expect(document.body.textContent).toContain(translate('calendar.publishing.ends', { date: String(details.endAt) }));
            expect(document.body.textContent).toContain(translate('calendar.publishing.discordEventLocation', { location: details.location }));
            expect(document.body.textContent).toContain(translate('calendar.publishing.discordEventDescription', { description: details.description }));
        }
    });
    it.each(['en', 'nl'] as const)('shows uncertain outcomes and handles stop failure without enabling retry in %s', async locale => {
        mocks.locale = locale;
        await act(async () => root.render(<CalendarPublishingList revision={0} />));
        expect(container.textContent).toContain(translate('calendar.publishing.uncertain', { count: 2 }));
        expect(container.textContent).toContain(translate('calendar.publishing.deliveryError'));
        expect(container.textContent).not.toContain('provider detail');
        mocks.stop.mockRejectedValueOnce(new Error('failure')); await click('calendar.publishing.stop');
        expect(container.textContent).toContain(translate('calendar.publishing.stopFailed'));
        expect(button('calendar.publishing.stop').disabled).toBe(false);
        await click('calendar.publishing.stop');
        expect(mocks.stop).toHaveBeenCalledWith('publication');
        expect(container.textContent).toContain(translate('calendar.publishing.stopped'));
        expect(container.textContent).toContain(translate('calendar.publishing.stopHelp'));
        expect(mocks.confirm).not.toHaveBeenCalled();
    });
});
