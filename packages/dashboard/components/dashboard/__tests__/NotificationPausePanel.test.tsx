import { StrictMode, act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { formatDashboardMessage, type DashboardTranslator } from '@/lib/i18n/messages';

const mocks = vi.hoisted(() => ({ locale: 'en' as 'en' | 'nl', get: vi.fn(), save: vi.fn() }));
vi.mock('@/lib/api/notificationPause', () => ({ notificationPauseApi: mocks }));
vi.mock('@/components/i18n/DashboardI18nProvider', () => ({ useDashboardI18n: () => ({ t: translate, formatDate: (value: number) => new Date(value).toISOString() }) }));
const translate: DashboardTranslator = (key, values) => formatDashboardMessage(mocks.locale, key, values);
import { NotificationPausePanel } from '../NotificationPausePanel';
const settings = { enabled: false, resumeAt: null, timezone: 'Europe/Amsterdam', version: 0 };
describe('personal notification pause controls', () => {
    let root: ReturnType<typeof createRoot>; let container: HTMLDivElement;
    beforeEach(() => {
        vi.clearAllMocks(); mocks.locale = 'en'; mocks.get.mockResolvedValue(settings);
        mocks.save.mockImplementation(async value => ({ ...value, resumeAt: null, version: value.version + 1 }));
        container = document.createElement('div'); document.body.append(container); root = createRoot(container);
    });
    afterEach(async () => { vi.useRealTimers(); await act(async () => root.unmount()); container.remove(); });
    const button = (key: Parameters<DashboardTranslator>[0]) => [...container.querySelectorAll('button')].find(value => value.textContent === translate(key))!;
    async function click(key: Parameters<DashboardTranslator>[0]) { await act(async () => button(key).click()); }
    async function render(revision?: string) { await act(async () => root.render(<NotificationPausePanel revision={revision} />)); }
    it.each(['en', 'nl'] as const)('defaults off and explicitly saves indefinite pause and resume in %s', async locale => {
        mocks.locale = locale; await render(); expect(mocks.save).not.toHaveBeenCalled();
        const toggle = container.querySelector('input[type="checkbox"]') as HTMLInputElement; expect(toggle.checked).toBe(false);
        expect(container.textContent).toContain(translate('notificationPause.active')); expect(container.textContent).toContain('Europe/Amsterdam');
        await act(async () => toggle.click()); await click('notificationPause.save');
        expect(mocks.save).toHaveBeenCalledWith({ ...settings, enabled: true });
        expect(container.textContent).toContain(translate('notificationPause.pausedIndefinitely'));
        await click('notificationPause.resume'); expect(mocks.save).toHaveBeenLastCalledWith({ ...settings, version: 1 });
        expect(container.textContent).toContain(translate('notificationPause.active'));
    });
    it('loads exact saved-zone resume time and sends owner version with chosen exact local date', async () => {
        mocks.get.mockResolvedValue({ ...settings, enabled: true, resumeAt: Date.parse('2030-01-02T09:30Z'), version: 4 });
        await render(); const field = container.querySelector('input[type="datetime-local"]') as HTMLInputElement;
        expect(field.value).toBe('2030-01-02T10:30');
        await click('notificationPause.save');
        expect(mocks.save).toHaveBeenCalledWith({ enabled: true, resumeAt: '2030-01-02T10:30', timezone: 'Europe/Amsterdam', version: 4 });
    });
    it('retains failure, reloads authoritative timezone and blocks duplicate writes', async () => {
        await render(); mocks.save.mockRejectedValueOnce(new Error('Timezone changed')); await click('notificationPause.save');
        expect(container.textContent).toContain('Timezone changed');
        mocks.get.mockResolvedValue({ ...settings, timezone: 'UTC', version: 2 }); await click('notificationPause.reload');
        let resolve!: (value: typeof settings) => void; mocks.save.mockReturnValue(new Promise(value => { resolve = value; }));
        await click('notificationPause.save'); await click('notificationPause.save'); expect(mocks.save).toHaveBeenCalledTimes(2);
        expect(mocks.save).toHaveBeenLastCalledWith({ ...settings, timezone: 'UTC', version: 2 });
        await act(async () => resolve(settings));
    });
    it('ignores stale replies across timezone revisions and supports Strict Mode', async () => {
        let resolve!: (value: typeof settings) => void; mocks.get.mockReturnValueOnce(new Promise(value => { resolve = value; }));
        await render('old'); mocks.get.mockResolvedValue({ ...settings, timezone: 'UTC' }); await render('UTC');
        await act(async () => resolve(settings)); expect(container.textContent).not.toContain('Europe/Amsterdam');
        await act(async () => root.render(<StrictMode><NotificationPausePanel /></StrictMode>));
        expect(button('notificationPause.save').disabled).toBe(false);
    });
    it('refreshes status when the automatic resume deadline passes', async () => {
        vi.useFakeTimers(); vi.setSystemTime(Date.parse('2030-01-02T09:00Z'));
        mocks.get.mockResolvedValueOnce({ ...settings, enabled: true, resumeAt: Date.now() + 60_000, version: 1 });
        await render(); expect(container.textContent).toContain(translate('notificationPause.pausedUntil', { date: '2030-01-02T09:01:00.000Z' }));
        await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
        expect(container.textContent).toContain(translate('notificationPause.active')); expect(mocks.save).not.toHaveBeenCalled();
    });
    it('treats a delayed reload snapshot crossing the deadline as resumed without losing its version', async () => {
        vi.useFakeTimers(); vi.setSystemTime(Date.parse('2030-01-02T09:00Z'));
        const snapshot = { ...settings, enabled: true, resumeAt: Date.now() + 60_000, version: 4 };
        mocks.get.mockResolvedValueOnce(snapshot); await render();
        let resolve!: (value: typeof snapshot) => void; mocks.get.mockReturnValueOnce(new Promise(value => { resolve = value; }));
        await click('notificationPause.reload'); await act(async () => { await vi.advanceTimersByTimeAsync(61_000); });
        await act(async () => resolve(snapshot)); expect(container.textContent).toContain(translate('notificationPause.active'));
        expect(button('notificationPause.resume').disabled).toBe(true);
        await click('notificationPause.save'); expect(mocks.save).toHaveBeenLastCalledWith({ ...settings, version: 4 });
    });
});
