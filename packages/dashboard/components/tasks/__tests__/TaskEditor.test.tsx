import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { formatDashboardMessage, type DashboardTranslator } from '@/lib/i18n/messages';
import type { EditableTask } from '@/lib/api/userTasks';

const mocks = vi.hoisted(() => ({ locale: 'en' as 'en' | 'nl', edit: vi.fn(), settings: vi.fn(), list: vi.fn(), createTemplate: vi.fn(), undo: vi.fn() }));
vi.mock('@/lib/api/personalToday', () => ({ personalTodayApi: { task: mocks.undo } }));
vi.mock('@/lib/api/checklists', () => ({ checklistsApi: { create: mocks.createTemplate } }));
vi.mock('@/lib/api/userTasks', () => ({ userTasksApi: { edit: mocks.edit, list: mocks.list } }));
vi.mock('@/lib/api/userSettings', () => ({ userSettingsApi: { getUserSettings: mocks.settings } }));
vi.mock('@/components/i18n/DashboardI18nProvider', () => ({ useDashboardI18n: () => ({ t: translate, formatDate: (at: number) => String(at) }) }));
const translate: DashboardTranslator = (key, values) => formatDashboardMessage(mocks.locale, key, values);
import { TaskEditorDialog } from '../TaskEditorDialog';
import { TasksPanel } from '../TasksPanel';

const task: EditableTask = { id: 'task', title: 'Overdue task', state: 'active', dueAt: Date.parse('2026-10-08T10:30:00Z'),
    canUndo: false, timezone: 'Europe/Amsterdam', version: 4, completedAt: null, sourceUrl: null, checklist: [{ text: 'Checked', done: true }, { text: 'Pending', done: false }] };

