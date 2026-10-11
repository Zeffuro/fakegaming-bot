import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { formatDashboardMessage, type DashboardTranslator } from '@/lib/i18n/messages';
import type { CalendarOverlapPage } from '@/lib/api/calendarOverlaps';

const mocks = vi.hoisted(() => ({ locale: 'en' as 'en' | 'nl', list: vi.fn(), formatDate: vi.fn() }));
vi.mock('@/lib/api/calendarOverlaps', () => ({ calendarOverlapsApi: { list: mocks.list } }));
vi.mock('@/components/i18n/DashboardI18nProvider', () => ({ useDashboardI18n: () => ({ t: translate, formatDate: mocks.formatDate }) }));
const translate: DashboardTranslator = (key, values) => formatDashboardMessage(mocks.locale, key, values);
import { CalendarOverlapWarnings } from '../CalendarOverlapWarnings';

const event = { id: 'one', title: '<Private event>', sourceLabel: 'Long private calendar name', timezone: 'Europe/Amsterdam', startAt: 1000, endAt: 2000 };
const response = (extra: Partial<CalendarOverlapPage> = {}): CalendarOverlapPage => ({
    overlaps: [{ first: event, second: { ...event, id: 'two', title: 'Second event', timezone: 'America/New_York' }, startAt: 1000, endAt: 2000 }],
    connected: true, total: 11, offset: 0, limit: 10, checkedAt: 1, until: 2,
    sources: [{ id: 'ready', label: 'Synced calendar', lastSyncedAt: 123 }, { id: 'pending', label: 'Unsynced calendar', lastSyncedAt: null }],
    ...extra,
});

describe('private calendar overlap warnings', () => {
    let root: ReturnType<typeof createRoot>;
    let container: HTMLDivElement;
    beforeEach(() => {
        vi.clearAllMocks(); mocks.locale = 'en'; mocks.list.mockResolvedValue(response());
        mocks.formatDate.mockImplementation((at: number, options?: Intl.DateTimeFormatOptions) => `${at}:${options?.timeZone ?? 'UTC'}`);
        container = document.createElement('div'); document.body.append(container); root = createRoot(container);
    });
    afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
    const render = async (revision = 0) => { await act(async () => root.render(<CalendarOverlapWarnings revision={revision} />)); };
    const click = async (key: Parameters<typeof translate>[0]) => {
        const button = [...container.querySelectorAll('button')].find(item => item.textContent === translate(key));
        expect(button).toBeDefined(); await act(async () => button?.click());
    };
    it.each(['en', 'nl'] as const)('explains the saved timed-only scope, shows readable labels, and formats each source timezone in %s', async locale => {
        mocks.locale = locale;
        await render();
        expect(container.textContent).toContain(translate('calendarOverlaps.help'));
        expect(container.textContent).toContain(translate('calendarOverlaps.pendingSource', { source: 'Unsynced calendar' }));
        expect(container.textContent).toContain('<Private event>'); expect(container.querySelector('private')).toBeNull();
        expect(container.textContent).toContain('1000:Europe/Amsterdam'); expect(container.textContent).toContain('1000:America/New_York');
        expect(container.textContent).toContain('Long private calendar name');
    });
    it('pages through the full pair count, resetting after parent refresh', async () => {
        await render(); await click('calendarOverlaps.next');
        expect(mocks.list).toHaveBeenLastCalledWith(10, 10);
        expect(container.textContent).toContain(translate('calendarOverlaps.page', { page: 2, pages: 2 }));
        await render(1); expect(mocks.list).toHaveBeenLastCalledWith(0, 10);
    });
    it('retries visibly after a load failure and does not retain stale warning rows', async () => {
        await render(); mocks.list.mockRejectedValueOnce(new Error('secret'));
        await render(1);
        expect(container.textContent).toContain(translate('calendarOverlaps.failed'));
        expect(container.textContent).not.toContain('<Private event>'); expect(container.textContent).not.toContain('secret');
        await click('calendarOverlaps.retry'); expect(container.textContent).toContain('<Private event>');
    });
    it('explains missing active sources and disconnection rather than claiming a complete calendar check', async () => {
        mocks.list.mockResolvedValue(response({ sources: [], overlaps: [], total: 0 })); await render();
        expect(container.textContent).toContain(translate('calendarOverlaps.noSources'));
        mocks.list.mockResolvedValue(response({ connected: false, sources: [], overlaps: [], total: 0 })); await render(1);
        expect(container.textContent).toContain(translate('calendarOverlaps.disconnected'));
    });
    it('recovers when a background sync removes pairs beyond the current page', async () => {
        await render(); mocks.list.mockResolvedValue(response({ total: 0, overlaps: [] }));
        await click('calendarOverlaps.next'); expect(mocks.list).toHaveBeenLastCalledWith(0, 10);
        expect(container.textContent).toContain(translate('calendarOverlaps.empty', { count: 0 }));
    });
});
