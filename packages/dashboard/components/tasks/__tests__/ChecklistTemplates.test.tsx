import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { formatDashboardMessage, type DashboardTranslator } from '@/lib/i18n/messages';

const mocks = vi.hoisted(() => ({ locale: 'en' as 'en' | 'nl', list: vi.fn(), create: vi.fn(), edit: vi.fn(), remove: vi.fn(), start: vi.fn(), settings: vi.fn() }));
vi.mock('@/lib/api/checklists', () => ({ checklistsApi: mocks }));
vi.mock('@/lib/api/userSettings', () => ({ userSettingsApi: { getUserSettings: mocks.settings } }));
vi.mock('@/components/i18n/DashboardI18nProvider', () => ({ useDashboardI18n: () => ({ t: translate }) }));
const translate: DashboardTranslator = (key, values) => formatDashboardMessage(mocks.locale, key, values);
import { ChecklistTemplatesPanel } from '../ChecklistTemplatesPanel';
import { ChecklistDialog } from '../ChecklistDialog';

const template = { id: 'packing', title: 'Packing', items: ['Passport', 'Charger'], version: 3 };
describe('reusable personal checklist UI', () => {
    let root: ReturnType<typeof createRoot>; let container: HTMLDivElement;
    beforeEach(() => {
        vi.clearAllMocks(); mocks.locale = 'en'; mocks.list.mockResolvedValue([template]); mocks.settings.mockResolvedValue({ timezone: 'Europe/Amsterdam' });
        mocks.create.mockResolvedValue(template); mocks.edit.mockResolvedValue({ ...template, version: 4 }); mocks.start.mockResolvedValue({ id: 'new-task' }); mocks.remove.mockResolvedValue({ removed: true });
        container = document.createElement('div'); document.body.append(container); root = createRoot(container);
    });
    afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
    async function click(label: string) {
        const scope = document.querySelector('[role="dialog"]') ?? document;
        const button = [...scope.querySelectorAll('button')].find(value => value.textContent === label);
        expect(button).toBeDefined(); await act(async () => button?.click());
    }
    async function input(element: HTMLInputElement | HTMLTextAreaElement, value: string) {
        await act(async () => {
            const prototype = element.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
            Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(element, value);
            element.dispatchEvent(new Event('input', { bubbles: true }));
        });
    }
    it.each(['en', 'nl'] as const)('creates and edits a list with localized copy in %s', async locale => {
        mocks.locale = locale; await act(async () => root.render(<ChecklistTemplatesPanel />));
        await click(translate('checklists.create'));
        await input(document.querySelector('[role="dialog"] input') as HTMLInputElement, 'Stream setup');
        await input(document.querySelector('[role="dialog"] textarea') as HTMLTextAreaElement, 'Mic\n\n Camera ');
        await click(translate('checklists.save'));
        expect(mocks.create).toHaveBeenCalledWith({ title: 'Stream setup', items: ['Mic', 'Camera'] });
        await click(translate('checklists.edit')); await click(translate('checklists.save'));
        expect(mocks.edit).toHaveBeenCalledWith(template.id, { title: template.title, items: template.items, version: 3 });
    });
    it('starts a fresh task with reviewed saved timezone/version and refreshes Today', async () => {
        const refresh = vi.fn(); window.addEventListener('personal-today-refresh', refresh);
        try {
            await act(async () => root.render(<ChecklistTemplatesPanel />)); await click(translate('checklists.start'));
            expect(document.body.textContent).toContain(translate('checklists.fresh'));
            await input(document.querySelector('[role="dialog"] input') as HTMLInputElement, '2027-01-12T09:30');
            await click(translate('checklists.start'));
            expect(mocks.start).toHaveBeenCalledWith(template.id, { version: 3, due: '2027-01-12T09:30', timezone: 'Europe/Amsterdam' });
            expect(refresh).toHaveBeenCalledOnce();
        } finally { window.removeEventListener('personal-today-refresh', refresh); }
    });
    it('validates item limits and keeps failures retryable', async () => {
        mocks.create.mockRejectedValueOnce(new Error('Storage unavailable'));
        await act(async () => root.render(<ChecklistDialog initial={{ title: 'Saved task', items: ['One'] }} onClose={vi.fn()} onSaved={vi.fn()} />));
        await click(translate('checklists.save')); expect(document.body.textContent).toContain('Storage unavailable');
        await input(document.querySelector('[role="dialog"] textarea') as HTMLTextAreaElement, Array(11).fill('Item').join('\n'));
        expect([...document.querySelectorAll('button')].find(button => button.textContent === translate('checklists.save'))?.disabled).toBe(true);
        expect(mocks.create).toHaveBeenCalledOnce();
    });
    it('pages all lists and confirms versioned removal without touching existing tasks', async () => {
        mocks.list.mockResolvedValue(Array.from({ length: 7 }, (_, index) => ({ ...template, id: `list-${index}`, title: `List ${index}` })));
        await act(async () => root.render(<ChecklistTemplatesPanel />));
        expect(document.body.textContent).not.toContain('List 6'); await click(translate('checklists.next'));
        expect(document.body.textContent).toContain('List 6'); await click(translate('checklists.remove'));
        expect(mocks.remove).not.toHaveBeenCalled(); expect(document.body.textContent).toContain(translate('checklists.removeHelp'));
        await click(translate('checklists.confirmRemove')); expect(mocks.remove).toHaveBeenCalledWith('list-5', 3);
    });
    it('blocks start when saved settings fail and surfaces refresh failure', async () => {
        mocks.settings.mockRejectedValueOnce(new Error('Settings unavailable'));
        await act(async () => root.render(<ChecklistDialog template={template} start onClose={vi.fn()} onSaved={vi.fn()} />));
        expect(document.body.textContent).toContain('Settings unavailable');
        expect([...document.querySelectorAll('button')].find(button => button.textContent === translate('checklists.start'))?.disabled).toBe(true);
        expect(mocks.start).not.toHaveBeenCalled();
        mocks.list.mockRejectedValueOnce(new Error('Lists unavailable'));
        await act(async () => root.render(<ChecklistTemplatesPanel />)); expect(document.body.textContent).toContain('Lists unavailable');
    });
});
