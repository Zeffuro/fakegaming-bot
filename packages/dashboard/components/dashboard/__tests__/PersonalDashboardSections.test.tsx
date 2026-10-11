import { StrictMode, act, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dashboardSectionIds, defaultDashboardSections, type DashboardSectionId } from '@zeffuro/fakegaming-common/dashboard-layout';
import { formatDashboardMessage, type DashboardTranslator } from '@/lib/i18n/messages';

const mocks = vi.hoisted(() => ({ locale: 'en' as 'en' | 'nl', get: vi.fn(), save: vi.fn(), reset: vi.fn(), mounts: vi.fn(), unmounts: vi.fn() }));
vi.mock('@/lib/api/dashboardLayout', () => ({ dashboardLayoutApi: mocks }));
vi.mock('@/components/i18n/DashboardI18nProvider', () => ({ useDashboardI18n: () => ({ t: translate }) }));
const translate: DashboardTranslator = (key, values) => formatDashboardMessage(mocks.locale, key, values);
import { PersonalDashboardSections } from '../PersonalDashboardSections';
const settings = () => ({ schemaVersion: 1 as const, version: 0, sections: defaultDashboardSections() });
function Panel({ id }: { id: DashboardSectionId }) {
    useEffect(() => { mocks.mounts(id); return () => mocks.unmounts(id); }, [id]);
    return <div data-panel={id}>{id}</div>;
}
const panels = Object.fromEntries(dashboardSectionIds.map(id => [id, <Panel key={id} id={id} />])) as Record<DashboardSectionId, React.ReactNode>;
describe('account dashboard panel layout', () => {
    let root: ReturnType<typeof createRoot>; let container: HTMLDivElement;
    beforeEach(() => {
        vi.clearAllMocks(); mocks.locale = 'en'; mocks.get.mockResolvedValue(settings());
        mocks.save.mockImplementation(async value => ({ ...value, version: value.version + 1 }));
        mocks.reset.mockImplementation(async version => ({ ...settings(), version: version + 1 }));
        container = document.createElement('div'); document.body.append(container); root = createRoot(container);
    });
    afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
    const button = (key: Parameters<DashboardTranslator>[0]) => [...container.querySelectorAll('button')].find(value => value.textContent === translate(key))!;
    async function click(key: Parameters<DashboardTranslator>[0]) { await act(async () => button(key).click()); }
    async function render() { await act(async () => root.render(<PersonalDashboardSections panels={panels} />)); }
    it.each(['en', 'nl'] as const)('reorders without remount, hides with unmount, saves and resets in %s', async locale => {
        mocks.locale = locale; await render(); await click('dashboardLayout.customize');
        const down = container.querySelector(`[aria-label="${translate('dashboardLayout.moveDown', { name: translate('dashboardLayout.sections.today') })}"]`) as HTMLButtonElement;
        await act(async () => down.click());
        expect([...container.querySelectorAll('[data-panel]')].slice(0, 2).map(value => value.getAttribute('data-panel'))).toEqual(['calendar', 'today']);
        expect(mocks.mounts).toHaveBeenCalledTimes(dashboardSectionIds.length);
        const checkbox = container.querySelector('input[type="checkbox"]') as HTMLInputElement;
        await act(async () => checkbox.click()); expect(container.querySelector('[data-panel="calendar"]')).toBeNull();
        expect(mocks.unmounts).toHaveBeenCalledWith('calendar'); expect(mocks.save).not.toHaveBeenCalled();
        await click('dashboardLayout.save'); expect(mocks.save.mock.calls[0][0].sections[0]).toEqual({ id: 'calendar', visible: false });
        expect(container.textContent).toContain(translate('dashboardLayout.saved'));
        await click('dashboardLayout.reset'); expect(mocks.reset).toHaveBeenCalledWith(1);
        expect(container.querySelector('[data-panel="calendar"]')).not.toBeNull();
        expect([...container.querySelectorAll('[data-panel]')][0].getAttribute('data-panel')).toBe('today');
    });
    it('keeps customize controls when all panels hidden and loads saved visibility', async () => {
        mocks.get.mockResolvedValue({ ...settings(), version: 4, sections: settings().sections.map(value => ({ ...value, visible: false })) });
        await render(); expect(container.querySelectorAll('[data-panel]')).toHaveLength(0);
        await click('dashboardLayout.customize'); await click('dashboardLayout.reset');
        expect(mocks.reset).toHaveBeenCalledWith(4); expect(container.querySelectorAll('[data-panel]')).toHaveLength(dashboardSectionIds.length);
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
        await act(async () => root.render(<StrictMode><PersonalDashboardSections panels={panels} /></StrictMode>));
        await click('dashboardLayout.customize'); expect(button('dashboardLayout.reset').disabled).toBe(false);
        await act(async () => root.unmount()); root = createRoot(container); mocks.get.mockRejectedValueOnce(new Error('Unavailable'));
        await render(); await click('dashboardLayout.customize'); expect(button('dashboardLayout.reset').disabled).toBe(true);
        expect(container.textContent).toContain('Unavailable'); await click('dashboardLayout.reload');
        expect(button('dashboardLayout.reset').disabled).toBe(false);
    });
});
