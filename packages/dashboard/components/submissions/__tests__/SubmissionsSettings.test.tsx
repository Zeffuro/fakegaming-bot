import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { formatDashboardMessage, type DashboardTranslator } from '@/lib/i18n/messages';

const mocks = vi.hoisted(() => ({ locale: 'en' as 'en' | 'nl', list: vi.fn(), options: vi.fn(), create: vi.fn(), update: vi.fn() }));
vi.mock('@/lib/api/submissions', () => ({ submissionsApi: mocks }));
vi.mock('@/components/i18n/DashboardI18nProvider', () => ({ useDashboardI18n: () => ({ t: translate }) }));
const translate: DashboardTranslator = (key, values) => formatDashboardMessage(mocks.locale, key, values);
import { SubmissionsSettings } from '../SubmissionsSettings';
import { SubmissionCategoryDialog } from '../SubmissionCategoryDialog';

const category = { id: 'art', guildId: '1', name: 'Art', destinationChannelId: '10', reviewChannelId: '20', reviewerRoleIds: ['30'], submitterRoleIds: ['40'], enabled: true, version: 3 };
const options = { channels: [{ id: '10', name: 'gallery', type: 0 }, { id: '20', name: 'private-review', type: 0 }, { id: '21', name: 'voice', type: 2 }], roles: [{ id: '1', name: '@everyone', managed: false }, { id: '30', name: 'Moderators', managed: false }, { id: '40', name: 'Artists', managed: false }, { id: '50', name: 'Integration', managed: true }] };

