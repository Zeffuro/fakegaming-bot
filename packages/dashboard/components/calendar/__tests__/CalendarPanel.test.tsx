import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { formatDashboardMessage, type DashboardTranslator } from '@/lib/i18n/messages';
const mocks = vi.hoisted(() => ({ locale: 'en' as 'en' | 'nl', status: vi.fn(), calendars: vi.fn(), connect: vi.fn(), disconnect: vi.fn(), select: vi.fn(), sync: vi.fn(), remove: vi.fn(), export: vi.fn() }));
vi.mock('@/lib/api/userCalendar', () => ({ userCalendarApi: mocks }));
const publishing = vi.hoisted(() => ({ list: vi.fn(), guilds: vi.fn(), channels: vi.fn() }));
vi.mock('@/lib/api/calendarPublishing', () => ({ calendarPublishingApi: { list: publishing.list } }));
const overlaps = vi.hoisted(() => ({ list: vi.fn() }));
vi.mock('@/lib/api/calendarOverlaps', () => ({ calendarOverlapsApi: overlaps }));
vi.mock('@/components/hooks/useDashboardData', () => ({ useDashboardData: publishing.guilds }));
vi.mock('@/components/hooks/useGuildChannels', () => ({ useGuildChannels: publishing.channels }));
vi.mock('@/components/i18n/DashboardI18nProvider', () => ({ useDashboardI18n: () => ({ t: translate, formatDate: (at: number) => String(at) }) }));
const translate: DashboardTranslator = (key, values) => formatDashboardMessage(mocks.locale, key, values);
import { CalendarPanel } from '../CalendarPanel';

describe('calendar dashboard selection', () => {
    let root: ReturnType<typeof createRoot>;
    let container: HTMLDivElement;
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.locale = 'en';
        mocks.status.mockResolvedValue({ configured: true, connected: true, sources: [{ id: 'source', calendarId: 'calendar', label: 'Private calendar', timezone: 'UTC', enabled: false, titleFilter: 'Medicine', lastSyncedAt: null }] });
        mocks.calendars.mockResolvedValue({ calendars: [{ id: 'calendar', summary: 'Private calendar', timeZone: 'UTC' }] });
        mocks.select.mockResolvedValue({ source: {}, syncPending: false });
        publishing.list.mockResolvedValue({ publications: [] });
        overlaps.list.mockResolvedValue({ overlaps: [], sources: [], connected: true, total: 0, offset: 0, limit: 10 });
        container = document.createElement('div'); document.body.append(container); root = createRoot(container);
    });
    afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
    const render = async () => { await act(async () => root.render(<CalendarPanel />)); };
    const click = async (key: Parameters<typeof translate>[0]) => {
        const button = [...container.querySelectorAll('button')].find(item => item.textContent === translate(key));
        expect(button).toBeDefined(); await act(async () => button?.click());
    };
    it.each(['en', 'nl'] as const)('collapses setup for selected calendars and keeps source status visible in %s', async locale => {
        mocks.locale = locale; await render();
        const setup = [...container.querySelectorAll('details')].find(value => value.querySelector('summary')?.textContent === translate('calendar.settings'))!;
        expect(setup.open).toBe(false);
        expect(container.querySelector('input')?.closest('details')).toBe(setup);
        expect([...container.querySelectorAll('button')].find(value => value.textContent === translate('calendar.reconnect'))?.closest('details')).toBe(setup);
        expect([...container.querySelectorAll('button')].find(value => value.textContent === translate('calendar.resume'))?.closest('details')).toBeNull();
        expect([...setup.querySelectorAll('summary')].some(value => value.textContent === translate('calendar.help'))).toBe(true);
        await act(async () => { setup.open = true; setup.dispatchEvent(new Event('toggle')); });
        expect(setup.open).toBe(true);
    });
    it('opens connection and calendar settings when no sources are selected', async () => {
        mocks.status.mockResolvedValue({ configured: true, connected: true, sources: [] }); await render();
        expect(container.querySelector('details')?.open).toBe(true);
        expect(mocks.select).not.toHaveBeenCalled();
    });
    it('keeps publication status and delivery warnings outside collapsed details', async () => {
        publishing.list.mockResolvedValue({ publications: [{ id: 'publication', guildName: 'Server', channelName: 'calendar', enabled: true,
            lookaheadDays: 7, eventLeadDays: 3, publicTitle: 'Public title', includeEventDetails: true, lastError: 'Delivery failed', uncertainCount: 1 }] });
        await render();
        const warning = [...container.querySelectorAll('[role="alert"]')].find(value => value.textContent?.includes(translate('calendar.publishing.deliveryError')))!;
        expect(warning).toBeDefined(); expect(warning.closest('details')).toBeNull();
        const stop = [...container.querySelectorAll('button')].find(value => value.textContent === translate('calendar.publishing.stop'))!;
        expect(stop.closest('details')).toBeNull();
        const details = [...container.querySelectorAll('details')].find(value => value.querySelector('summary')?.textContent === translate('calendar.publicationDetails'))!;
        expect(details.open).toBe(false); expect(details.textContent).toContain('Public title');
        expect(container.textContent).toContain(translate('calendar.publishing.enabled'));
    });
    it.each(['en', 'nl'] as const)('resumes stable calendar/filter selections and preserves history guidance in %s', async locale => {
        mocks.locale = locale;
        await render();
        expect(container.textContent).toContain('Private calendar');
        expect(container.textContent).toContain(translate('calendar.selectedFilter', { filter: 'Medicine' }));
        expect(container.textContent).toContain(translate('calendar.historyHelp'));
        await click('calendar.resume');
        expect(mocks.select).toHaveBeenCalledWith('calendar', 'Medicine');
        await click('calendar.remove');
        expect(mocks.remove).toHaveBeenCalledWith('source');
    });
    it('shows setup guidance without contacting Google when server credentials are absent', async () => {
        mocks.status.mockResolvedValue({ configured: false, connected: false, sources: [] });
        await render();
        expect(container.textContent).toContain(translate('calendar.notConfigured'));
        expect(container.textContent).toContain('GOOGLE_CALENDAR_TOKEN_ENC_KEY');
        expect(container.textContent).not.toContain(translate('calendar.connect'));
        expect(mocks.calendars).not.toHaveBeenCalled();
    });
    it('keeps selection controls usable and surfaces a provider error', async () => {
        mocks.remove.mockRejectedValueOnce(new Error('Unavailable'));
        await render(); await click('calendar.remove');
        expect(container.textContent).toContain('Unavailable');
        const resume = [...container.querySelectorAll('button')].find(item => item.textContent === translate('calendar.resume'));
        expect(resume?.disabled).toBe(false);
    });
    it('refreshes private overlap warnings after sync and selection status reloads', async () => {
        mocks.status.mockResolvedValue({ configured: true, connected: true, sources: [{ id: 'source', calendarId: 'calendar', label: 'Private calendar', timezone: 'UTC', enabled: true, titleFilter: null, lastSyncedAt: 100 }] });
        await render();
        const calls = overlaps.list.mock.calls.length;
        await click('calendar.sync');
        expect(overlaps.list.mock.calls.length).toBeGreaterThan(calls);
    });
    it('loads publication status without fetching servers or channels while the dialog is closed', async () => {
        await render();
        expect(publishing.list).toHaveBeenCalled();
        expect(publishing.guilds).not.toHaveBeenCalled();
        expect(publishing.channels).not.toHaveBeenCalled();
        expect(container.textContent).not.toContain(translate('calendar.publishing.open'));
    });
});
