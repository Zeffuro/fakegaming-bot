import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { formatDashboardMessage, type DashboardTranslator } from '@/lib/i18n/messages';
import type { PersonalToday, TodayTask } from '@/lib/api/personalToday';

const mocks = vi.hoisted(() => ({ locale: 'en' as 'en' | 'nl', get: vi.fn(), task: vi.fn(), schedule: vi.fn(), session: vi.fn(), snooze: vi.fn(), dismiss: vi.fn() }));
vi.mock('@/lib/api/personalToday', () => ({ personalTodayApi: { get: mocks.get, task: mocks.task, schedule: mocks.schedule, session: mocks.session } }));
vi.mock('@/lib/api/userReminders', () => ({ userRemindersApi: { snoozeUserReminder: mocks.snooze, deleteUserReminder: mocks.dismiss } }));
vi.mock('@/components/i18n/DashboardI18nProvider', () => ({ useDashboardI18n: () => ({ t: translate, formatDate: (at: number) => String(at) }) }));
const translate: DashboardTranslator = (key, values) => formatDashboardMessage(mocks.locale, key, values);
import { TodayPanel } from '../TodayPanel';

const now = Date.parse('2026-10-09T10:00:00Z');
const task = (id: string, dueAt: number | null = now): TodayTask => ({ id, title: `Task ${id}`, dueAt, version: 3, recurring: false, checklist: [], sourceUrl: null });
const fixture = (): PersonalToday => ({
    now, day: '2026-10-09', timezone: 'Europe/Amsterdam', tasks: [task('first', now - 60_000), task('undated', null)],
    reminders: [{ id: 'reminder', title: 'Remember me', dueAt: now + 60_000 }],
    schedules: [{ id: 'schedule', title: 'Calendar occurrence', plannedAt: now + 120_000, endAt: null, allDay: false, timezone: 'UTC', version: 2, nextNotifyAt: null }],
    countdowns: [{ id: 'countdown', title: 'Holiday', dueAt: now + 86_400_000 }],
    session: { id: 'session', title: 'My session', kind: 'focus', state: 'running', phase: 'focus', workMs: 120_000, breakElapsedMs: 0, remainingMs: 180_000, version: 4 },
});

