import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { formatDashboardMessage, type DashboardTranslator } from '@/lib/i18n/messages';
import type { UserNote } from '@/lib/api/userNotes';

const mocks = vi.hoisted(() => ({ locale: 'en' as 'en' | 'nl', create: vi.fn(), settings: vi.fn() }));
vi.mock('@/lib/api/noteTasks', () => ({ noteTasksApi: { createTaskFromNote: mocks.create } }));
vi.mock('@/lib/api/userSettings', () => ({ userSettingsApi: { getUserSettings: mocks.settings } }));
vi.mock('@/components/i18n/DashboardI18nProvider', () => ({ useDashboardI18n: () => ({ t: translate, formatDate: (at: number) => String(at), formatNumber: (value: number) => String(value) }) }));
const translate: DashboardTranslator = (key, values) => formatDashboardMessage(mocks.locale, key, values);
import { NoteTaskDialog } from '../NoteTaskDialog';
import { NoteInboxPanel } from '../NoteInboxPanel';

const note: UserNote = { id: 'saved-note', discordId: 'owner', title: 'Saved request', body: 'Original text', pinned: false, createdAt: null, updatedAt: null };
const result = { created: true, task: { id: 'linked-task', title: 'Send configuration', state: 'active', dueAt: null,
    timezone: 'Europe/Amsterdam', sourceNoteId: note.id, sourceUrl: 'https://discord.com/channels/1/2/3' } };

describe('saved note task dialog', () => {
    let root: ReturnType<typeof createRoot>;
    let container: HTMLDivElement;
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.locale = 'en';
        mocks.settings.mockResolvedValue({ timezone: 'Europe/Amsterdam' });
        mocks.create.mockResolvedValue(result);
        container = document.createElement('div'); document.body.append(container); root = createRoot(container);
    });
    afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
    async function click(label: string) {
        const button = [...document.querySelectorAll('button')].find(value => value.textContent === label);
        expect(button).toBeDefined();
        await act(async () => button?.click());
    }
    async function setInput(input: HTMLInputElement, value: string) {
        await act(async () => {
            Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
            input.dispatchEvent(new Event('input', { bubbles: true }));
        });
    }

    it.each(['en', 'nl'] as const)('opens from the inbox and converts with editable exact time in %s', async locale => {
        mocks.locale = locale;
        await act(async () => root.render(<NoteInboxPanel notes={[note]} saving={false} onTogglePinned={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()} onUpdate={vi.fn()} />));
        await click(translate('notesTask.create'));
        expect(document.body.textContent).toContain(translate('notesTask.timezone', { timezone: 'Europe/Amsterdam' }));
        const inputs = document.querySelectorAll('[role="dialog"] input');
        expect((inputs[0] as HTMLInputElement).value).toBe(note.title);
        await setInput(inputs[0] as HTMLInputElement, 'Send configuration');
        await setInput(inputs[1] as HTMLInputElement, '2026-10-23T12:30');
        const refresh = vi.fn(); window.addEventListener('personal-today-refresh', refresh);
        try {
            await click(translate('notesTask.submit'));
            expect(mocks.create).toHaveBeenCalledWith(note.id, { title: 'Send configuration', due: '2026-10-23T12:30', timezone: 'Europe/Amsterdam' });
            expect(document.body.textContent).toContain(translate('notesTask.success'));
            expect(document.body.textContent).toContain(translate('notesTask.taskId', { id: result.task.id }));
            expect(refresh).toHaveBeenCalledOnce();
        } finally { window.removeEventListener('personal-today-refresh', refresh); }
        await click(translate('notesTask.cancel'));
        await click(translate('notesTask.create'));
        expect(document.body.textContent).toContain(translate('notesTask.existing'));
    });

    it('opens the retained completed task and does not let the form replace its original values', async () => {
        mocks.create.mockResolvedValue({ ...result, created: false, task: { ...result.task, state: 'completed' } });
        const linked = vi.fn();
        await act(async () => root.render(<NoteTaskDialog note={{ ...note, linkedTaskId: result.task.id }} onClose={vi.fn()} onLinked={linked} />));
        expect([...document.querySelectorAll('[role="dialog"] input')].every(input => (input as HTMLInputElement).disabled)).toBe(true);
        await click(translate('notesTask.open'));
        expect(document.body.textContent).toContain(translate('notesTask.reused'));
        expect(document.body.textContent).toContain(translate('notesTask.completed'));
        expect(linked).toHaveBeenCalledWith(result.task.id);
    });

    it('blocks saving while timezone is unavailable and surfaces failures without closing the dialog', async () => {
        mocks.settings.mockRejectedValue(new Error('Settings unavailable'));
        await act(async () => root.render(<NoteTaskDialog note={note} onClose={vi.fn()} />));
        expect(document.body.textContent).toContain('Settings unavailable');
        const save = [...document.querySelectorAll('button')].find(button => button.textContent === translate('notesTask.submit'));
        expect(save?.disabled).toBe(true);
        expect(mocks.create).not.toHaveBeenCalled();
    });

    it('keeps a rejected conversion retryable and prevents an empty title submission', async () => {
        mocks.create.mockRejectedValueOnce(new Error('Linked task deleted'));
        await act(async () => root.render(<NoteTaskDialog note={note} onClose={vi.fn()} />));
        await click(translate('notesTask.submit'));
        expect(document.body.textContent).toContain('Linked task deleted');
        const title = document.querySelector('[role="dialog"] input') as HTMLInputElement;
        await setInput(title, '  ');
        const save = [...document.querySelectorAll('button')].find(button => button.textContent === translate('notesTask.submit'));
        expect(save?.disabled).toBe(true);
        expect(mocks.create).toHaveBeenCalledOnce();
    });
});