describe('task editor and full task panel', () => {
    let root: ReturnType<typeof createRoot>;
    let container: HTMLDivElement;
    beforeEach(() => {
        vi.clearAllMocks(); mocks.locale = 'en';
        mocks.settings.mockResolvedValue({ timezone: 'Europe/Amsterdam' }); mocks.edit.mockResolvedValue({ ...task, version: 5 });
        mocks.list.mockResolvedValue({ active: [task], completed: [], timezone: 'Europe/Amsterdam' });
        mocks.createTemplate.mockResolvedValue({ id: 'template' });
        container = document.createElement('div'); document.body.append(container); root = createRoot(container);
    });
    afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
    async function click(label: string) {
        const button = [...document.querySelectorAll('button')].find(item => item.textContent === label);
        expect(button).toBeDefined(); await act(async () => button?.click());
    }
    async function setInput(input: HTMLInputElement, value: string) {
        await act(async () => {
            Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
            input.dispatchEvent(new Event('input', { bubbles: true }));
        });
    }

    it.each(['en', 'nl'] as const)('preserves the unchanged overdue date and checked states while editing in %s', async locale => {
        mocks.locale = locale;
        const close = vi.fn(); const refresh = vi.fn(); window.addEventListener('personal-today-refresh', refresh);
        try {
            await act(async () => root.render(<TaskEditorDialog task={task} onClose={close} />));
            const fields = document.querySelectorAll('[role="dialog"] input');
            expect((fields[1] as HTMLInputElement).value).toBe('2026-10-08T12:30');
            expect((fields[2] as HTMLInputElement).checked).toBe(true);
            await setInput(fields[0] as HTMLInputElement, 'Changed title');
            await click(translate('taskEditor.save'));
            expect(mocks.edit).toHaveBeenCalledWith(task.id, { version: 4, title: 'Changed title', checklist: task.checklist, timezone: 'Europe/Amsterdam' });
            expect(refresh).toHaveBeenCalledOnce(); expect(close).toHaveBeenCalledOnce();
        } finally { window.removeEventListener('personal-today-refresh', refresh); }
    });

    it('sends null to clear a due date, allows checklist removal/addition and keeps failures retryable', async () => {
        mocks.edit.mockRejectedValueOnce(new Error('Task changed'));
        const close = vi.fn();
        await act(async () => root.render(<TaskEditorDialog task={task} onClose={close} />));
        await setInput(document.querySelector('input[type="datetime-local"]') as HTMLInputElement, '');
        await act(async () => (document.querySelector(`[aria-label="${translate('taskEditor.removeItem', { index: 2 })}"]`) as HTMLButtonElement).click());
        await click(translate('taskEditor.addItem'));
        const textInputs = document.querySelectorAll('[role="dialog"] input[type="text"]');
        await setInput(textInputs[textInputs.length - 1] as HTMLInputElement, 'New item');
        await click(translate('taskEditor.save'));
        expect(mocks.edit).toHaveBeenCalledWith(task.id, { version: 4, title: task.title, checklist: [{ text: 'Checked', done: true }, { text: 'New item', done: false }], timezone: 'Europe/Amsterdam', due: null });
        expect(document.body.textContent).toContain('Task changed'); expect(close).not.toHaveBeenCalled();
        await click(translate('taskEditor.save')); expect(close).toHaveBeenCalledOnce();
    });

    it('blocks saving without saved settings and caps checklist entries', async () => {
        mocks.settings.mockRejectedValue(new Error('Settings unavailable'));
        await act(async () => root.render(<TaskEditorDialog task={{ ...task, checklist: Array(10).fill({ text: 'Item', done: false }) }} onClose={vi.fn()} />));
        const buttons = [...document.querySelectorAll('button')];
        expect(buttons.find(item => item.textContent === translate('taskEditor.save'))?.disabled).toBe(true);
        expect(buttons.find(item => item.textContent === translate('taskEditor.addItem'))?.disabled).toBe(true);
        expect(document.body.textContent).toContain('Settings unavailable');
    });

    it('pages all future tasks and completed history, exposes editing only for active records and reloads on refresh', async () => {
        mocks.list.mockResolvedValue({ active: Array.from({ length: 11 }, (_, i) => ({ ...task, id: `active-${i}`, title: `Future ${i}`, dueAt: Date.parse('2027-01-01T12:00:00Z') })),
            completed: [{ ...task, id: 'finished', title: 'Finished', state: 'completed' }], timezone: 'Europe/Amsterdam' });
        await act(async () => root.render(<TasksPanel />));
        expect(document.body.textContent).toContain('Future 0'); expect(document.body.textContent).not.toContain('Future 10');
        expect(document.body.textContent).toContain('Finished');
        expect([...document.querySelectorAll('button')].filter(item => item.textContent === translate('taskEditor.edit'))).toHaveLength(10);
        await click(translate('taskEditor.next')); expect(document.body.textContent).toContain('Future 10');
        await click(translate('taskEditor.edit')); expect(document.querySelector('[role="dialog"]')).not.toBeNull();
        await click(translate('taskEditor.cancel'));
        await act(async () => window.dispatchEvent(new Event('personal-today-refresh')));
        expect(mocks.list).toHaveBeenCalledTimes(2);
    });

    it('offers undo for completed and recurring tasks, scopes the version, blocks double submission and reloads', async () => {
        mocks.list.mockResolvedValue({ active: [], completed: [{ ...task, state: 'completed', canUndo: true }], timezone: task.timezone });
        let finish!: () => void;
        mocks.undo.mockReturnValueOnce(new Promise<void>(resolve => { finish = resolve; }));
        await act(async () => root.render(<TasksPanel />));
        await click(translate('taskEditor.undo'));
        await click(translate('taskEditor.undo'));
        expect(mocks.undo).toHaveBeenCalledOnce(); expect(mocks.undo).toHaveBeenCalledWith('task', { action: 'undo', version: 4 });
        expect([...container.querySelectorAll('button')].find(item => item.textContent === translate('taskEditor.undo'))?.disabled).toBe(true);
        mocks.list.mockResolvedValue({ active: [{ ...task, canUndo: false }], completed: [], timezone: task.timezone });
        await act(async () => finish());
        expect(mocks.list).toHaveBeenCalledTimes(2);
        expect(container.textContent).not.toContain(translate('taskEditor.undo'));
    });
    it('copies task checklist text into a reusable list without carrying completion states', async () => {
        const refresh = vi.fn(); window.addEventListener('personal-checklists-refresh', refresh);
        try {
            await act(async () => root.render(<TasksPanel />));
            await click(translate('checklists.saveTask'));
            const textarea = document.querySelector('[role="dialog"] textarea') as HTMLTextAreaElement;
            expect(textarea.value).toBe('Checked\nPending');
            await click(translate('checklists.save'));
            expect(mocks.createTemplate).toHaveBeenCalledWith({ title: task.title, items: ['Checked', 'Pending'] });
            expect(refresh).toHaveBeenCalledOnce();
        } finally { window.removeEventListener('personal-checklists-refresh', refresh); }
    });
});