describe('Today dashboard', () => {
    let root: ReturnType<typeof createRoot>;
    let container: HTMLDivElement;
    beforeEach(() => {
        vi.clearAllMocks(); mocks.locale = 'en'; mocks.get.mockResolvedValue(fixture());
        for (const action of [mocks.task, mocks.schedule, mocks.session, mocks.snooze, mocks.dismiss]) action.mockResolvedValue({});
        container = document.createElement('div'); document.body.append(container); root = createRoot(container);
    });
    afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
    const render = async (revision?: string) => { await act(async () => root.render(<TodayPanel revision={revision} />)); };
    const click = async (key: Parameters<typeof translate>[0]) => {
        const button = [...container.querySelectorAll('button')].find(item => item.textContent === translate(key));
        expect(button).toBeDefined(); await act(async () => button!.click());
    };
    it.each(['en', 'nl'] as const)('shows all private agenda kinds and saved timezone in %s', async locale => {
        mocks.locale = locale; await render();
        for (const text of ['Task first', 'Task undated', 'Remember me', 'Calendar occurrence', 'Holiday', 'My session', 'Europe/Amsterdam']) expect(container.textContent).toContain(text);
        expect(container.textContent).toContain(translate('today.overdue'));
        expect(container.textContent).toContain(translate('today.elapsed', { minutes: 2 }));
        expect(container.textContent!.indexOf('Task first')).toBeLessThan(container.textContent!.indexOf('Remember me'));
    });
    it('uses persisted versions for actions and reloads the agenda after each mutation', async () => {
        await render(); await click('today.done');
        expect(mocks.task).toHaveBeenCalledWith('first', { action: 'done', version: 3 });
        await click('today.complete'); expect(mocks.schedule).toHaveBeenCalledWith('schedule', { action: 'complete', version: 2 });
        await click('today.remindLater'); expect(mocks.schedule).toHaveBeenCalledWith('schedule', { action: 'snooze', version: 2, minutes: 60 });
        await click('today.pause'); expect(mocks.session).toHaveBeenCalledWith('session', { action: 'pause', version: 4 });
        await click('today.stop'); expect(mocks.session).toHaveBeenCalledWith('session', { action: 'stop', version: 4 });
        expect(mocks.get).toHaveBeenCalledTimes(6);
    });
    it.each(['en', 'nl'] as const)('keeps a quick undo action after the task disappears in %s and handles stale undo safely', async locale => {
        mocks.locale = locale;
        mocks.task.mockResolvedValueOnce({ id: 'first', title: 'Task first', version: 4, canUndo: true });
        mocks.get.mockResolvedValueOnce(fixture()).mockResolvedValue({ ...fixture(), tasks: [] });
        await render(); await click('today.done');
        expect(container.textContent).toContain(translate('today.completedTask', { title: 'Task first' }));
        mocks.task.mockRejectedValueOnce(new Error('Task changed'));
        await click('today.undo');
        expect(container.textContent).toContain('Task changed');
        expect(mocks.task).toHaveBeenLastCalledWith('first', { action: 'undo', version: 4 });
        await click('today.undo');
        expect(container.textContent).not.toContain(translate('today.completedTask', { title: 'Task first' }));
    });
    it('snoozes tasks and changes only the selected checklist entry', async () => {
        const data = fixture(); data.tasks[0].checklist = [{ text: 'One', done: false }]; mocks.get.mockResolvedValue(data);
        await render(); await click('today.snooze');
        expect(mocks.task).toHaveBeenCalledWith('first', { action: 'snooze', version: 3, minutes: 60 });
        await act(async () => container.querySelector<HTMLInputElement>('input[type=checkbox]')!.click());
        expect(mocks.task).toHaveBeenCalledWith('first', { action: 'check', version: 3, index: 0 });
    });
    it.each(['en', 'nl'] as const)('moves a task to tomorrow with its current version in %s', async locale => {
        mocks.locale = locale;
        const refresh = vi.fn(); window.addEventListener('personal-today-refresh', refresh);
        try {
            await render(); await click('today.tomorrow');
            expect(mocks.task).toHaveBeenCalledWith('first', { action: 'tomorrow', version: 3 });
            expect(mocks.get).toHaveBeenCalledTimes(2); expect(refresh).toHaveBeenCalledOnce();
        } finally { window.removeEventListener('personal-today-refresh', refresh); }
    });
    it('snoozes and dismisses normal reminders through the owner API', async () => {
        const data = fixture(); data.tasks = []; mocks.get.mockResolvedValue(data);
        await render(); await click('today.snooze'); expect(mocks.snooze).toHaveBeenCalledWith('reminder', { timespan: '1h' });
        await click('today.dismiss'); expect(mocks.dismiss).toHaveBeenCalledWith('reminder');
    });
    it('supports paused sessions, safe source links and all-day labels', async () => {
        const data = fixture(); data.session!.state = 'paused'; data.schedules[0].allDay = true;
        data.tasks[0].sourceUrl = 'https://discord.com/channels/1/2/3'; data.tasks[1].sourceUrl = 'javascript:alert(1)'; mocks.get.mockResolvedValue(data);
        await render(); await click('today.resume');
        expect(mocks.session).toHaveBeenCalledWith('session', { action: 'resume', version: 4 });
        expect(container.querySelectorAll('a')).toHaveLength(1);
        expect(container.querySelector('a')?.getAttribute('rel')).toBe('noopener noreferrer');
        expect(container.textContent).toContain(translate('today.allDay', { day: String(data.schedules[0].plannedAt) }));
    });
    it('exposes every item through pagination and refreshes after note conversion', async () => {
        const data = fixture(); data.tasks = Array.from({ length: 12 }, (_, i) => task(String(i), null)); mocks.get.mockResolvedValue(data);
        await render(); expect(container.textContent).not.toContain('Task 11'); await click('today.next'); expect(container.textContent).toContain('Task 11');
        await act(async () => window.dispatchEvent(new Event('personal-today-refresh')));
        expect(mocks.get).toHaveBeenCalledTimes(2);
    });
    it('shows mutation errors without pretending that completion succeeded', async () => {
        mocks.task.mockRejectedValue(new Error('This item changed. Refresh Today and try again.'));
        await render(); await click('today.done');
        expect(container.textContent).toContain('This item changed.');
        expect(container.textContent).toContain('Task first');
        expect(mocks.get).toHaveBeenCalledTimes(1);
    });
    it('ignores late agenda responses after a newer timezone/revision refresh', async () => {
        let finish!: (value: PersonalToday) => void;
        mocks.get.mockReturnValueOnce(new Promise<PersonalToday>(resolve => { finish = resolve; }));
        await render('old');
        const data = fixture(); data.timezone = 'America/New_York'; mocks.get.mockResolvedValue(data);
        await render('new'); await act(async () => finish(fixture()));
        expect(container.textContent).toContain('America/New_York');
        expect(container.textContent).not.toContain('Europe/Amsterdam');
    });
    it('renders an empty state and recoverable load errors', async () => {
        mocks.get.mockRejectedValueOnce(new Error('Cannot load'));
        await render(); expect(container.textContent).toContain('Cannot load');
        mocks.get.mockResolvedValue({ ...fixture(), tasks: [], reminders: [], schedules: [], countdowns: [], session: null });
        await click('today.refresh'); expect(container.textContent).toContain(translate('today.empty'));
    });
});
