import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { formatDashboardMessage, type DashboardTranslator } from '@/lib/i18n/messages';

const mocks = vi.hoisted(() => ({ locale: 'en' as 'en' | 'nl', get: vi.fn(), save: vi.fn(), preview: vi.fn() }));
vi.mock('@/lib/api/morningBriefings', () => ({ morningBriefingsApi: mocks }));
vi.mock('@/components/i18n/DashboardI18nProvider', () => ({ useDashboardI18n: () => ({ t: translate }) }));
const translate: DashboardTranslator = (key, values) => formatDashboardMessage(mocks.locale, key, values);
import { MorningBriefingPanel } from '../MorningBriefingPanel';

const settings = { enabled: false, localTime: '09:00', timezone: 'Europe/Amsterdam', version: 0 };
const preview = { day: '2026-10-10', timezone: 'Europe/Amsterdam', content: 'Private preview', empty: false, total: 10, included: 8, omitted: 2 };

describe('private briefing settings panel', () => {
    let root: ReturnType<typeof createRoot>; let container: HTMLDivElement;
    beforeEach(() => {
        vi.clearAllMocks(); mocks.locale = 'en'; mocks.get.mockResolvedValue(settings); mocks.preview.mockResolvedValue(preview);
        mocks.save.mockImplementation(async value => ({ ...value, version: value.version + 1 }));
        container = document.createElement('div'); document.body.append(container); root = createRoot(container);
    });
    afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
    const button = (key: Parameters<DashboardTranslator>[0]) => [...container.querySelectorAll('button')].find(value => value.textContent === translate(key))!;
    async function click(key: Parameters<DashboardTranslator>[0]) { await act(async () => button(key).click()); }
    it.each(['en', 'nl'] as const)('puts briefing guidance in collapsed Help while keeping delivery controls in %s', async locale => {
        mocks.locale = locale; await act(async () => root.render(<MorningBriefingPanel />));
        const help = container.querySelector('details')!;
        expect(help.open).toBe(false);
        expect(help.querySelector('summary')?.textContent).toBe(translate('briefing.help'));
        expect(help.textContent).toContain(translate('briefing.description'));
        expect(help.textContent).toContain(translate('briefing.timing'));
        expect(help.textContent).toContain(translate('briefing.previewHelp'));
        expect(container.querySelector('input[type="time"]')?.closest('details')).toBeNull();
        expect(button('briefing.preview').closest('details')).toBeNull();
        expect(mocks.save).not.toHaveBeenCalled();
    });
    it.each(['en', 'nl'] as const)('shows off by default and saves explicit opt-in in %s', async locale => {
        mocks.locale = locale; await act(async () => root.render(<MorningBriefingPanel />));
        const checkbox = container.querySelector('input[type="checkbox"]') as HTMLInputElement;
        expect(checkbox.checked).toBe(false); expect(container.textContent).toContain('Europe/Amsterdam');
        expect(mocks.save).not.toHaveBeenCalled(); await act(async () => checkbox.click()); await click('briefing.save');
        expect(mocks.save).toHaveBeenCalledWith({ ...settings, enabled: true }); expect(container.textContent).toContain(translate('briefing.saved'));
    });
    it('previews exact bounded content and counts without saving or sending', async () => {
        await act(async () => root.render(<MorningBriefingPanel />)); await click('briefing.preview');
        expect(container.textContent).toContain('Private preview');
        expect(container.textContent).toContain(translate('briefing.previewCount', { included: 8, total: 10, omitted: 2 }));
        expect(mocks.save).not.toHaveBeenCalled();
    });
    it('keeps errors retryable and refreshes authoritative settings after stale writes', async () => {
        mocks.save.mockRejectedValueOnce(new Error('Timezone changed'));
        await act(async () => root.render(<MorningBriefingPanel />)); await click('briefing.save');
        expect(container.textContent).toContain('Timezone changed');
        mocks.get.mockResolvedValue({ ...settings, timezone: 'UTC' }); await click('briefing.refresh'); await click('briefing.save');
        expect(mocks.save).toHaveBeenLastCalledWith({ ...settings, timezone: 'UTC' });
    });
    it('blocks duplicate saves while pending and ignores previews from an old timezone', async () => {
        let resolve: (value: typeof preview) => void = () => undefined;
        mocks.preview.mockReturnValue(new Promise(value => { resolve = value; }));
        await act(async () => root.render(<MorningBriefingPanel revision="Europe/Amsterdam" />)); await click('briefing.preview');
        expect(button('briefing.save').disabled).toBe(true);
        mocks.get.mockResolvedValue({ ...settings, timezone: 'UTC' });
        await act(async () => root.render(<MorningBriefingPanel revision="UTC" />));
        await act(async () => resolve(preview));
        expect(container.textContent).toContain('UTC'); expect(container.textContent).not.toContain('Private preview');
    });
});
