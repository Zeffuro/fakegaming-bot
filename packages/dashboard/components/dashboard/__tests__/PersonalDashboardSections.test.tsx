import { StrictMode, act, useEffect, useState, type ComponentProps } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dashboardSectionIds, defaultDashboardSections, type DashboardSectionId } from '@zeffuro/fakegaming-common/dashboard-layout';
import { formatDashboardMessage, type DashboardTranslator } from '@/lib/i18n/messages';

const mocks = vi.hoisted(() => ({ locale: 'en' as 'en' | 'nl', get: vi.fn(), save: vi.fn(), reset: vi.fn(), mounts: vi.fn(), unmounts: vi.fn(), createEditor: vi.fn() }));
vi.mock('@/lib/api/dashboardLayout', () => ({ dashboardLayoutApi: mocks }));
vi.mock('@/components/i18n/DashboardI18nProvider', () => ({ useDashboardI18n: () => ({ t: translate }) }));
const translate: DashboardTranslator = (key, values) => formatDashboardMessage(mocks.locale, key, values);
import { PersonalDashboardSections } from '../PersonalDashboardSections';
import { personalDashboardView, personalViewSections } from '../personalDashboardViews';
const settings = () => ({ schemaVersion: 1 as const, version: 0, sections: defaultDashboardSections() });
function Panel({ id }: { id: DashboardSectionId }) {
    useEffect(() => { mocks.mounts(id); return () => mocks.unmounts(id); }, [id]);
    return <div data-panel={id}>{id}<input aria-label={`${id} draft`} defaultValue="" /></div>;
}
const panels = Object.fromEntries(dashboardSectionIds.map(id => [id, <Panel key={id} id={id} />])) as Record<DashboardSectionId, React.ReactNode>;
function Harness(props: Pick<ComponentProps<typeof PersonalDashboardSections>, 'editorRequest' | 'editorErrors'>) {
    const [editorRequest, setEditorRequest] = useState(props.editorRequest ?? null);
    return <PersonalDashboardSections panels={panels} editorRequest={editorRequest} editorErrors={props.editorErrors}
        onCreateEditor={id => { mocks.createEditor(id); setEditorRequest({ id }); }} onCloseEditor={() => setEditorRequest(null)} />;
}
describe('account dashboard panel layout', () => {
    let root: ReturnType<typeof createRoot>; let container: HTMLDivElement;
    beforeEach(() => {
        window.history.replaceState(null, '', '/dashboard/me');
        vi.clearAllMocks(); mocks.locale = 'en'; mocks.get.mockResolvedValue(settings());
        mocks.save.mockImplementation(async value => ({ ...value, version: value.version + 1 }));
        mocks.reset.mockImplementation(async version => ({ ...settings(), version: version + 1 }));
        container = document.createElement('div'); document.body.append(container); root = createRoot(container);
    });
    afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
    const button = (key: Parameters<DashboardTranslator>[0]) => [...container.querySelectorAll('button')].find(value => value.textContent === translate(key))!;
    async function click(key: Parameters<DashboardTranslator>[0]) { await act(async () => button(key).click()); }
    async function view(key: keyof typeof personalViewSections | 'all') { await click(`dashboardLayout.views.${key}`); }
    async function render() { await act(async () => root.render(<Harness />)); await view('all'); }
    it.each(['en', 'nl'] as const)('reorders without remount, hides with unmount, saves and resets in %s', async locale => {
        mocks.locale = locale; await render(); await click('dashboardLayout.customize');
        const down = container.querySelector(`[aria-label="${translate('dashboardLayout.moveDown', { name: translate('dashboardLayout.sections.today') })}"]`) as HTMLButtonElement;
        await act(async () => down.click());
        expect([...container.querySelectorAll('[data-panel]')].slice(0, 2).map(value => value.getAttribute('data-panel'))).toEqual(['subscriptions', 'today']);
        expect(mocks.mounts).toHaveBeenCalledTimes(dashboardSectionIds.length - 2);
        const checkbox = container.querySelector('input[type="checkbox"]') as HTMLInputElement;
        await act(async () => checkbox.click()); expect(container.querySelector('[data-panel="subscriptions"]')).toBeNull();
        expect(mocks.unmounts).toHaveBeenCalledWith('subscriptions'); expect(mocks.save).not.toHaveBeenCalled();
        await click('dashboardLayout.save'); expect(mocks.save.mock.calls[0][0].sections[0]).toEqual({ id: 'subscriptions', visible: false });
        expect(container.textContent).toContain(translate('dashboardLayout.saved'));
        await click('dashboardLayout.reset'); expect(mocks.reset).toHaveBeenCalledWith(1);
        expect(container.querySelector('[data-panel="calendar"]')).not.toBeNull();
        expect([...container.querySelectorAll('[data-panel]')][0].getAttribute('data-panel')).toBe('today');
    });
    it('keeps customize controls when all panels hidden and loads saved visibility', async () => {
        mocks.get.mockResolvedValue({ ...settings(), version: 4, sections: settings().sections.map(value => ({ ...value, visible: false })) });
        await render(); expect(container.querySelectorAll('[data-panel]')).toHaveLength(0);
        await click('dashboardLayout.customize'); await click('dashboardLayout.reset');
        expect(mocks.reset).toHaveBeenCalledWith(4); expect(container.querySelectorAll('[data-panel]')).toHaveLength(dashboardSectionIds.length - 2);
    });
    it('retains unsaved changes on conflict, reloads and blocks duplicate writes', async () => {
        await render(); await click('dashboardLayout.customize');
        await act(async () => (container.querySelector('input[type="checkbox"]') as HTMLInputElement).click());
        mocks.save.mockRejectedValueOnce(new Error('Changed elsewhere')); await click('dashboardLayout.save');
        expect(container.textContent).toContain('Changed elsewhere'); expect(container.querySelector('[data-panel="today"]')).toBeNull();
        mocks.get.mockResolvedValue({ ...settings(), version: 7 }); await click('dashboardLayout.reload');
        expect(container.querySelector('[data-panel="today"]')).not.toBeNull();
        let resolve: (value: ReturnType<typeof settings>) => void = () => undefined;
        mocks.reset.mockReturnValue(new Promise(value => { resolve = value; })); await click('dashboardLayout.reset');
        expect(button('dashboardLayout.reset').disabled).toBe(true); await click('dashboardLayout.reset');
        expect(mocks.reset).toHaveBeenCalledTimes(1); await act(async () => resolve(settings()));
    });
    it('supports Strict Mode initialization and retries failed initial load', async () => {
        await act(async () => root.render(<StrictMode><Harness /></StrictMode>));
        await click('dashboardLayout.customize'); expect(button('dashboardLayout.reset').disabled).toBe(false);
        await act(async () => root.unmount()); root = createRoot(container); mocks.get.mockRejectedValueOnce(new Error('Unavailable'));
        await render(); await click('dashboardLayout.customize'); expect(button('dashboardLayout.reset').disabled).toBe(true);
        expect(container.textContent).toContain('Unavailable'); await click('dashboardLayout.reload');
        expect(button('dashboardLayout.reset').disabled).toBe(false);
    });
    it.each(['en', 'nl'] as const)('defaults to two overview panels and lazily retains view drafts in %s', async locale => {
        mocks.locale = locale;
        await act(async () => root.render(<Harness />));
        expect([...container.querySelectorAll('[data-panel]')].map(value => value.getAttribute('data-panel'))).toEqual(['today', 'subscriptions']);
        expect(container.querySelector('[data-panel="calendar"]')).toBeNull();
        await view('workspace');
        const draft = container.querySelector('[aria-label="notes draft"]') as HTMLInputElement;
        draft.value = 'Keep my draft';
        await view('notifications'); await view('workspace');
        expect(container.querySelector('[aria-label="notes draft"]')).toBe(draft);
        expect(draft.value).toBe('Keep my draft'); expect(mocks.unmounts).not.toHaveBeenCalled();
        expect(container.querySelector('[data-panel="noteEditor"]')).toBeNull();
        expect(window.location.search).toBe('?view=workspace'); expect(mocks.save).not.toHaveBeenCalled();
    });
    it('supports direct links, browser navigation and Calendar OAuth returns without mounting unrelated views', async () => {
        window.history.replaceState(null, '', '/dashboard/me?googleCalendar=success');
        await act(async () => root.render(<Harness />));
        expect([...container.querySelectorAll('[data-panel]')].map(value => value.getAttribute('data-panel'))).toEqual(['calendar']);
        expect(personalDashboardView('?view=invalid')).toBe('overview');
        expect(personalDashboardView('?view=account&googleCalendar=success')).toBe('account');
        await act(async () => { window.history.replaceState(null, '', '/dashboard/me?view=account'); window.dispatchEvent(new PopStateEvent('popstate')); });
        expect(container.querySelector('[aria-selected="true"]')?.textContent).toBe(translate('dashboardLayout.views.account'));
        expect(container.querySelector('[data-personal-section="calendar"]')?.hasAttribute('hidden')).toBe(true);
        expect(container.querySelector('[data-panel="notes"]')).toBeNull();
        expect(Object.values(personalViewSections).flat().sort()).toEqual([...dashboardSectionIds].sort());
    });
    it('opens an explicitly requested hidden editor without changing saved visibility, and shows errors in its dialog', async () => {
        mocks.get.mockResolvedValue({ ...settings(), sections: settings().sections.map(section => ({ ...section, visible: false })) });
        await act(async () => root.render(<Harness editorRequest={{ id: 'noteEditor' }} editorErrors={{ noteEditor: 'Save failed' }} />));
        expect(document.querySelector('[role="dialog"]')?.textContent).toContain('Save failed');
        expect(document.querySelector('[role="dialog"] [data-panel="noteEditor"]')).not.toBeNull();
        expect(container.querySelectorAll('[data-panel]')).toHaveLength(0); expect(mocks.save).not.toHaveBeenCalled();
        await act(async () => (document.querySelector('[aria-label="Close"]') as HTMLButtonElement).click());
        expect(document.querySelector('[role="dialog"] [data-panel="noteEditor"]')).toBeNull();
    });
    it('does not mount default panels when the initial saved layout is unavailable', async () => {
        mocks.get.mockRejectedValueOnce(new Error('Unavailable'));
        await act(async () => root.render(<Harness />));
        expect(mocks.mounts).not.toHaveBeenCalled(); expect(container.textContent).toContain('Unavailable');
        await click('dashboardLayout.reload'); expect(mocks.mounts).toHaveBeenCalledTimes(2);
    });
    it('routes both internal Create shortcuts through the parent and closes the controlled editor there', async () => {
        await render(); await view('workspace'); await click('personal.newNote');
        expect(mocks.createEditor).toHaveBeenLastCalledWith('noteEditor');
        expect(document.querySelector('[role="dialog"] [data-panel="noteEditor"]')).not.toBeNull();
        await act(async () => (document.querySelector('[aria-label="Close"]') as HTMLButtonElement).click());
        expect(document.querySelector('[role="dialog"] [data-panel="noteEditor"]')).toBeNull();
        await view('notifications'); await click('personal.createReminder');
        expect(mocks.createEditor).toHaveBeenLastCalledWith('reminderEditor');
        expect(document.querySelector('[role="dialog"] [data-panel="reminderEditor"]')).not.toBeNull();
    });
});
