import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { formatDashboardMessage, type DashboardTranslator } from '@/lib/i18n/messages';
const mocks = vi.hoisted(() => ({ locale: 'en' as 'en' | 'nl', status: vi.fn(), calendars: vi.fn(), connect: vi.fn(), disconnect: vi.fn(), select: vi.fn(), sync: vi.fn(), remove: vi.fn(), export: vi.fn() }));
vi.mock('@/lib/api/userCalendar', () => ({ userCalendarApi: mocks }));
const publishing = vi.hoisted(() => ({ list: vi.fn(), guilds: vi.fn(), channels: vi.fn() }));
vi.mock('@/lib/api/calendarPublishing', () => ({ calendarPublishingApi: { list: publishing.list } }));
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
        container = document.createElement('div'); document.body.append(container); root = createRoot(container);
    });
    afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
    const render = async () => { await act(async () => root.render(<CalendarPanel />)); };
    const click = async (key: Parameters<typeof translate>[0]) => {
        const button = [...container.querySelectorAll('button')].find(item => item.textContent === translate(key));
        expect(button).toBeDefined(); await act(async () => button?.click());
    };
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
    it('loads publication status without fetching servers or channels while the dialog is closed', async () => {
        await render();
        expect(publishing.list).toHaveBeenCalled();
        expect(publishing.guilds).not.toHaveBeenCalled();
        expect(publishing.channels).not.toHaveBeenCalled();
        expect(container.textContent).not.toContain(translate('calendar.publishing.open'));
    });
});