describe('submission administration', () => {
    let root: ReturnType<typeof createRoot>;
    let container: HTMLDivElement;
    beforeEach(() => {
        vi.clearAllMocks(); mocks.locale = 'en'; mocks.list.mockResolvedValue([category]); mocks.options.mockResolvedValue(options);
        mocks.update.mockResolvedValue({ ...category, version: 4 }); mocks.create.mockResolvedValue(category);
        container = document.createElement('div'); document.body.append(container); root = createRoot(container);
    });
    afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
    async function click(label: string) {
        const scope = document.querySelector('[role="dialog"]') ?? document;
        const button = [...scope.querySelectorAll('button')].find(value => value.textContent === label);
        expect(button).toBeDefined(); await act(async () => button?.click());
    }
    const saveButton = () => [...document.querySelectorAll('button')].find(value => value.textContent === translate('submissions.save'));

    it.each(['en', 'nl'] as const)('edits original IDs and version and disables a category in %s', async locale => {
        mocks.locale = locale;
        await act(async () => root.render(<SubmissionsSettings guildId="1" />));
        expect(document.body.textContent).toContain('/submissions panel channel:<channel>');
        expect(document.body.textContent).toContain('#gallery');
        await click(translate('submissions.edit'));
        expect(document.body.textContent).toContain('Moderators');
        expect(document.body.textContent).toContain('Artists');
        await act(async () => (document.querySelector('[role="dialog"] input[type="checkbox"]') as HTMLInputElement).click());
        await click(translate('submissions.save'));
        const { id, guildId, version, ...input } = category;
        expect(mocks.update).toHaveBeenCalledWith(guildId, id, { ...input, enabled: false }, version);
    });

    it('requires valid channels and a reviewer and keeps save conflicts visible', async () => {
        mocks.update.mockRejectedValueOnce(new Error('Category changed. Refresh and try again.'));
        await act(async () => root.render(<SubmissionCategoryDialog guildId="1" category={category} options={options} onClose={vi.fn()} onSaved={vi.fn()} />));
        await click(translate('submissions.save'));
        expect(document.body.textContent).toContain('Category changed. Refresh and try again.');
        expect(saveButton()?.disabled).toBe(false);
        await act(async () => root.render(<SubmissionCategoryDialog key="invalid" guildId="1" category={{ ...category, reviewerRoleIds: [] }} options={options} onClose={vi.fn()} onSaved={vi.fn()} />));
        expect(saveButton()?.disabled).toBe(true);
        await act(async () => root.render(<SubmissionCategoryDialog key="managed" guildId="1" category={{ ...category, reviewerRoleIds: ['50'] }} options={options} onClose={vi.fn()} onSaved={vi.fn()} />));
        expect(saveButton()?.disabled).toBe(true);
        await act(async () => root.render(<SubmissionCategoryDialog key="voice" guildId="1" category={{ ...category, destinationChannelId: '21' }} options={options} onClose={vi.fn()} onSaved={vi.fn()} />));
        expect(saveButton()?.disabled).toBe(true);
    });

    it('can disable a category after its channels and roles have been deleted', async () => {
        await act(async () => root.render(<SubmissionCategoryDialog guildId="1" category={category}
            options={{ channels: [], roles: [] }} onClose={vi.fn()} onSaved={vi.fn()} />));
        expect(saveButton()?.disabled).toBe(true);
        await act(async () => (document.querySelector('[role="dialog"] input[type="checkbox"]') as HTMLInputElement).click());
        expect(saveButton()?.disabled).toBe(false);
        await click(translate('submissions.save'));
        const { id, guildId, version, ...input } = category;
        expect(mocks.update).toHaveBeenCalledWith(guildId, id, { ...input, enabled: false }, version);
    });

    it('creates a category using selected role IDs and keeps controls disabled during save', async () => {
        let finish!: (value: typeof category) => void;
        mocks.create.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
        await act(async () => root.render(<SubmissionCategoryDialog guildId="1" options={options} onClose={vi.fn()} onSaved={vi.fn()} />));
        const name = document.querySelector('[role="dialog"] input') as HTMLInputElement;
        await act(async () => {
            Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(name, ' Gallery ');
            name.dispatchEvent(new Event('input', { bubbles: true }));
        });
        const fields = [...document.querySelectorAll('[role="dialog"] [role="combobox"]')];
        for (const [index, label] of [[0, '#gallery'], [1, '#private-review']] as const) {
            await act(async () => fields[index]!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 })));
            const item = [...document.querySelectorAll('[role="option"]')].find(value => value.textContent === label);
            expect(item).toBeDefined();
            await act(async () => (item as HTMLElement).click());
        }
        const reviewer = fields[2] as HTMLInputElement;
        await act(async () => {
            reviewer.focus();
            reviewer.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
        });
        const visibleOptions = [...document.querySelectorAll('[role="option"]')];
        expect(visibleOptions.map(item => item.textContent)).not.toContain('@everyone');
        expect(visibleOptions.map(item => item.textContent)).not.toContain('Integration');
        const moderator = visibleOptions.find(item => item.textContent === 'Moderators');
        expect(moderator).toBeDefined();
        await act(async () => (moderator as HTMLElement).click());
        await click(translate('submissions.save'));
        expect(mocks.create).toHaveBeenCalledWith('1', {
            name: 'Gallery', destinationChannelId: '10', reviewChannelId: '20', reviewerRoleIds: ['30'], submitterRoleIds: [], enabled: true,
        });
        expect([...document.querySelectorAll('[role="dialog"] input')].every(input => (input as HTMLInputElement).disabled)).toBe(true);
        await act(async () => finish(category));
    });

    it('shows loading, ignores obsolete guild results and disables actions after retrieval failure', async () => {
        let resolveOld!: (value: typeof category[]) => void;
        mocks.list.mockReturnValueOnce(new Promise(resolve => { resolveOld = resolve; }));
        await act(async () => root.render(<SubmissionsSettings guildId="1" />));
        expect(document.querySelector('[role="progressbar"]')).not.toBeNull();
        mocks.list.mockResolvedValueOnce([{ ...category, guildId: '2', name: 'New guild category' }]);
        await act(async () => root.render(<SubmissionsSettings guildId="2" />));
        await act(async () => resolveOld([{ ...category, name: 'Obsolete category' }]));
        expect(document.body.textContent).toContain('New guild category');
        expect(document.body.textContent).not.toContain('Obsolete category');
        mocks.options.mockRejectedValueOnce(new Error('Roles unavailable'));
        await click(translate('submissions.refresh'));
        expect(document.body.textContent).toContain('Roles unavailable');
        const add = [...document.querySelectorAll('button')].find(value => value.textContent === translate('submissions.add'));
        expect(add?.disabled).toBe(true);
    });

    it('caps categories at 25 while retaining the edit action', async () => {
        mocks.list.mockResolvedValue(Array.from({ length: 25 }, (_, index) => ({ ...category, id: String(index) })));
        await act(async () => root.render(<SubmissionsSettings guildId="1" />));
        const add = [...document.querySelectorAll('button')].find(value => value.textContent === translate('submissions.add'));
        expect(add?.disabled).toBe(true);
        expect([...document.querySelectorAll('button')].filter(value => value.textContent === translate('submissions.edit'))).toHaveLength(25);
    });
});
