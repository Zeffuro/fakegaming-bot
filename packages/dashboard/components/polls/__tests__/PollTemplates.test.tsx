import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { formatDashboardMessage, type DashboardTranslator } from '@/lib/i18n/messages';

const mocks = vi.hoisted(() => ({ locale: 'en' as 'en' | 'nl', list: vi.fn(), create: vi.fn(), edit: vi.fn(), remove: vi.fn() }));
vi.mock('@/lib/api/pollTemplates', () => ({ pollTemplatesApi: mocks }));
vi.mock('@/components/i18n/DashboardI18nProvider', () => ({ useDashboardI18n: () => ({ t: translate }) }));
const translate: DashboardTranslator = (key, values) => formatDashboardMessage(mocks.locale, key, values);
import { PollTemplatesPanel } from '../PollTemplatesPanel';
import { PollTemplateDialog } from '../PollTemplateDialog';

const template = { id: 'dinner', title: 'Dinner', question: 'Food?', options: ['Pizza', 'Pasta'], durationMinutes: 10, allowMultiple: false, hideResults: false, ranked: false, version: 3 };
describe('private reusable poll UI', () => {
    let root: ReturnType<typeof createRoot>; let container: HTMLDivElement;
    beforeEach(() => {
        vi.clearAllMocks(); mocks.locale = 'en'; mocks.list.mockResolvedValue([template]); mocks.create.mockResolvedValue(template);
        mocks.edit.mockResolvedValue({ ...template, version: 4 }); mocks.remove.mockResolvedValue({ removed: true });
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
    it.each(['en', 'nl'] as const)('creates a template with hidden results off and edits versioned independent settings in %s', async locale => {
        mocks.locale = locale; await act(async () => root.render(<PollTemplatesPanel />));
        expect(document.body.textContent).toContain('/polls start template:dinner');
        await click(translate('pollTemplates.create'));
        const fields = document.querySelectorAll('[role="dialog"] input');
        await input(fields[0] as HTMLInputElement, ' Weekend '); await input(fields[1] as HTMLInputElement, ' Which day? ');
        await input(document.querySelector('[role="dialog"] textarea') as HTMLTextAreaElement, ' Saturday \n\nSunday');
        expect([...document.querySelectorAll('[role="dialog"] input[type="checkbox"]')].every(value => !(value as HTMLInputElement).checked)).toBe(true);
        await click(translate('pollTemplates.save'));
        expect(mocks.create).toHaveBeenCalledWith({ title: 'Weekend', question: 'Which day?', options: ['Saturday', 'Sunday'], durationMinutes: 10, allowMultiple: false, hideResults: false, ranked: false });
        await click(translate('pollTemplates.edit')); await click(translate('pollTemplates.save'));
        const { id, ...content } = template;
        expect(mocks.edit).toHaveBeenCalledWith(id, content);
    });
    it('rejects duplicate options and invalid duration and keeps storage failures retryable', async () => {
        mocks.edit.mockRejectedValueOnce(new Error('Storage unavailable'));
        await act(async () => root.render(<PollTemplateDialog template={template} onClose={vi.fn()} onSaved={vi.fn()} />));
        await click(translate('pollTemplates.save')); expect(document.body.textContent).toContain('Storage unavailable');
        await input(document.querySelector('[role="dialog"] textarea') as HTMLTextAreaElement, 'A\nａ');
        const button = () => [...document.querySelectorAll('button')].find(value => value.textContent === translate('pollTemplates.save'));
        expect(button()?.disabled).toBe(true);
        await input(document.querySelector('[role="dialog"] textarea') as HTMLTextAreaElement, 'A\nB');
        await input(document.querySelector('[role="dialog"] input[type="number"]') as HTMLInputElement, '1441');
        expect(button()?.disabled).toBe(true); expect(mocks.edit).toHaveBeenCalledOnce();
    });
    it.each(['en', 'nl'] as const)('clears and disables multiple choice while ranking and preserves edit selection in %s', async locale => {
        mocks.locale = locale;
        await act(async () => root.render(<PollTemplateDialog template={{ ...template, allowMultiple: true }} onClose={vi.fn()} onSaved={vi.fn()} />));
        const boxes = () => [...document.querySelectorAll('[role="dialog"] input[type="checkbox"]')] as HTMLInputElement[];
        expect(boxes()[1]!.checked).toBe(true);
        await act(async () => boxes()[0]!.click());
        expect(boxes()[1]!.checked).toBe(false); expect(boxes()[1]!.disabled).toBe(true);
        await click(translate('pollTemplates.save'));
        expect(mocks.edit).toHaveBeenCalledWith(template.id, expect.objectContaining({ ranked: true, allowMultiple: false }));
        await act(async () => root.render(<PollTemplateDialog key="ranked" template={{ ...template, ranked: true }} onClose={vi.fn()} onSaved={vi.fn()} />));
        expect(boxes()[0]!.checked).toBe(true); expect(boxes()[1]!.disabled).toBe(true);
    });
    it('pages all templates and requires confirmation for owner versioned deletion', async () => {
        mocks.list.mockResolvedValue(Array.from({ length: 7 }, (_, index) => ({ ...template, id: `saved-${index}`, title: `Saved ${index}` })));
        await act(async () => root.render(<PollTemplatesPanel />));
        expect(document.body.textContent).not.toContain('Saved 6'); await click(translate('pollTemplates.next'));
        expect(document.body.textContent).toContain('Saved 6'); await click(translate('pollTemplates.remove'));
        expect(mocks.remove).not.toHaveBeenCalled(); await click(translate('pollTemplates.confirmRemove'));
        expect(mocks.remove).toHaveBeenCalledWith('saved-5', 3);
    });
    it('surfaces failed private retrieval', async () => {
        mocks.list.mockRejectedValueOnce(new Error('Saved polls unavailable'));
        await act(async () => root.render(<PollTemplatesPanel />)); expect(document.body.textContent).toContain('Saved polls unavailable');
    });
});
