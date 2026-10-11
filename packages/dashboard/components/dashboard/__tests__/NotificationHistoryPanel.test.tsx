import { StrictMode, act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NotificationHistoryEntry, NotificationHistoryPage } from '@/lib/api/notificationHistory';
import { formatDashboardMessage, type DashboardTranslator } from '@/lib/i18n/messages';

const mocks = vi.hoisted(() => ({ locale: 'en' as 'en' | 'nl', list: vi.fn(), date: vi.fn() }));
vi.mock('@/lib/api/notificationHistory', () => ({ notificationHistoryApi: { list: mocks.list } }));
vi.mock('@/components/i18n/DashboardI18nProvider', () => ({ useDashboardI18n: () => ({ t: translate, formatDate: mocks.date }) }));
const translate: DashboardTranslator = (key, values) => formatDashboardMessage(mocks.locale, key, values);
import { NotificationHistoryPanel } from '../NotificationHistoryPanel';
const entry = (input: Partial<NotificationHistoryEntry> = {}): NotificationHistoryEntry => ({ id: 'one', kind: 'reminder', title: '<My task>', status: 'sent',
    reason: null, scheduledAt: 1791700000000, updatedAt: 1791700001000, sentAt: 1791700001000,
    messageUrl: 'https://discord.com/channels/@me/234567890123456789/123456789012345678', ...input });
const page = (items: NotificationHistoryEntry[] = [entry()], total = items.length, offset = 0): NotificationHistoryPage => ({ items, total, offset, limit: 20, retentionDays: 90 });

describe('personal notification history panel', () => {
    let root: ReturnType<typeof createRoot>; let container: HTMLDivElement;
    beforeEach(() => {
        vi.clearAllMocks(); mocks.locale = 'en'; mocks.list.mockReset().mockResolvedValue(page());
        mocks.date.mockImplementation(value => new Date(value).toISOString());
        container = document.createElement('div'); document.body.append(container); root = createRoot(container);
    });
    afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
    const button = (key: Parameters<DashboardTranslator>[0]) => [...container.querySelectorAll('button')].find(value => value.textContent === translate(key))!;
    const click = async (key: Parameters<DashboardTranslator>[0]) => { await act(async () => button(key).click()); };
    const render = async () => { await act(async () => root.render(<NotificationHistoryPanel timezone="Europe/Amsterdam" />)); };
    async function filter(id: 'kind' | 'status', value: string) {
        await act(async () => {
            const select = container.querySelector(`#notification-history-${id}`) as HTMLSelectElement;
            select.value = value; select.dispatchEvent(new Event('change', { bubbles: true }));
        });
    }
    it.each(['en', 'nl'] as const)('localizes statuses and history controls while preserving authored titles in %s', async locale => {
        mocks.locale = locale; await render();
        expect(container.textContent).toContain(translate('notificationHistory.title')); expect(container.textContent).toContain('<My task>');
        expect(container.querySelector('my')).toBeNull(); expect(container.textContent).toContain(translate('notificationHistory.statuses.sent'));
        expect(mocks.date).toHaveBeenCalledWith(entry().scheduledAt, expect.objectContaining({ timeZone: 'Europe/Amsterdam' }));
        const link = container.querySelector('a')!;
        expect(link.href).toBe(entry().messageUrl); expect(link.rel).toBe('noopener noreferrer');
    });
    it('pages fully filtered results and resets the page when either filter changes', async () => {
        mocks.list.mockResolvedValue(page([entry()], 21)); await render();
        await click('notificationHistory.next'); expect(mocks.list).toHaveBeenLastCalledWith({ limit: 20, offset: 20 });
        await filter('kind', 'anime'); expect(mocks.list).toHaveBeenLastCalledWith({ kind: 'anime', limit: 20, offset: 0 });
        await filter('status', 'delayed'); expect(mocks.list).toHaveBeenLastCalledWith({ kind: 'anime', status: 'delayed', limit: 20, offset: 0 });
    });
    it('shows truthful empty and uncertain outcomes without a confirmed-send link', async () => {
        mocks.list.mockResolvedValueOnce(page([])); await render();
        expect(container.textContent).toContain(translate('notificationHistory.empty')); expect(container.textContent).toContain(translate('notificationHistory.collection'));
        mocks.list.mockResolvedValueOnce(page([entry({ kind: 'digest', title: '', status: 'uncertain', reason: 'unknown', sentAt: null, messageUrl: null })]));
        await click('notificationHistory.refresh'); expect(container.textContent).toContain(translate('notificationHistory.uncertainHelp'));
        expect(container.textContent).toContain(translate('notificationHistory.kinds.digest')); expect(container.querySelector('a')).toBeNull();
    });
    it('ignores an old filter reply and supports Strict Mode', async () => {
        let resolve!: (value: NotificationHistoryPage) => void;
        mocks.list.mockReturnValueOnce(new Promise(value => { resolve = value; })); await render();
        mocks.list.mockResolvedValueOnce(page([entry({ title: 'New filter' })])); await filter('kind', 'anime');
        await act(async () => resolve(page([entry({ title: 'Old filter' })])));
        expect(container.textContent).toContain('New filter'); expect(container.textContent).not.toContain('Old filter');
        await act(async () => root.render(<StrictMode><NotificationHistoryPanel /></StrictMode>));
        expect(button('notificationHistory.refresh').disabled).toBe(false);
    });
    it('shows failures and permits an explicit retry', async () => {
        mocks.list.mockRejectedValueOnce(new Error('History unavailable')); await render();
        expect(container.textContent).toContain('History unavailable'); expect(button('notificationHistory.refresh').disabled).toBe(false);
        await click('notificationHistory.refresh'); expect(container.textContent).not.toContain('History unavailable'); expect(container.textContent).toContain('<My task>');
    });
    it('returns to a valid page if retention removes the last page during refresh', async () => {
        mocks.list.mockResolvedValueOnce(page([entry()], 21)); await render();
        mocks.list.mockResolvedValueOnce(page([], 20, 20)); mocks.list.mockResolvedValueOnce(page([entry()], 20));
        await click('notificationHistory.next'); expect(mocks.list).toHaveBeenLastCalledWith({ limit: 20, offset: 0 });
        expect(button('notificationHistory.previous').disabled).toBe(true);
    });
});
