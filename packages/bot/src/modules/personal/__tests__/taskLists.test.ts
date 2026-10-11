import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChatInputCommandInteraction } from 'discord.js';
import tasks from '../commands/tasks.js';
import { personalCopy } from '../shared/personalCopy.js';
import { PersonalError } from '@zeffuro/fakegaming-common/managers';

const list = { id: 'list-id', title: 'Setup', items: ['Mic', 'Camera'], version: 2 };
const task = { id: 'task-id', title: 'Setup', state: 'active', checklist: [{ text: 'Mic', done: true }, { text: 'Camera', done: false }],
    dueAt: null, completedAt: null, recurrence: null, completions: 0, version: 0, sourceUrl: null };
const cm = {
    userManager: { getUser: vi.fn().mockResolvedValue({ preferredLocale: 'nl' }) },
    userChecklistTemplateManager: { create: vi.fn(), get: vi.fn(), list: vi.fn(), remove: vi.fn(), start: vi.fn() },
    userTaskManager: { get: vi.fn() },
};
function slash(action: string, values: Record<string, string | number> = {}) {
    return { user: { id: 'owner' }, guildId: 'guild', locale: 'en-US', deferReply: vi.fn(), editReply: vi.fn(), options: {
        getSubcommand: () => action, getString: (key: string) => typeof values[key] === 'string' ? values[key] : null,
        getInteger: (key: string) => typeof values[key] === 'number' ? values[key] : null,
    } };
}
beforeEach(() => {
    vi.clearAllMocks(); (globalThis as Record<string, unknown>).__FG_ACTIVE_CONFIG_MANAGER__ = cm;
    cm.userTaskManager.get.mockResolvedValue(task); cm.userChecklistTemplateManager.create.mockResolvedValue(list);
    cm.userChecklistTemplateManager.get.mockResolvedValue(list); cm.userChecklistTemplateManager.list.mockResolvedValue([list]);
    cm.userChecklistTemplateManager.start.mockResolvedValue({ ...task, checklist: task.checklist.map(item => ({ ...item, done: false })) });
});
describe('private reusable checklist commands', () => {
    it('saves only owner task item text and defers privately', async () => {
        const interaction = slash('save-list', { task: task.id, name: 'Stream setup' });
        await tasks.execute(interaction as unknown as ChatInputCommandInteraction);
        expect(cm.userTaskManager.get).toHaveBeenCalledWith(task.id, 'owner');
        expect(cm.userChecklistTemplateManager.create).toHaveBeenCalledWith('owner', 'Stream setup', ['Mic', 'Camera']);
        expect(interaction.deferReply).toHaveBeenCalledBefore(cm.userChecklistTemplateManager.create);
        expect(interaction.editReply).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('opgeslagen'), allowedMentions: { parse: [] } }));
    });
    it('starts and deletes through latest owner-bound template version', async () => {
        const start = slash('start-list', { list: list.id, due: '1h' }); await tasks.execute(start as unknown as ChatInputCommandInteraction);
        expect(cm.userChecklistTemplateManager.start).toHaveBeenCalledWith(list.id, 'owner', 2, cm.userTaskManager, { due: '1h' });
        expect(start.editReply).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('☐ Mic') }));
        const remove = slash('delete-list', { list: list.id }); await tasks.execute(remove as unknown as ChatInputCommandInteraction);
        expect(cm.userChecklistTemplateManager.remove).toHaveBeenCalledWith(list.id, 'owner', 2);
    });
    it('pages every saved list and handles missing tasks and stale starts', async () => {
        cm.userChecklistTemplateManager.list.mockResolvedValue(Array.from({ length: 8 }, (_, index) => ({ ...list, id: `list-${index}`, title: `List ${index}` })));
        const page = slash('lists', { page: 2 }); await tasks.execute(page as unknown as ChatInputCommandInteraction);
        expect(page.editReply).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('List 7') }));
        expect(page.editReply.mock.calls[0]?.[0].content).not.toContain('List 0');
        cm.userTaskManager.get.mockResolvedValue(null); const missing = slash('save-list', { task: 'other-task', name: 'Other' });
        await tasks.execute(missing as unknown as ChatInputCommandInteraction); expect(cm.userChecklistTemplateManager.create).not.toHaveBeenCalled();
        expect(missing.editReply).toHaveBeenCalledWith(personalCopy('nl')('errors.missing'));
        cm.userChecklistTemplateManager.start.mockRejectedValueOnce(new PersonalError('stale'));
        const stale = slash('start-list', { list: list.id }); await tasks.execute(stale as unknown as ChatInputCommandInteraction);
        expect(stale.editReply).toHaveBeenCalledWith(personalCopy('nl')('errors.stale'));
    });
});
